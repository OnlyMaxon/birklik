import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

import {applyPaidTier} from './apply-tier';
import {applyBoostPackage} from '../boost/apply-boost';
import {BOOST_PRODUCTS, PLAY_PRODUCTS} from './google-play';
import {AppleVerificationError, verifyAppleTransaction} from './app-store';

/**
 * Покупка тарифа и подъёма из приложения через App Store.
 *
 * Зеркало `verifyPlayPurchase`, и намеренно именно зеркало, а не отдельная
 * логика: тариф ставит та же `applyPaidTier`, подъём — та же
 * `applyBoostPackage`, каталог товаров — те же `PLAY_PRODUCTS` и
 * `BOOST_PRODUCTS` (имена товаров у магазинов совпадают буква в букву). Касс
 * три, состояние объявления одно.
 *
 * Чем отличается от Google:
 *
 * ```
 * доказательство   подпись Apple на самой квитанции, спрашивать некого
 * привязка         purchaseIntents вместо obfuscatedProfileId (у Apple его НЕТ)
 * сумма            Apple её присылает — у Play записи о платеже суммы не имеют
 * песочница        принимается: App Review покупает именно в ней
 * ```
 *
 * ⚠️ Главное правило то же, что у Google: **успехом отвечать только когда
 * оплаченное действительно выдано.** Приложение на успех вызывает
 * `finishTransaction`, а это для Apple подтверждение покупки — после него
 * возврат невозможен. Пока не подтвердили, незавершённую покупку Apple отдаёт
 * приложению снова и возврат остаётся доступен. Это последняя страховка, и
 * ответ «уже применено» без выдачи её сжигает. У Google такая дыра была и
 * закрыта 2026-10-14 — здесь её нет с рождения.
 */

/** Записи о намерении: ключ — тот самый UUID, что уехал в Apple. */
const INTENTS = 'purchaseIntents';

export const verifyApplePurchase = functions
  .region('europe-west1')
  .https.onCall(async (data: unknown, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const payload = (data ?? {}) as {purchaseToken?: unknown; propertyId?: unknown};
    // Поле называется `purchaseToken` и у Apple: `expo-iap` отдаёт в нём
    // подписанную квитанцию (JWS), а у Google — токен покупки. Приложению так
    // не приходится знать, в какой кассе оно сейчас.
    const jws = typeof payload.purchaseToken === 'string' ? payload.purchaseToken : '';
    const propertyIdFromApp = typeof payload.propertyId === 'string' ? payload.propertyId : '';

    if (!jws) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing purchaseToken');
    }

    // Проверка подписи ДО любых записей: побочных действий у неё нет, а
    // начинать с неё дешевле, чем откатывать начатое.
    let tx;
    try {
      tx = await verifyAppleTransaction(jws);
    } catch (error) {
      if (error instanceof AppleVerificationError) {
        console.error('[Apple] Квитанция отвергнута:', error.message);
        // ⚠️ `unavailable` против `invalid-argument` — это судьба денег, а не
        // вежливость: на `unavailable` приложение товар НЕ расходует и повтор
        // пройдёт, на остальное — повторять нечего.
        throw new functions.https.HttpsError(
          error.kind === 'unavailable' ? 'unavailable' : 'invalid-argument',
          error.message
        );
      }
      console.error('[Apple] Проверка подписи сорвалась:', error);
      throw new functions.https.HttpsError('unavailable', 'Could not verify with App Store');
    }

    // ⚠️ Товар берём из ПОДПИСАННОЙ квитанции, а не из слова приложения. Иначе
    // телефон мог бы прислать настоящую подпись покупки `boost_1` и попросить
    // применить `premium_30`.
    const product = PLAY_PRODUCTS[tx.productId];
    const boost = BOOST_PRODUCTS[tx.productId];
    if (!product && !boost) {
      // Товар, которого мы не знаем: в App Store Connect он заведён под другим
      // именем, чем у нас. Деньги списаны, а что продали — неясно. Такое должно
      // быть видно в журнале, а не проглатываться.
      console.error('[Apple] Неизвестный товар:', tx.productId);
      throw new functions.https.HttpsError('invalid-argument', 'Unknown product');
    }

    if (tx.revoked) {
      // Деньги уже вернули — выдавать нечего. Такое приедет, если приложение
      // хранило квитанцию и пришло с ней после возврата.
      console.warn('[Apple] Квитанция уже отозвана:', tx.transactionId);
      throw new functions.https.HttpsError('failed-precondition', 'Purchase was refunded');
    }

    // ⚠️ Количество. У Google «более одной копии в транзакции» выключалось
    // ГАЛОЧКОЙ в консоли — иначе человек платил бы за тридцать подъёмов, получая
    // десять. У Apple такой галочки нет, запрет живёт здесь. Мы всегда просим
    // ровно один товар, поэтому иное количество означает что-то неожиданное:
    // отказываем, товар остаётся неподтверждённым, и Apple возвращает деньги.
    if (tx.quantity !== 1) {
      console.error(
        '[Apple] Количество не единица, выдавать нельзя:',
        tx.transactionId, tx.quantity
      );
      throw new functions.https.HttpsError('failed-precondition', 'Unexpected quantity');
    }

    // Чьё объявление поднимаем. Слову приложения верим ТОЛЬКО когда записи о
    // намерении нет: номер в ней положен до оплаты и приехал обратно внутри
    // подписи Apple, а значит его не подменить на устройстве.
    //
    // ⚠️ Зачем вообще эта запись. У Google номер объявления хранит сам Google
    // (`obfuscatedExternalProfileId`) и возвращает серверу — именно это закрыло
    // 2026-10-10 дыру «убили процесс после оплаты, приложение забыло номер,
    // деньги списаны, тариф не поставлен». У Apple такого поля нет вовсе, а
    // `appAccountToken` обязан быть UUID: ни наш uid, ни номер объявления в него
    // не влезают. Поэтому UUID — ключ к записи, а номер лежит у нас.
    let intentPropertyId = '';
    let intentUserId = '';
    if (tx.appAccountToken) {
      const intentSnap = await admin
        .firestore()
        .collection(INTENTS)
        .doc(tx.appAccountToken.toLowerCase())
        .get();
      const intent = intentSnap.data();
      if (intent) {
        intentPropertyId = (intent.propertyId as string | undefined) ?? '';
        intentUserId = (intent.userId as string | undefined) ?? '';
      } else {
        // Не повод отказывать: ниже ещё есть слово приложения. Но видеть это
        // надо — либо запись не доехала, либо пришла чужая квитанция.
        console.warn('[Apple] Намерение не найдено:', tx.appAccountToken);
      }
    }

    // Чужую покупку к себе не применить даже с настоящей подписью.
    if (intentUserId && intentUserId !== context.auth.uid) {
      console.error('[Apple] Покупка принадлежит другому человеку:', tx.transactionId);
      throw new functions.https.HttpsError('permission-denied', 'Purchase belongs to another user');
    }

    const targetPropertyId = intentPropertyId || propertyIdFromApp;
    if (!targetPropertyId) {
      console.error('[Apple] К покупке не привязано объявление:', tx.transactionId);
      throw new functions.https.HttpsError('invalid-argument', 'No property for this purchase');
    }

    // Объявление должно существовать и принадлежать покупателю: подпись
    // доказывает оплату, но не право поднять именно это объявление.
    const propertyRef = admin.firestore().collection('properties').doc(targetPropertyId);
    const propertySnap = await propertyRef.get();
    if (!propertySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Property not found');
    }
    if (propertySnap.data()?.ownerId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your property');
    }

    // Защёлка от повтора. Номер покупки у Apple свой у каждой покупки — он и
    // ключ. `create` падает на занятом документе, и это единственный способ
    // занять его без состязания: два одновременных вызова оба создать не смогут.
    const claimRef = admin.firestore().collection('applePurchases').doc(tx.transactionId);

    /** Заняли ли номер ЭТИМ вызовом. Нет — разбираем прошлую попытку. */
    let claimed = false;

    try {
      await claimRef.create({
        propertyId: targetPropertyId,
        userId: context.auth.uid,
        productId: tx.productId,
        kind: boost ? 'boost' : 'tier',
        ...(boost
          ? {boostCount: boost.count}
          : {tier: product.tier, duration: product.duration}),
        originalTransactionId: tx.originalTransactionId,
        appAccountToken: tx.appAccountToken,
        // ⚠️ Отметка «применено» ставится ПОСЛЕ применения. Занятый номер сам по
        // себе не значит, что человек получил оплаченное: между занятием и
        // применением функция может умереть.
        applied: false,
        // Песочная покупка — это проверка App Review или наш тест. Метим, чтобы
        // не попала в выручку при разборе платежей.
        isTestPurchase: tx.isSandbox,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      claimed = true;
    } catch (err) {
      const existing = await claimRef.get();
      if (!existing.exists) throw err;

      const claim = existing.data() ?? {};

      // Признак выданного — не сама запись, а СЛЕД выдачи: дата окончания у
      // тарифа, дата подъёма у подъёма.
      const wasApplied =
        claim.applied === true || Boolean(claim.expiryDate) || Boolean(claim.boostedAt);

      if (wasApplied) {
        return {
          alreadyApplied: true,
          kind: (claim.kind as string | undefined) ?? 'tier',
          expiryDate: (claim.expiryDate as string | undefined) ?? '',
          remaining: (claim.remaining as number | undefined) ?? 0,
        };
      }

      // Номер занят, а оплаченное не выдано. Доводим до конца тем же путём, что
      // свежую покупку: повторное применение в худшем случае прибавит лишний
      // день, невыданное — отнимает деньги. Ошибаемся в сторону покупателя.
      console.error(
        '[Apple] Квитанция занята, но покупка НЕ применена — доводим до конца:',
        tx.transactionId
      );
    }

    // Запись в журнал платежей — одна на покупку. Разбирая прошлую попытку,
    // смотрим, не попала ли она туда: иначе одна покупка посчиталась бы выручкой
    // дважды.
    let paymentLogged = false;
    if (!claimed) {
      const logged = await admin
        .firestore()
        .collection('payments')
        .where('transactionId', '==', tx.transactionId)
        .limit(1)
        .get();
      paymentLogged = !logged.empty;
    }

    const paymentBase = {
      propertyId: targetPropertyId,
      userId: context.auth.uid,
      provider: 'app_store',
      productId: tx.productId,
      transactionId: tx.transactionId,
      originalTransactionId: tx.originalTransactionId,
      isTestPurchase: tx.isSandbox,
      status: 'completed',
      // ⚠️ Сумма приходит в МИЛЛИЕДИНИЦАХ: 9.99 приедет числом 9990. Делим на
      // тысячу, иначе в журнале появятся тысячи манатов. У записей Google суммы
      // нет вовсе — это их известный долг, здесь он не повторён.
      ...(typeof tx.priceMilliunits === 'number'
        ? {amount: tx.priceMilliunits / 1000, currency: tx.currency ?? ''}
        : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (boost) {
      // Подъём применяется БЕЗ проверки тарифа и статуса объявления: деньги уже
      // списаны, и отказ оставил бы человека и без подъёма, и без денег до
      // возврата. Та же причина, что у Google.
      const {boostedAt, remaining} = await applyBoostPackage({
        propertyId: targetPropertyId,
        count: boost.count,
        ownerId: context.auth.uid,
        source: 'app_store',
      });

      await claimRef.update({applied: true, boostedAt, remaining});

      if (!paymentLogged) {
        await admin.firestore().collection('payments').add({
          ...paymentBase,
          kind: 'boost',
          boostCount: boost.count,
        });
      }

      return {alreadyApplied: false, kind: 'boost', expiryDate: '', remaining};
    }

    const {expiryDate, status, applied} = await applyPaidTier({
      propertyId: targetPropertyId,
      tier: product.tier,
      duration: product.duration,
    });

    // ⚠️ Объявление исчезло между проверкой выше и применением. Отвечаем
    // ОТКАЗОМ намеренно: приложение на отказ товар не подтверждает, и Apple
    // вернёт деньги сама — лучший доступный исход, когда поднимать стало нечего.
    // Отметку «применено» не ставим: повтор придёт сюда же и снова откажет.
    if (!applied) {
      console.error('[Apple] Объявление исчезло до применения тарифа:', targetPropertyId);
      throw new functions.https.HttpsError(
        'not-found',
        'Property disappeared before the tier was applied'
      );
    }

    await claimRef.update({applied: true, expiryDate, appliedStatus: status});

    if (!paymentLogged) {
      await admin.firestore().collection('payments').add({
        ...paymentBase,
        kind: 'tier',
        tier: product.tier,
        duration: product.duration,
      });
    }

    return {alreadyApplied: false, kind: 'tier', expiryDate, status, remaining: 0};
  });
