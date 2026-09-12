import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

import {applyPaidTier} from './apply-tier';
import {fetchPlayPurchase, isPurchased, PLAY_PRODUCTS} from './google-play';

/**
 * Покупка тарифа из мобильного приложения.
 *
 * Приложение платит через Google Play и присылает сюда `purchaseToken`. Мы
 * спрашиваем у Google, настоящая ли покупка, и только тогда ставим тариф —
 * той же функцией `applyPaidTier`, которой пользуется возврат от Azericard.
 * Состояние объявления одно, касс две.
 *
 * Почему вызываемая функция, а не маршрут на сайте (как `/api/property/comments`
 * и `/ratings`): там проверка ID-токена написана руками, потому что приложению
 * нужен доступ к общей логике, живущей в вебе. Здесь наоборот — нужна та самая
 * `applyPaidTier`, которая живёт в функциях рядом с Azericard, а вызываемая
 * функция проверяет вошедшего сама, без отдельного разбора заголовка.
 *
 * Чего эта функция НЕ делает: не подтверждает покупку в магазине. Подтверждение
 * (acknowledge) происходит, когда приложение расходует товар вызовом
 * `finishTransaction({isConsumable: true})` — расход и есть подтверждение. Это
 * важная страховка: пока мы не ответили успехом, приложение товар не расходует,
 * и если наша проверка сломается, Google через три дня вернёт человеку деньги
 * сам. Подтверждать здесь значило бы снять эту страховку.
 */
export const verifyPlayPurchase = functions
  .region('europe-west1')
  .https.onCall(async (data: unknown, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const payload = (data ?? {}) as {
      purchaseToken?: unknown;
      productId?: unknown;
      propertyId?: unknown;
    };
    const purchaseToken = typeof payload.purchaseToken === 'string' ? payload.purchaseToken : '';
    const productId = typeof payload.productId === 'string' ? payload.productId : '';
    const propertyId = typeof payload.propertyId === 'string' ? payload.propertyId : '';

    if (!purchaseToken || !productId || !propertyId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const product = PLAY_PRODUCTS[productId];
    if (!product) {
      // Товар, которого мы не знаем. Значит в Play Console он заведён под другим
      // именем, чем в PLAY_PRODUCTS, — деньги списаны, а что продали, неясно.
      // Такое надо видеть в журнале, а не молча глотать.
      console.error('[Play] Unknown productId:', productId);
      throw new functions.https.HttpsError('invalid-argument', 'Unknown product');
    }

    // Спрашиваем Google ДО любых записей: проверка побочных действий не имеет,
    // и начинать с неё дешевле, чем откатывать начатое.
    let purchase;
    try {
      purchase = await fetchPlayPurchase(productId, purchaseToken);
    } catch (err) {
      // До Google не дошли — это наша беда, не покупателя. Отвечаем «попробуйте
      // ещё», а не «покупки нет»: товар не расходован, повтор пройдёт.
      console.error('[Play] Verification request failed:', err);
      throw new functions.https.HttpsError('unavailable', 'Could not verify with Google Play');
    }

    if (!purchase) {
      console.warn('[Play] Unknown purchase token for product:', productId);
      throw new functions.https.HttpsError('not-found', 'Purchase not found');
    }
    if (!isPurchased(purchase)) {
      // Ожидающий платёж сюда тоже попадает: у Google покупка может висеть в
      // состоянии «ждём оплаты», например при оплате наличными в магазине.
      // Тариф по ней ставить нельзя — деньги ещё не пришли.
      throw new functions.https.HttpsError('failed-precondition', 'Purchase not completed');
    }

    // Кто покупал. Приложение привязало свою учётную запись к покупке до оплаты,
    // и Google вернул привязку нам — значит чужую покупку к себе не применить
    // даже с настоящим токеном.
    if (
      purchase.obfuscatedExternalAccountId &&
      purchase.obfuscatedExternalAccountId !== context.auth.uid
    ) {
      console.error('[Play] Purchase belongs to another account:', purchase.orderId);
      throw new functions.https.HttpsError('permission-denied', 'Purchase belongs to another user');
    }

    // К какому объявлению применять. Слову приложения верим только если привязки
    // нет — она появилась позже самой покупки и у старых записей её может не
    // быть. Когда есть, она главнее: её не подделать на устройстве.
    const targetPropertyId = purchase.obfuscatedExternalProfileId || propertyId;

    // Объявление должно существовать и принадлежать покупателю. Токен покупки
    // доказывает факт оплаты, но не право поднять именно это объявление.
    const propertyRef = admin.firestore().collection('properties').doc(targetPropertyId);
    const propertySnap = await propertyRef.get();
    if (!propertySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Property not found');
    }
    if (propertySnap.data()?.ownerId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your property');
    }

    // Защита от повтора. Токен покупки — естественный ключ: он у каждой покупки
    // свой. `create` падает, если документ уже есть, и это единственный способ
    // занять его без состязания: два одновременных вызова не смогут оба создать.
    //
    // Повтор не ошибка и не мошенничество: приложение могли закрыть до ответа, и
    // оно честно пришлёт тот же токен снова. Поэтому отвечаем успехом с
    // прошлым результатом, а не отказом.
    const claimRef = admin.firestore().collection('playPurchases').doc(purchaseToken);
    try {
      await claimRef.create({
        propertyId: targetPropertyId,
        userId: context.auth.uid,
        productId,
        tier: product.tier,
        duration: product.duration,
        orderId: purchase.orderId ?? '',
        // Тестовая покупка из лицензионного теста помечается, чтобы её не
        // приняли за выручку при разборе платежей.
        isTestPurchase: purchase.purchaseType === 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const existing = await claimRef.get();
      if (existing.exists) {
        return {
          alreadyApplied: true,
          expiryDate: (existing.data()?.expiryDate as string | undefined) ?? '',
        };
      }
      throw err;
    }

    const {expiryDate, status} = await applyPaidTier({
      propertyId: targetPropertyId,
      tier: product.tier,
      duration: product.duration,
    });

    await claimRef.update({expiryDate, appliedStatus: status});

    // Запись в общий журнал платежей — тот же, куда пишет Azericard. Иначе
    // выручка из приложения не видна там, где её ищут.
    await admin.firestore().collection('payments').add({
      propertyId: targetPropertyId,
      userId: context.auth.uid,
      tier: product.tier,
      duration: product.duration,
      provider: 'google_play',
      productId,
      orderId: purchase.orderId ?? '',
      purchaseToken,
      isTestPurchase: purchase.purchaseType === 0,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {alreadyApplied: false, expiryDate, status};
  });
