import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

/**
 * Донесение клиента о том, чем кончилась подача объявления.
 *
 * ## Зачем это есть
 *
 * 2026-11-21 человек с 17 действующими объявлениями дважды не смог подать
 * восемнадцатое из приложения. Разбор занял двое суток и дался только потому,
 * что загруженные фотографии остались в хранилище и по их именам и времени
 * удалось восстановить ход событий. Самой ошибки не было нигде: в приложении
 * стоял `catch` без переменной, то есть причина отказа читалась и выбрасывалась,
 * а на сервере записи не возникало вовсе — объявление пишется в базу НАПРЯМУЮ с
 * устройства, и между приложением и Firestore нет ни одной нашей функции,
 * которой было бы чем логировать.
 *
 * Отсюда и эта функция: единственное место, куда клиент может рассказать, что у
 * него случилось.
 *
 * ## Три решения, которые выглядят неправильными, но сделаны намеренно
 *
 * ⚠️ **App Check НЕ принуждается.** У остального проекта он включён
 * принудительно, и это правильно. Здесь — нет: если App Check у человека сломан,
 * то он и есть причина отказа, а строгая проверка выбросила бы ровно то
 * донесение, за которым мы пришли. Вердикт записывается полем `appCheck`, и
 * отличить «пришёл со своим токеном» от «пришёл без него» можно потом.
 *
 * ⚠️ **Вход не требуется.** «Слетел вход» — одна из причин, которые мы ищем;
 * требовать вошедшего значило бы не узнать о ней никогда.
 *
 * ⚠️ **Функция не отказывает НИКОГДА.** Ни на чужих полях, ни на мусоре, ни на
 * превышении предела — любой ответ успешный, а принято донесение или нет, видно
 * по `accepted`. Канал диагностики, который сам умеет падать, бесполезен: его
 * отказ приедет в то же окно ошибки и подменит настоящую причину.
 *
 * ## Чего здесь нет и не будет
 *
 * Телефона, почты, имени, текста объявления и адреса. Разбирать по ним нечего —
 * шаг, код ошибки и версия сборки говорят всё, — а утечь они могут. `uid`
 * достаточно, чтобы найти человека в консоли, когда он сам позвонит и назовёт
 * код.
 */

/** Сколько донесений принимаем от одного человека за час. */
const HOURLY_LIMIT = 20;
/**
 * Предел для тех, кто пришёл без входа. Отдельный и общий на всех: привязать
 * такое донесение не к кому, а значит и считать можно только в сумме.
 */
const ANONYMOUS_HOURLY_LIMIT = 60;

/** Сколько живёт запись. Поле `expiresAt` читает политика TTL. */
const RETENTION_DAYS = 90;

/** Длина текста ошибки, дальше которой разбору ничего не прибавляется. */
const MESSAGE_LIMIT = 300;
const SHORT_LIMIT = 60;

/**
 * Код вида `ELAN-7F3K`. Придумывает его КЛИЕНТ, а не сервер, и это важно:
 * человек должен увидеть код даже тогда, когда донесение до нас не доехало —
 * то есть именно при обрыве связи. Сервер лишь проверяет написание.
 */
const CODE_SHAPE = /^[A-Z]{3,6}-[A-Z0-9]{4,6}$/;

const text = (value: unknown, limit: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;

/** Целое в разумных границах. Мусор и бесконечности отбрасываются. */
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000
    ? value
    : null;

/**
 * Длительность в миллисекундах — предел ЧАС.
 *
 * ⚠️ Раньше здесь стоял `count`, и это была ошибка: его потолок 100 000 — это
 * сто секунд. Первое же настоящее донесение (ELAN-9K66, 2026-11-23) сообщило о
 * подаче длиной 164 секунды и получило в графе `durationMs` пустоту. То есть
 * мерка молча выбрасывала ровно те случаи, ради которых её ставили: короткая
 * подача отказывает редко, а подолгу висят как раз сломанные. Один потолок на
 * «число снимков» и на «миллисекунды» — не экономия, а потеря.
 */
const millis = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 3600000
    ? Math.round(value)
    : null;

/**
 * Код и описание отказа одной строкой, без повтора кода.
 *
 * ⚠️ Firebase сам вшивает код в начало описания — `[storage/unknown] The server
 * has terminated…`. Склеивая их в лоб, журнал читался
 * `storage/unknown: [storage/unknown] The server…`, и глазу приходилось
 * спотыкаться на каждой строке.
 */
const reason = (code: string | null, message: string | null): string => {
  if (!message) return code ?? 'без описания';
  const prefix = code ? `[${code}]` : '';
  const body = prefix && message.startsWith(prefix) ? message.slice(prefix.length).trim() : message;
  return code ? `${code}: ${body}` : body;
};

const flag = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

/** Час в бакинском времени — им же считается предел. */
const hourKey = (now: Date): string =>
  new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 13);

export const reportClientError = functions
  .region('europe-west1')
  .https.onCall(async (data: unknown, context) => {
    const payload = (data ?? {}) as Record<string, unknown>;
    const now = new Date();

    const uid = context.auth?.uid ?? null;
    const owner = uid ?? 'anon';
    const hour = hourKey(now);

    const code = (() => {
      const given = text(payload.code, 16);
      return given && CODE_SHAPE.test(given) ? given : null;
    })();

    const record = {
      code,
      uid,
      owner,
      hour,
      createdAt: now.toISOString(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
      ),

      // Чем кончилось. Успехи пишутся тоже — решение владельца 2026-11-22: без
      // них неизвестен знаменатель, то есть сколько людей вообще доходит до
      // отправки. Подач в сутки единицы, писать все дёшево.
      outcome: oneOf(payload.outcome, ['success', 'error'] as const) ?? 'error',
      flow: text(payload.flow, SHORT_LIMIT) ?? 'unknown',
      step: text(payload.step, SHORT_LIMIT),

      source: oneOf(payload.source, ['app', 'site'] as const),
      platform: text(payload.platform, SHORT_LIMIT),
      osVersion: text(payload.osVersion, SHORT_LIMIT),
      device: text(payload.device, SHORT_LIMIT),
      appVersion: text(payload.appVersion, SHORT_LIMIT),
      build: text(payload.build, SHORT_LIMIT),

      tier: text(payload.tier, SHORT_LIMIT),
      photosTotal: count(payload.photosTotal),
      photosDone: count(payload.photosDone),
      durationMs: millis(payload.durationMs),

      online: flag(payload.online),
      // ⚠️ Выходил ли человек из приложения во время подачи. Из-за этого и
      // ломалось: свёрнутое приложение не рисует вид, которым наносится водяной
      // знак, и страховка на восемь секунд объявляла снимок неудавшимся. Поле
      // оставлено и после починки — им проверяется, что починка работает.
      backgrounded: flag(payload.backgrounded),
      // ⚠️ Сколько раз отправка снимка срывалась и начиналась заново
      // (`uploadOne` в приложении). Ноль при успехе — ответ, а не пустая графа:
      // повторы не понадобились. Больше нуля при успехе — подача доехала только
      // благодаря им. Больше нуля при отказе — повтор не спас, причина глубже.
      retries: count(payload.retries),
      retryCode: text(payload.retryCode, SHORT_LIMIT),

      errorName: text(payload.errorName, SHORT_LIMIT),
      errorCode: text(payload.errorCode, SHORT_LIMIT),
      errorMessage: text(payload.errorMessage, MESSAGE_LIMIT),

      /** Номер объявления — только при успехе. */
      propertyId: text(payload.propertyId, SHORT_LIMIT),

      /**
       * Прошёл ли App Check. Не запрет, а наблюдение: см. шапку файла.
       */
      appCheck: context.app ? 'passed' : 'absent',
    };

    // Журнал функций заполняется ВСЕГДА, даже когда запись в базу не состоится:
    // Cloud Logging ищется по полям, и смотреть в нём можно с первого дня, не
    // дожидаясь экрана в модераторке.
    const logLine = {
      code: record.code,
      uid: record.uid,
      outcome: record.outcome,
      flow: record.flow,
      step: record.step,
      source: record.source,
      platform: record.platform,
      // ⚠️ Устройство и версия системы в строке журнала СТОЯЛИ не всегда: до
      // 2026-11-23 их тут не было, и первое же настоящее донесение пришлось
      // доставать из базы отдельным запросом, чтобы узнать, что это Galaxy S23
      // FE на Android 16. В записи поля были, а в журнале — нет; журнал для
      // того и существует, чтобы в базу не ходить.
      osVersion: record.osVersion,
      device: record.device,
      appVersion: record.appVersion,
      build: record.build,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      backgrounded: record.backgrounded,
      photos: `${record.photosDone ?? '?'}/${record.photosTotal ?? '?'}`,
      durationMs: record.durationMs,
      retries: record.retries,
      retryCode: record.retryCode,
      appCheck: record.appCheck,
    };

    /**
     * Одна читаемая строка — то, что видно в журнале БЕЗ раскрытия записи.
     *
     * ⚠️ Раньше здесь звался `logger.error` со строкой-заголовком, и это было
     * ошибкой устройства: такой вызов подмешивает в запись стек вызовов самого
     * `firebase-functions`, и в журнале читалось двадцать строк чужого стека, а
     * версия и шаг тонули в них. Поэтому `logger.write`: он пишет ровно то, что
     * дано, и `message` остаётся человеческим.
     */
    const headline = [
      record.outcome === 'error' ? 'ОТКАЗ' : 'успех',
      record.code ?? 'без кода',
      `${record.source ?? '?'}/${record.platform ?? '?'}${record.osVersion ? ' ' + record.osVersion : ''}`,
      record.appVersion ? `v${record.appVersion}${record.build ? ' (' + record.build + ')' : ''}` : null,
      record.device,
      `шаг ${record.step ?? '?'} ${logLine.photos}`,
      record.durationMs !== null ? `${Math.round(record.durationMs / 1000)}с` : null,
      record.backgrounded ? 'СВЁРНУТО' : null,
      record.retries ? `повторов ${record.retries}` : null,
      record.outcome === 'error' ? reason(record.errorCode, record.errorMessage) : record.propertyId,
    ]
      .filter(Boolean)
      .join(' · ');

    functions.logger.write({
      severity: record.outcome === 'error' ? 'ERROR' : 'INFO',
      message: `[ClientError] ${headline}`,
      ...logLine,
    });

    try {
      const collection = admin.firestore().collection('clientErrors');

      // Предел считается ДВУМЯ равенствами, и это выбрано нарочно: равенства
      // Firestore сводит по однополевым указателям, то есть составной указатель
      // заводить не нужно. Сравнение «createdAt больше часа назад» потребовало
      // бы его и ещё одной выкладки.
      const limit = uid ? HOURLY_LIMIT : ANONYMOUS_HOURLY_LIMIT;
      const already = await collection
        .where('owner', '==', owner)
        .where('hour', '==', hour)
        .count()
        .get();

      if (already.data().count >= limit) {
        functions.logger.warn('[ClientError] предел часа исчерпан', {owner, hour, limit});
        return {accepted: false, code: record.code, reason: 'rate-limited'};
      }

      // Имя документа — сам код: человек называет его по телефону, и находить
      // запись надо по нему одним обращением. `create` вместо `set` страхует от
      // подмены: повтор того же кода не перепишет чужую запись, а уедет под
      // своим именем.
      if (record.code) {
        try {
          await collection.doc(record.code).create(record);
          return {accepted: true, code: record.code};
        } catch {
          await collection.add(record);
          return {accepted: true, code: record.code};
        }
      }

      await collection.add(record);
      return {accepted: true, code: null};
    } catch (error) {
      // Отказ записи гасится здесь же. Клиенту он не нужен: человек уже видит
      // своё окно с кодом, и вторая ошибка поверх первой только запутает.
      functions.logger.error('[ClientError] не удалось записать донесение', {
        owner,
        message: error instanceof Error ? error.message : String(error),
      });
      return {accepted: false, code: record.code, reason: 'write-failed'};
    }
  });
