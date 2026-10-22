import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';

import {APPLE_ROOT_CERTIFICATES} from './apple-roots';

/**
 * Проверка подписи квитанций App Store.
 *
 * Третья касса площадки. Состояние объявления одно, кассы три: Azericard на
 * сайте, Google Play и App Store в приложении. Каталог товаров у магазинов
 * ОБЩИЙ — имена товаров совпадают буква в букву, поэтому `PLAY_PRODUCTS` и
 * `BOOST_PRODUCTS` из `google-play.ts` переиспользуются как есть, а разница
 * только в способе доказать оплату.
 *
 * ⚠️ **Ответ магазина на устройстве ничего не доказывает.** У Google мы
 * спрашиваем сервер Google о токене. У Apple спрашивать некого и не нужно:
 * квитанция StoreKit 2 — это **JWS, подписанный Apple**, и подпись проверяется
 * у нас по корневым сертификатам. Ключи от Apple для этого НЕ требуются вовсе
 * (они нужны отдельно — опросу возвратов).
 *
 * ⚠️ **Проверяем официальной библиотекой Apple**, а не своими руками. Разбор
 * цепочки x5c, сверка с корнем, проверка срока и отзыва сертификата — это ровно
 * тот код, в котором ошибаются молча и узнают об этом от того, кто уже выписал
 * себе Premium даром.
 */

/** Наш идентификатор приложения. Подпись покрывает его, подделать нельзя. */
export const APPLE_BUNDLE_ID = 'az.birklik.app';

/**
 * Числовой идентификатор приложения в App Store Connect.
 *
 * ⚠️ Библиотека требует его ТОЛЬКО для боевой среды и запрещает для песочницы.
 * Пока приложение в App Store Connect не заведено, числа не существует — и
 * боевые квитанции проверить нечем. Песочница при этом работает полностью,
 * поэтому разработку он не задерживает.
 */
function appAppleId(): number | undefined {
  const raw = process.env.APPLE_APP_ID?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Проверяльщики по средам, по одному на среду и с запоминанием.
 *
 * Запоминаем потому, что `SignedDataVerifier` разбирает корневые сертификаты в
 * конструкторе, а горячий экземпляр функции обслуживает много запросов подряд.
 */
const verifiers = new Map<Environment, SignedDataVerifier>();

function verifierFor(environment: Environment): SignedDataVerifier {
  const existing = verifiers.get(environment);
  if (existing) return existing;

  const id = environment === Environment.PRODUCTION ? appAppleId() : undefined;
  if (environment === Environment.PRODUCTION && id === undefined) {
    throw new AppleVerificationError(
      'unavailable',
      'APPLE_APP_ID не задан — боевые квитанции App Store проверить нечем'
    );
  }

  // ⚠️ `enableOnlineChecks: true` включает проверку отзыва сертификата и срока
  // по текущей дате — то есть обращение к Apple. Это осознанно: сорвётся связь
  // с Apple — мы ответим «попробуйте ещё», и приложение НЕ израсходует товар,
  // а значит деньги у человека не сгорят. Выключить проверку ради надёжности
  // значило бы принимать отозванный сертификат.
  const verifier = new SignedDataVerifier(
    APPLE_ROOT_CERTIFICATES,
    true,
    environment,
    APPLE_BUNDLE_ID,
    id
  );
  verifiers.set(environment, verifier);
  return verifier;
}

/** Отказ проверки с уже выбранным видом ответа приложению. */
export class AppleVerificationError extends Error {
  constructor(
    /** `unavailable` — можно повторить; остальное — повторять бессмысленно. */
    readonly kind: 'unavailable' | 'invalid' | 'not-found',
    message: string
  ) {
    super(message);
    this.name = 'AppleVerificationError';
  }
}

/**
 * Среда квитанции — ПОДСКАЗКОЙ, из неразобранной середины JWS.
 *
 * ⚠️ Данным этим не верим и верить не нужно: подсказка решает лишь, какой
 * проверяльщик позвать. Сам проверяльщик сверяет среду в подписанной полезной
 * нагрузке со своей — соврал о среде, получишь `INVALID_ENVIRONMENT`. То есть
 * подмена подсказки не даёт ничего, кроме отказа.
 *
 * Зачем вообще: у боевой и песочной среды разные правила (песочнице нельзя
 * передавать числовой id приложения, бою — обязательно), и один проверяльщик
 * на обе Apple не делает.
 */
function environmentHint(jws: string): Environment | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;

  try {
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      environment?: unknown;
    };
    if (decoded.environment === 'Sandbox') return Environment.SANDBOX;
    if (decoded.environment === 'Production') return Environment.PRODUCTION;
    return null;
  } catch {
    return null;
  }
}

/**
 * Среда уведомления — подсказкой из его неразобранной нагрузки.
 *
 * У уведомления среда лежит глубже, чем у квитанции: в `data.environment`, а не
 * в корне. Отдельная функция, а не параметр у прежней, потому что ошибиться
 * тут — значит всегда звать проверяльщика песочницы и отвергать боевые
 * возвраты, причём молча.
 */
function notificationEnvironmentHint(jws: string): Environment | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;

  try {
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      data?: {environment?: unknown};
    };
    if (decoded.data?.environment === 'Sandbox') return Environment.SANDBOX;
    if (decoded.data?.environment === 'Production') return Environment.PRODUCTION;
    return null;
  } catch {
    return null;
  }
}

/**
 * Проверяет подпись уведомления App Store Server Notifications V2.
 *
 * ⚠️ Подпись здесь — это ВСЯ проверка подлинности, другой нет. Адрес нашего
 * приёмника открыт, секрета в нём нет и быть не может: Apple такого не
 * предусматривает. Ровно так же устроен колбэк Azericard, где подлинность
 * доказывает `P_SIGN`, а не адрес.
 */
export async function verifyAppleNotification(signedPayload: string) {
  if (!signedPayload || typeof signedPayload !== 'string') {
    throw new AppleVerificationError('invalid', 'Пустое уведомление');
  }

  const environment = notificationEnvironmentHint(signedPayload);
  if (!environment) {
    throw new AppleVerificationError('invalid', 'Уведомление не похоже на подписанное Apple');
  }

  try {
    return await verifierFor(environment).verifyAndDecodeNotification(signedPayload);
  } catch (error) {
    if (error instanceof AppleVerificationError) throw error;

    if (error instanceof VerificationException) {
      const kind =
        error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
          ? 'unavailable'
          : 'invalid';
      throw new AppleVerificationError(
        kind,
        `Подпись уведомления не сошлась: ${VerificationStatus[error.status] ?? error.status}`
      );
    }

    throw new AppleVerificationError('unavailable', `Проверка уведомления сорвалась: ${error}`);
  }
}

/** Разобранная и проверенная покупка — только то, что нам нужно. */
export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  /**
   * Привязка к нашей записи о намерении (`purchaseIntents/{uuid}`).
   *
   * ⚠️ Это ЗАМЕНА `obfuscatedExternalProfileId` у Google, которым 2026-10-10
   * закрыли дыру «убили процесс после оплаты → тариф не поставлен». У Apple
   * такого поля нет, а `appAccountToken` обязан быть UUID — ни uid, ни номер
   * объявления в него не положить. Поэтому номер лежит у нас, а здесь только
   * ключ к нему.
   */
  appAccountToken: string;
  /** `true` у песочницы — проверка App Review идёт именно в ней. */
  isSandbox: boolean;
  quantity: number;
  purchaseDate: number;
  /** Деньги уже вернули. Выдавать по такой квитанции нечего. */
  revoked: boolean;
  /**
   * ⚠️ Цена в МИЛЛИЕДИНИЦАХ валюты: 9.99 приедет числом 9990. Прочитать как
   * обычную сумму — и в журнале платежей появятся тысячи манатов.
   */
  priceMilliunits?: number;
  currency?: string;
}

/**
 * Проверяет подпись квитанции и отдаёт разобранную покупку.
 *
 * ⚠️ Песочница принимается НАРОЧНО, и это не щель. Проверяющие App Review
 * покупают именно в песочнице, при том что приложение уже в магазине: откажи мы
 * песочным квитанциям — и приложение завернут на проверке, потому что у
 * рецензента «покупка не работает». Обычному человеку песочная квитанция
 * недоступна: она требует учётной записи Sandbox, которую выдаём только мы, и
 * сборки не из магазина. Такая покупка метится `isTestPurchase`, как и у
 * Google, чтобы не попадала в деньги.
 *
 * Среды `Xcode` и `LocalTesting` не принимаются: их квитанции подписаны местным
 * сертификатом разработчика, то есть кем угодно.
 */
export async function verifyAppleTransaction(jws: string): Promise<AppleTransaction> {
  if (!jws || typeof jws !== 'string') {
    throw new AppleVerificationError('invalid', 'Пустая квитанция');
  }

  const environment = environmentHint(jws);
  if (!environment) {
    throw new AppleVerificationError(
      'invalid',
      'Квитанция не похожа на подписанную покупку App Store'
    );
  }

  let payload;
  try {
    payload = await verifierFor(environment).verifyAndDecodeTransaction(jws);
  } catch (error) {
    if (error instanceof AppleVerificationError) throw error;

    if (error instanceof VerificationException) {
      // ⚠️ Повторяемый отказ — это НЕ «подпись плохая», а «не дозвонились до
      // Apple за проверкой отзыва». Разница решает судьбу денег: на повторяемом
      // мы говорим «попробуйте ещё», и товар остаётся нерасходованным.
      const kind =
        error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
          ? 'unavailable'
          : 'invalid';
      throw new AppleVerificationError(
        kind,
        `Подпись App Store не сошлась: ${VerificationStatus[error.status] ?? error.status}`
      );
    }

    throw new AppleVerificationError('unavailable', `Проверка подписи сорвалась: ${error}`);
  }

  // Библиотека уже сверила `bundleId` и среду со своей настройкой — но поля
  // приходят необязательными, и пустое означало бы квитанцию не нашего вида.
  if (payload.bundleId !== APPLE_BUNDLE_ID) {
    throw new AppleVerificationError('invalid', `Чужое приложение: ${payload.bundleId}`);
  }
  if (!payload.transactionId || !payload.productId) {
    throw new AppleVerificationError('invalid', 'В квитанции нет номера покупки или товара');
  }

  return {
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId ?? payload.transactionId,
    productId: payload.productId,
    appAccountToken: payload.appAccountToken ?? '',
    isSandbox: environment === Environment.SANDBOX,
    // Отсутствие количества читаем как единицу: так Apple отдаёт обычную
    // покупку одного товара.
    quantity: payload.quantity ?? 1,
    purchaseDate: payload.purchaseDate ?? 0,
    revoked: Boolean(payload.revocationDate),
    priceMilliunits: payload.price,
    currency: payload.currency,
  };
}
