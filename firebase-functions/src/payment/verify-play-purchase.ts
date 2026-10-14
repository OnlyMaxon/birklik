import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

import {applyPaidTier} from './apply-tier';
import {applyBoostPackage} from '../boost/apply-boost';
import {BOOST_PRODUCTS, fetchPlayPurchase, isPurchased, PLAY_PRODUCTS} from './google-play';

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
 *
 * ⚠️ Из страховки следует главное правило функции: **успехом отвечать только
 * когда оплаченное действительно выдано**. Приложение на успех расходует товар,
 * то есть подтверждает покупку, и возврат от Google становится невозможен. До
 * 2026-10-14 правило нарушалось — разбор занятого токена ниже.
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

    // ⚠️ `propertyId` здесь НЕ обязателен, и это важно. Приложение знает его,
    // пока живёт экран оплаты; если процесс убили между списанием и проверкой,
    // при следующем запуске оно забирает незавершённую покупку из магазина и
    // присылает её БЕЗ номера объявления — в памяти его уже нет. Требовать его
    // здесь значило бы отказывать как раз в том случае, ради которого повтор и
    // придуман: деньги списаны, а тариф не поставлен.
    //
    // Номер при этом не теряется: приложение привязало его к покупке до оплаты
    // (`obfuscatedProfileId`), и Google возвращает привязку нам. Её и берём
    // ниже. Отказываем, только если нет ни привязки, ни слова приложения.
    if (!purchaseToken || !productId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const product = PLAY_PRODUCTS[productId];
    const boost = BOOST_PRODUCTS[productId];
    if (!product && !boost) {
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
    if (!targetPropertyId) {
      // Ни привязки, ни номера от приложения. Такое возможно только у покупок
      // старше привязки; руками их разбирать по журналу, а не гадать здесь.
      console.error('[Play] No property bound to purchase:', purchase.orderId);
      throw new functions.https.HttpsError('invalid-argument', 'No property for this purchase');
    }

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

    /** Заняли ли токен ЭТИМ вызовом. Нет — значит разбираем прошлую попытку. */
    let claimed = false;

    try {
      await claimRef.create({
        propertyId: targetPropertyId,
        userId: context.auth.uid,
        productId,
        // Что куплено. У подъёма ступени и срока нет, у тарифа нет числа
        // подъёмов — поле `kind` отличает их и в этой записи, и в журнале
        // платежей, куда пишет ещё и Azericard.
        kind: boost ? 'boost' : 'tier',
        ...(boost
          ? {boostCount: boost.count}
          : {tier: product.tier, duration: product.duration}),
        orderId: purchase.orderId ?? '',
        // ⚠️ Отметка «применено» ставится ПОСЛЕ применения, а не здесь. Занятый
        // токен сам по себе не значит, что человек получил оплаченное: между
        // занятием и применением функция может умереть.
        applied: false,
        // Тестовая покупка из лицензионного теста помечается, чтобы её не
        // приняли за выручку при разборе платежей.
        isTestPurchase: purchase.purchaseType === 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      claimed = true;
    } catch (err) {
      const existing = await claimRef.get();
      if (!existing.exists) throw err;

      const claim = existing.data() ?? {};

      // ⚠️ ЗДЕСЬ БЫЛА ДЫРА, закрыта 2026-10-14. Прежний код на любой занятый
      // токен отвечал успехом — не глядя, применена покупка или нет.
      //
      // Последствие: если функция падала между занятием токена и
      // `applyPaidTier`, повтор от приложения получал «уже применено», и
      // приложение РАСХОДОВАЛО товар (`finishTransaction`). Расход — это
      // подтверждение покупки для Google, а с ним пропадает последняя
      // страховка: неподтверждённую покупку Google через три дня возвращает
      // сам. Деньги списаны, тариф не поставлен, возврата не будет.
      //
      // Признак применённого — не сама запись, а СЛЕД применения: дата
      // окончания у тарифа, дата подъёма у подъёма. По ним же узнаются записи,
      // сделанные до появления поля `applied`.
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

      // Токен занят, а оплаченное не выдано. Доводим до конца — ниже тот же
      // путь, что у свежей покупки. Повторное применение в худшем случае
      // прибавит лишний день или лишний подъём, невыданное — отнимает деньги.
      // Ошибаемся в сторону покупателя.
      console.error(
        '[Play] Чек занят, но покупка НЕ применена — доводим до конца:',
        purchase.orderId ?? purchaseToken
      );
    }

    // Запись в журнал платежей делается один раз на чек. Разбирая прошлую
    // попытку, проверяем, не попала ли она туда уже: иначе одна покупка
    // посчиталась бы выручкой дважды. Запрос по одному полю Firestore
    // индексирует сам, составной индекс не нужен.
    let paymentLogged = false;
    if (!claimed) {
      const logged = await admin
        .firestore()
        .collection('payments')
        .where('purchaseToken', '==', purchaseToken)
        .limit(1)
        .get();
      paymentLogged = !logged.empty;
    }

    // Общая часть журнала платежей — того же, куда пишет Azericard. Иначе
    // выручка из приложения не видна там, где её ищут.
    const paymentBase = {
      propertyId: targetPropertyId,
      userId: context.auth.uid,
      provider: 'google_play',
      productId,
      orderId: purchase.orderId ?? '',
      purchaseToken,
      isTestPurchase: purchase.purchaseType === 0,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (boost) {
      // Подъём применяется БЕЗ проверки тарифа и статуса объявления: деньги уже
      // списаны, и отказ здесь оставил бы человека и без подъёма, и без денег до
      // возврата от Google. Кнопка подъёма у платных тарифов скрыта, так что
      // сюда такой платёж попадает только гонкой — объявление стало VIP между
      // открытием окна оплаты и проверкой чека. Тогда подъём поднимет его внутри
      // полосы VIP: лишнего места это не даёт, Premium он не обгонит.
      const {boostedAt, remaining} = await applyBoostPackage({
        propertyId: targetPropertyId,
        count: boost.count,
        ownerId: context.auth.uid,
        source: 'google_play',
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

    const {expiryDate, status} = await applyPaidTier({
      propertyId: targetPropertyId,
      tier: product.tier,
      duration: product.duration,
    });

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
