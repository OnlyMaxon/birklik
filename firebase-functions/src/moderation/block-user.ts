import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

/**
 * Блокировка человека модератором.
 *
 * Требование Apple к приложениям с чужим контентом (правило 1.2): жалоба на
 * содержимое, опубликованные контакты и **возможность заблокировать
 * нарушителя**. Первые две у нас были — `commentReports` и страница контактов,
 * — третьей не было вовсе.
 *
 * Переписки между людьми у нас нет, поэтому блокировка нужна только
 * модераторская: человек человека не блокирует, потому что и связаться напрямую
 * внутри площадки не может.
 *
 * ⚠️ **Запрет живёт в ДВУХ местах, и ни одно из них — не поле в профиле.**
 * Поле `blocked` в `users/{id}` показывает модератору и объясняет человеку; сам
 * же запрет делают:
 *
 * 1. заявка `blocked` в токене — её проверяют правила Firestore там, где клиент
 *    пишет сам: создание и правка объявлений, брони, жалобы;
 * 2. проверка в `interactions.ts` на сервере — комментарии, оценки и жалобы
 *    пишет сервис-аккаунт, правила его не касаются ВООБЩЕ, и без этой проверки
 *    заблокированный продолжал бы комментировать.
 *
 * Полагаться на одно из двух нельзя: правила не видят серверных записей, а
 * серверная проверка не видит прямых записей клиента.
 *
 * ⚠️ **Заявкой, а не чтением документа в правилах.** Правило вида
 * `get(/users/$(uid)).data.blocked != true` стоило бы ДОПОЛНИТЕЛЬНОЕ ЧТЕНИЕ на
 * каждое сохранение объявления и каждую отметку в избранном, и тратилось бы оно
 * на всех, включая тех, кого никто не блокировал. Заявка в токене уже приехала
 * вместе с запросом и проверяется бесплатно — так у нас сделан `moderator`.
 *
 * ⚠️ **Цена заявки — задержка до часа.** Заявка попадает в токен при его
 * продлении, а живёт токен час. `revokeRefreshTokens` заставляет клиента взять
 * новый токен, но УЖЕ ВЫДАННЫЙ продолжает действовать до своего срока. Значит
 * в худшем случае заблокированный ещё час может создать объявление. Это
 * осознанная цена, и она почти ничего не стоит: правила заставляют обычное
 * объявление родиться со статусом `pending`, то есть невидимым до одобрения
 * модератором. А комментарии и оценки закрываются МГНОВЕННО — серверная
 * проверка читает документ человека живьём, без всяких заявок.
 */

/** Журнал блокировок. Пишет только сервер, читает только модератор. */
export const BLOCK_AUDIT = 'blockAudit';

/** Предел длины причины. Человек её читает, модератор пишет — не роман. */
const REASON_LIMIT = 500;

/**
 * Firestore не даёт писать больше 500 операций одной партией. У людей с
 * десятком объявлений это не всплывёт никогда, но у площадки бывают учётные
 * записи агентств.
 */
const BATCH_LIMIT = 450;

interface BlockResult {
  /** Сколько объявлений сняла или вернула эта блокировка. */
  listings: number;
}

/** Разбивка на партии по пределу Firestore. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const setUserBlocked = functions
  .region('europe-west1')
  .runWith({timeoutSeconds: 120})
  .https.onCall(async (data: unknown, context): Promise<BlockResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Право модератора берётся из заявки токена, а не из поля `isModerator` в
    // профиле: поле расставляет скрипт под сервис-аккаунтом и оно существует
    // ради поиска, кому разослать жалобы. Настоящее право — заявка.
    if (context.auth.token.moderator !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Moderators only');
    }

    const payload = (data ?? {}) as {userId?: unknown; blocked?: unknown; reason?: unknown};
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    const blocked = payload.blocked === true;
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    // Причина обязательна именно при блокировке: человек её увидит, и «просто
    // так» ему показывать нечего. При разблокировке причина не нужна.
    if (blocked && !reason) {
      throw new functions.https.HttpsError('invalid-argument', 'reason is required');
    }
    if (reason.length > REASON_LIMIT) {
      throw new functions.https.HttpsError('invalid-argument', 'reason is too long');
    }
    if (userId === context.auth.uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot block yourself');
    }

    const auth = admin.auth();
    const db = admin.firestore();
    const actor = context.auth.uid;

    let target;
    try {
      target = await auth.getUser(userId);
    } catch {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    // ⚠️ Модератора не блокируем. Иначе один модератор выключает другого — а в
    // пределе и владельца площадки, после чего разблокировать некому: кнопка
    // доступна только модератору.
    if (target.customClaims?.moderator === true) {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot block a moderator');
    }

    // ⚠️⚠️ `setCustomUserClaims` ЗАМЕНЯЕТ объект заявок целиком, а не дополняет
    // его. Записать здесь `{blocked: true}` значило бы стереть человеку все
    // прочие заявки — и именно так однажды пропадёт чей-то `moderator`.
    // Поэтому читаем существующие и сливаем.
    const claims: Record<string, unknown> = {...(target.customClaims ?? {})};
    if (blocked) {
      claims.blocked = true;
    } else {
      // Удаляем ключ, а не ставим `false`: правила спрашивают
      // `token.blocked != true`, и мёртвый ключ в заявке только копил бы мусор.
      delete claims.blocked;
    }

    // Порядок: сначала заявка, потом отзыв токенов. Наоборот — и человек успел
    // бы взять новый токен ещё БЕЗ заявки, то есть отзыв сработал бы впустую.
    await auth.setCustomUserClaims(userId, claims);
    await auth.revokeRefreshTokens(userId);

    const now = new Date().toISOString();

    // Объявления. Блокировка снимает с витрины только ДЕЙСТВУЮЩИЕ: `pending`,
    // `draft` и уже снятые на витрине и так не видны, а трогать их значило бы
    // потерять их настоящее состояние.
    //
    // ⚠️ Снятое помечается `hiddenByBlock`. Без пометки разблокировка вернула бы
    // на витрину и то, что человек скрыл сам задолго до блокировки, — то есть
    // показала бы людям объявления, которые он намеренно прятал.
    const snapshot = blocked
      ? await db.collection('properties')
          .where('ownerId', '==', userId)
          .where('status', '==', 'active')
          .get()
      : await db.collection('properties')
          .where('ownerId', '==', userId)
          .where('hiddenByBlock', '==', true)
          .get();

    const refs = snapshot.docs.map(doc => doc.ref);
    for (const part of chunk(refs, BATCH_LIMIT)) {
      const batch = db.batch();
      for (const ref of part) {
        batch.update(ref, blocked
          ? {status: 'inactive', hiddenByBlock: true, updatedAt: now, updatedBy: actor}
          // При возврате поле УДАЛЯЕТСЯ, а не ставится в `false`: выборка выше
          // отбирает по `== true`, но соседние выборки по всей базе отбирают по
          // наличию поля — так же, как у `boostedAt`.
          : {
              status: 'active',
              hiddenByBlock: admin.firestore.FieldValue.delete(),
              updatedAt: now,
              updatedBy: actor,
            });
      }
      await batch.commit();
    }

    // Профиль — ПОСЛЕ заявки и объявлений. Он ничего не запрещает, он
    // объясняет; упади функция раньше — запрет уже действует, а модератор
    // увидит, что блокировка не дописана, и нажмёт снова.
    await db.collection('users').doc(userId).set(blocked
      ? {blocked: true, blockedReason: reason, blockedAt: now, blockedBy: actor}
      : {
          blocked: admin.firestore.FieldValue.delete(),
          blockedReason: admin.firestore.FieldValue.delete(),
          blockedAt: admin.firestore.FieldValue.delete(),
          blockedBy: admin.firestore.FieldValue.delete(),
        },
      {merge: true});

    // Журнал. Та же мысль, что у `tierAudit`: через полгода вопрос «кто и за
    // что заблокировал этого человека» должен иметь ответ.
    await db.collection(BLOCK_AUDIT).add({
      userId,
      email: target.email ?? '',
      action: blocked ? 'blocked' : 'unblocked',
      reason: blocked ? reason : '',
      listings: refs.length,
      by: actor,
      at: now,
    });

    console.log(
      `[Block] ${blocked ? 'заблокирован' : 'разблокирован'} ${userId} ` +
      `модератором ${actor}, объявлений: ${refs.length}` +
      (blocked ? `, причина: ${reason}` : '')
    );

    return {listings: refs.length};
  });
