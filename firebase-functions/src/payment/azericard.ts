import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';
import {applyPaidTier, revokePaidTier} from './apply-tier';
import {
  applyBoostPackage,
  isBoostPackage,
  revokeBoostPackage,
  type BoostPackage,
} from '../boost/apply-boost';
import * as crypto from 'crypto';

const AZERICARD_URL_TEST = 'https://testmpi.3dsecure.az/cgi-bin/cgi_link';
const AZERICARD_URL_PROD = 'https://mpi.3dsecure.az/cgi-bin/cgi_link';

const MERCH_NAME = 'Birklik.az';
const MERCH_URL = 'https://birklik.az';
const MERCH_EMAIL = 'info@birklik.az';
const COUNTRY = 'AZ';
const MERCH_GMT = '+4';
const CURRENCY = 'AZN';

/**
 * ⚠️ КОПИЯ. Источник — `TIER_PRICES` в `core/src/data/pricing.ts`, оттуда же
 * берут цену сайт и приложение. Импортировать сюда нельзя: функции собираются
 * отдельным пакетом и подмодуль `core` в сборку не тянут.
 *
 * **Меняя цену, править оба места.** По этим числам банк берёт настоящие
 * деньги; расхождение выглядит как «на экране одна сумма, списали другую».
 */
const TIER_PRICES: Record<string, Record<string, number>> = {
  vip: { '14days': 20, '30days': 30 },
  premium: { '14days': 30, '30days': 55 },
};

/**
 * ⚠️ КОПИЯ. Источник — `BOOST_PRICES` в `core/src/data/pricing.ts`, оттуда же
 * берёт цену сайт. Причина копии та же, что выше. **Меняя цену, править оба
 * места.**
 */
const BOOST_PRICES: Record<number, number> = { 1: 2, 3: 5, 5: 8, 10: 15 };

// MAC source: конкатенация "длина+значение" для каждого поля
// Если значение пустое — добавляется "-" (по документации Azericard)
function buildMacSource(fields: string[], params: Record<string, string>): string {
  return fields.map(field => {
    const val = params[field] ?? '';
    return val === '' ? '-' : `${val.length}${val}`;
  }).join('');
}

function normalizePem(pem: string): string {
  // Firebase secrets may store newlines as literal \n — convert to real newlines
  return pem.replace(/\\n/g, '\n');
}

function signWithPrivateKey(macSource: string, privateKeyPem: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(macSource, 'utf8');
  return sign.sign(normalizePem(privateKeyPem), 'hex');
}

function verifyWithPublicKey(
  fields: string[],
  params: Record<string, string>,
  psign: string,
  publicKeyPem: string
): boolean {
  try {
    const macSource = buildMacSource(fields, params);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(macSource, 'utf8');
    return verify.verify(normalizePem(publicKeyPem), psign, 'hex');
  } catch {
    return false;
  }
}

function generateTimestamp(): string {
  const now = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function generateNonce(): string {
  return crypto.randomBytes(8).toString('hex');
}

function generateOrderId(): string {
  // Cryptographically random 8-digit numeric ID — no timestamp cycle collisions
  return (crypto.randomBytes(4).readUInt32BE(0) % 100000000).toString().padStart(8, '0');
}

async function deleteDraftWithImages(propertyId: string): Promise<void> {
  try {
    const propDoc = await admin.firestore().collection('properties').doc(propertyId).get();
    if (!propDoc.exists) return;

    // Удаляется ТОЛЬКО черновик — объявление, которое до оплаты не существовало
    // как публикация. Всё остальное при неудачной оплате трогать нельзя: оно
    // живёт само по себе, а оплата лишь меняла тариф.
    //
    // Прежде вызов был обвязан условием `!payment.isUpgrade`, а `isUpgrade`
    // считался как «status === 'active'» ещё на этапе initiatePayment. Пока
    // истечение тарифов не работало, скрытых объявлений просто не бывало и это
    // сходило с рук. С появлением расписания expirePaidTiers статус `inactive`
    // стал обычным делом — и неудачная попытка продлить такое объявление снесла
    // бы его вместе с фотографиями.
    const status = propDoc.data()?.status;
    if (status !== 'draft') {
      console.warn(`[Azericard] Skip delete of ${propertyId}: status is '${status}', not a draft`);
      return;
    }

    const images: string[] = propDoc.data()?.images || [];
    await propDoc.ref.delete();
    const bucket = admin.storage().bucket();
    for (const url of images) {
      try {
        const match = url.match(/\/o\/(.+?)\?/);
        if (!match) continue;
        await bucket.file(decodeURIComponent(match[1])).delete();
      } catch { /* файл уже удалён */ }
    }
  } catch (error) {
    console.error('[Azericard] Failed to delete draft property:', propertyId, error);
  }
}

/**
 * Действует ли у объявления платный тариф прямо сейчас.
 *
 * ⚠️ Копия правила `isTierActive` из `core/src/utils/premium-helper.ts`:
 * подмодуль `core` в сборку функций не тянут. Нужна и тариф, и непросроченная
 * дата — платный тариф без даты действующим не считается.
 */
function hasActivePaidTier(data: Record<string, unknown>): boolean {
  const tier = data.listingTier;
  if (tier !== 'vip' && tier !== 'premium') return false;
  const raw = (tier === 'vip' ? data.vipExpiresAt : data.premiumExpiresAt) as string | undefined;
  if (!raw) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const parsed = new Date(normalized);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
}

// =========================================================
// FUNCTION 1: initiatePayment
// Вызывается с фронтенда после валидации формы.
// Создаёт запись о платеже и возвращает параметры для
// редиректа на страницу оплаты Azericard.
// =========================================================
export const initiatePayment = functions
  .region('europe-west1')
  .runWith({ secrets: ['AZERICARD_PRIVATE_KEY', 'AZERICARD_TERMINAL', 'AZERICARD_CALLBACK_URL', 'AZERICARD_ENV'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { propertyId, tier, duration, kind, boostCount } = data as {
      propertyId: string;
      tier?: 'vip' | 'premium';
      duration?: '14days' | '30days';
      /**
       * Что покупают. Отсутствие означает тариф: так зовёт эта функция с 2025
       * года, и открытая в браузере страница может быть старее сегодняшней
       * выкладки.
       */
      kind?: 'tier' | 'boost';
      boostCount?: number;
    };

    const isBoost = kind === 'boost';

    if (!propertyId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    if (!isBoost && (!tier || !duration)) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Проверяем что объявление принадлежит пользователю
    const propertySnap = await admin.firestore().collection('properties').doc(propertyId).get();
    if (!propertySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Property not found');
    }
    if (propertySnap.data()!.ownerId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your property');
    }

    let amount: number | undefined;

    if (isBoost) {
      if (!isBoostPackage(boostCount)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid boost package');
      }

      // ⚠️ Здесь единственное место, где подъём можно ОТКАЗАТЬ, не теряя чужих
      // денег. После оплаты `applyBoostPackage` применяет что заплатили и
      // отказывать уже не вправе.
      //
      // Поднимать можно только то, что стоит на витрине: у черновика, ждущего
      // модерации и скрытого объявления подъём сгорел бы впустую — его сутки
      // истекли бы раньше, чем объявление кого-то увидит.
      const target = propertySnap.data() ?? {};
      if (target.status !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'Listing is not on display');
      }
      if (hasActivePaidTier(target)) {
        // VIP и Premium и так стоят выше всех обычных. Подъём внутри своей
        // полосы код поддерживает, но продавать его платному тарифу мы не
        // договаривались — кнопки у него нет, значит и платежа быть не должно.
        throw new functions.https.HttpsError('failed-precondition', 'Paid tier ranks above standard already');
      }

      amount = BOOST_PRICES[boostCount];
    } else {
      amount = TIER_PRICES[tier!]?.[duration!];
    }

    if (!amount) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid tier or duration');
    }

    const privateKey = process.env.AZERICARD_PRIVATE_KEY?.trim();
    const terminal = process.env.AZERICARD_TERMINAL?.trim();
    const callbackUrl = process.env.AZERICARD_CALLBACK_URL?.trim();

    if (!privateKey || !terminal || !callbackUrl) {
      throw new functions.https.HttpsError('internal', 'Payment not configured');
    }

    const orderId = generateOrderId();
    const timestamp = generateTimestamp();
    const nonce = generateNonce();
    const tierLabel = tier === 'premium' ? 'Premium' : 'VIP';
    const daysLabel = duration === '14days' ? '14 gun' : '30 gun';
    // Описание видно человеку в выписке по карте, поэтому пишется латиницей без
    // диакритики: банк не обещает в этом поле ничего, кроме ASCII.
    const description = isBoost
      ? `Birklik.az Boost - ${boostCount} defe`
      : `Birklik.az ${tierLabel} - ${daysLabel}`;

    const params: Record<string, string> = {
      AMOUNT: amount.toFixed(2),
      CURRENCY,
      ORDER: orderId,
      DESC: description,
      TERMINAL: terminal,
      MERCH_NAME,
      MERCH_URL,
      EMAIL: MERCH_EMAIL,
      TRTYPE: '1',
      COUNTRY,
      MERCH_GMT,
      TIMESTAMP: timestamp,
      NONCE: nonce,
      BACKREF: callbackUrl,
      LANG: 'AZ',
    };

    // MAC fields per official Azericard auth-fin-RSA.php example
    const macFields = ['AMOUNT', 'CURRENCY', 'TERMINAL', 'TRTYPE', 'TIMESTAMP', 'NONCE', 'MERCH_URL'];
    const macSource = buildMacSource(macFields, params);
    params.P_SIGN = signWithPrivateKey(macSource, privateKey);

    const isUpgrade = propertySnap.data()?.status === 'active';

    // Сохраняем запись о платеже
    await admin.firestore().collection('payments').add({
      propertyId,
      userId: context.auth.uid,
      // Что именно куплено. У подъёма тарифа нет, у тарифа нет числа подъёмов —
      // по этому полю колбэк и решает, какую из двух функций применять.
      kind: isBoost ? 'boost' : 'tier',
      ...(isBoost ? { boostCount } : { tier, duration }),
      amount,
      orderId,
      // У подъёма всегда `true`: поднимают существующее объявление, и чистка
      // черновика при неудаче к нему не относится ни при каком исходе.
      isUpgrade: isBoost ? true : isUpgrade,
      status: 'awaiting_payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const isTest = process.env.AZERICARD_ENV !== 'production';
    return {
      paymentUrl: isTest ? AZERICARD_URL_TEST : AZERICARD_URL_PROD,
      params,
    };
  });

// =========================================================
// FUNCTION 2: azericardCallback
// Azericard после платежа POST-ит результат сюда через браузер.
// Проверяем подпись, обновляем объявление и редиректим пользователя.
// =========================================================
export const azericardCallback = functions
  .region('europe-west1')
  .runWith({ secrets: ['AZERICARD_PUBLIC_KEY'] })
  .https.onRequest(async (req, res) => {
    const frontendBase = 'https://birklik.az';

    // Azericard redirects via GET on user cancel — clean up draft and bail
    if (req.method !== 'POST') {
      const cancelOrder = (req.query.ORDER ?? req.query.order) as string | undefined;
      if (cancelOrder) {
        const snap = await admin.firestore()
          .collection('payments')
          .where('orderId', '==', cancelOrder)
          .where('status', '==', 'awaiting_payment')
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const payment = doc.data();
          if (!payment.isUpgrade) {
            await deleteDraftWithImages(payment.propertyId);
          }
          await doc.ref.update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        res.redirect(`${frontendBase}/dashboard?payment=failed`);
      } else {
        res.redirect(`${frontendBase}/dashboard`);
      }
      return;
    }

    const body = req.body as Record<string, string>;
    const { ORDER, ACTION, RC, APPROVAL, RRN, INT_REF, AMOUNT, TERMINAL, TRTYPE, P_SIGN } = body;

    if (!ORDER) {
      res.redirect(`${frontendBase}/dashboard?payment=error`);
      return;
    }

    // Возврат денег (TRTYPE=22).
    //
    // ⚠️ До 2026-10-15 эта ветка только метила платёж `reversed` и объявления НЕ
    // ТРОГАЛА — то есть человек возвращал себе деньги и оставлял себе тариф. Это
    // было известно и записано ещё 2026-08-09, когда удаляли `performReversal`:
    // «успешный возврат не понижал тариф объявления». Функцию убрали, а дыру
    // оставили. Теперь оплаченное забирается.
    //
    // ⚠️ Возврат, сделанный из кабинета банка, сюда скорее всего не приходит
    // вовсе — колбэк привязан к нашему `BACKREF`. Поэтому эта ветка не
    // единственная защита: ручной возврат придётся сопровождать ручным
    // понижением. Разбор показывает такие платежи — `pnpm payments:stuck`.
    if (TRTYPE === '22') {
      if (ACTION === '0' && RC === '00') {
        const reversalQuery = await admin.firestore()
          .collection('payments')
          .where('orderId', '==', ORDER)
          .where('status', '==', 'completed')
          .limit(1)
          .get();
        if (!reversalQuery.empty) {
          const doc = reversalQuery.docs[0];
          const reversed = doc.data();

          // Сначала забираем оплаченное, потом метим платёж. Обратный порядок
          // оставил бы «возвращено» на объявлении с живым тарифом, если отзыв
          // сорвётся, — а это ровно та дыра, которую закрываем.
          let revoked: string;
          if (reversed.kind === 'boost') {
            const taken = await revokeBoostPackage({
              propertyId: reversed.propertyId,
              reason: `возврат по заказу ${ORDER}`,
            });
            revoked = `подъём снят, отобрано ${taken}`;
          } else {
            const ok = await revokePaidTier({
              propertyId: reversed.propertyId,
              reason: `возврат по заказу ${ORDER}`,
            });
            revoked = ok ? 'тариф снят' : 'объявления уже нет';
          }

          await doc.ref.update({
            status: 'reversed',
            reversedAt: admin.firestore.FieldValue.serverTimestamp(),
            revokeResult: revoked,
          });
          console.log('[Azericard] Reversal success. ORDER:', ORDER, '—', revoked);
        } else {
          // Платежа в `completed` нет: либо возврат пришёл дважды, либо по
          // заказу, который мы не проводили. Второе — повод смотреть глазами.
          console.warn('[Azericard] Reversal: нет завершённого платежа по заказу', ORDER);
        }
        res.redirect(`${frontendBase}/dashboard?payment=reversed`);
      } else {
        console.warn('[Azericard] Reversal failed. ORDER:', ORDER, 'ACTION:', ACTION, 'RC:', RC);
        res.redirect(`${frontendBase}/dashboard?payment=reversal_failed`);
      }
      return;
    }

    // Верификация подписи Azericard (MPI public key) — только для успешных транзакций
    const azericardPublicKey = process.env.AZERICARD_PUBLIC_KEY;
    if (ACTION === '0' && RC === '00') {
      // Нечем проверить подпись — значит платёж не принимается.
      //
      // Прежнее условие включало проверку только при наличии ключа: пустой или
      // потерянный секрет молча превращал колбэк в «принимаю что угодно». Цена
      // такой оплошности высокая — свой ORDER пользователь знает, initiatePayment
      // возвращает его прямо в браузер, а адрес колбэка публичный.
      if (!azericardPublicKey) {
        console.error('[Azericard] AZERICARD_PUBLIC_KEY не задан — платёж не принимается. ORDER:', ORDER);
        res.redirect(`${frontendBase}/dashboard?payment=error`);
        return;
      }

      const cbFields = ['AMOUNT', 'TERMINAL', 'APPROVAL', 'RRN', 'INT_REF'];
      const cbParams = { AMOUNT, TERMINAL, APPROVAL: APPROVAL ?? '', RRN: RRN ?? '', INT_REF: INT_REF ?? '' };
      const macSource = buildMacSource(cbFields, cbParams);
      const normalizedKey = normalizePem(azericardPublicKey);

      console.log('[Azericard][DEBUG] ORDER:', ORDER);
      console.log('[Azericard][DEBUG] MAC source:', macSource);
      console.log('[Azericard][DEBUG] P_SIGN received (first 40):', P_SIGN?.substring(0, 40));
      console.log('[Azericard][DEBUG] P_SIGN length:', P_SIGN?.length);
      console.log('[Azericard][DEBUG] Key first line:', normalizedKey.split('\n')[0]);
      console.log('[Azericard][DEBUG] Key last line:', normalizedKey.split('\n').filter(Boolean).slice(-1)[0]);
      console.log('[Azericard][DEBUG] Key total lines:', normalizedKey.split('\n').filter(Boolean).length);

      const isValidHex = verifyWithPublicKey(cbFields, cbParams, P_SIGN, azericardPublicKey);
      console.log('[Azericard][DEBUG] Verify hex:', isValidHex);

      // Попробуем base64 на случай если банк шлёт в base64
      let isValidBase64 = false;
      try {
        const psignHex = Buffer.from(P_SIGN, 'base64').toString('hex');
        isValidBase64 = verifyWithPublicKey(cbFields, cbParams, psignHex, azericardPublicKey);
      } catch { /* не base64 */ }
      console.log('[Azericard][DEBUG] Verify base64→hex:', isValidBase64);

      if (!isValidHex && !isValidBase64) {
        console.error('[Azericard] Invalid P_SIGN on success for ORDER:', ORDER);
        res.redirect(`${frontendBase}/dashboard?payment=error`);
        return;
      }
    }

    // Ищем запись о платеже
    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('orderId', '==', ORDER)
      .where('status', '==', 'awaiting_payment')
      .limit(1)
      .get();

    if (paymentQuery.empty) {
      console.error('[Azericard] Payment record not found for ORDER:', ORDER);
      res.redirect(`${frontendBase}/dashboard?payment=error`);
      return;
    }

    const paymentDoc = paymentQuery.docs[0];
    const payment = paymentDoc.data();

    /** Деньги взяты, а выдать оказалось нечему. Ставится ниже, читается разбором. */
    let needsRefund = false;

    // ⚠️ Сумма из колбэка сверяется с той, что мы сами посчитали при создании
    // платежа. Подпись банка покрывает поле AMOUNT, так что подделать его нельзя
    // — но подпись доказывает лишь «банк это подписал», а не «банк провёл
    // столько, сколько мы просили». Расхождение означает, что тариф за
    // пятьдесят пять манат выдавался бы по проведённой сумме в один. Проверка
    // стоит один вызов Number и закрывает целый класс ошибок, включая наши
    // собственные — например разъехавшиеся копии прейскуранта.
    //
    // Сравнение с допуском в копейку: банк присылает «55.00», мы считаем 55.
    const expectedAmount = Number(payment.amount);
    const paidAmount = Number(AMOUNT);
    if (
      ACTION === '0' && RC === '00' &&
      Number.isFinite(expectedAmount) && Number.isFinite(paidAmount) &&
      Math.abs(paidAmount - expectedAmount) > 0.01
    ) {
      console.error(
        '[Azericard] СУММА НЕ СХОДИТСЯ. ORDER:', ORDER,
        'ждали:', expectedAmount, 'в колбэке:', paidAmount
      );
      await paymentDoc.ref.update({
        status: 'amount_mismatch',
        paidAmount,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.redirect(`${frontendBase}/dashboard?payment=error`);
      return;
    }

    // Тип операции только записываем в журнал, но НЕ отказываем по нему.
    // Запрос мы отправляем с TRTYPE=1, и всё остальное на успешном пути
    // неожиданно; но отказать живой оплате из-за незнакомого кода хуже, чем
    // применить её и увидеть странность в журнале.
    if (ACTION === '0' && RC === '00' && TRTYPE && TRTYPE !== '1') {
      console.warn('[Azericard] Неожиданный TRTYPE на успехе. ORDER:', ORDER, 'TRTYPE:', TRTYPE);
    }

    // ACTION=0 и RC=00 означает успешный платёж
    if (ACTION === '0' && RC === '00') {
      // Что применять, решает запись о платеже, а не параметры колбэка: банк
      // присылает только номер заказа и подпись, и ничего не знает про тарифы.
      if (payment.kind === 'boost') {
        // Число подъёмов перепроверяется, хотя писали его мы сами: запись могли
        // поправить руками в консоли, а по ней начисляется оплаченное.
        if (!isBoostPackage(payment.boostCount)) {
          console.error('[Azericard] Битое число подъёмов в платеже:', ORDER, payment.boostCount);
          res.redirect(`${frontendBase}/dashboard?payment=error`);
          return;
        }
        await applyBoostPackage({
          propertyId: payment.propertyId,
          count: payment.boostCount as BoostPackage,
          ownerId: payment.userId,
          source: 'azericard',
        });
      } else {
        // Тариф, срок и статус ставит общая функция: ровно то же делает покупка
        // через Google Play. Подпись банка проверена выше — это единственное, что
        // отличает два пути.
        const {applied} = await applyPaidTier({
          propertyId: payment.propertyId,
          tier: payment.tier,
          duration: payment.duration,
        });

        // ⚠️ Объявление исчезло между оплатой и колбэком. Деньги уже списаны,
        // отказывать поздно, бросать нельзя (платёж остался бы в
        // `awaiting_payment` навсегда). Платёж помечаем так, чтобы разбор его
        // нашёл: это кандидат на возврат, и решает человек.
        if (!applied) {
          needsRefund = true;
        }
      }

      await paymentDoc.ref.update({
        status: 'completed',
        approval: APPROVAL ?? '',
        rrn: RRN ?? '',
        intRef: INT_REF ?? '',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(needsRefund ? {applied: false, needsRefund: true} : {}),
      });

      // Подъём возвращаем на страницу объявления: там человек и нажимал кнопку,
      // и там же видно, что объявление поднято и сколько подъёмов осталось.
      // Тариф по-прежнему ведёт в кабинет — после оплаты черновика объявление
      // уходит на модерацию, и показывать его страницу рано.
      res.redirect(
        payment.kind === 'boost'
          ? `${frontendBase}/property/${payment.propertyId}?payment=success`
          : `${frontendBase}/dashboard?payment=success`
      );
    } else {
      console.warn('[Azericard] Payment failed. ORDER:', ORDER, 'ACTION:', ACTION, 'RC:', RC);

      await paymentDoc.ref.update({
        status: 'failed',
        rc: RC ?? '',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (!payment.isUpgrade) {
        await deleteDraftWithImages(payment.propertyId);
      }

      res.redirect(`${frontendBase}/dashboard?payment=failed`);
    }
  });


// FUNCTION 3 (performReversal, TRTYPE=22) удалена 2026-08-09.
// Пользовательского интерфейса у неё не было ни в одной ветке: админ-панель
// возврата убрали коммитом 8fabb3d, а функция осталась задеплоенной и вызываемой
// напрямую любым залогиненным пользователем. Проверки владельца в ней не было
// с самого начала (08c367b), и успешный возврат не понижал тариф объявления —
// то есть позволял вернуть деньги, сохранив premium.
// Возвраты делаются вручную через кабинет Azericard. Понадобится снова —
// восстанавливать сразу с проверкой isModerator() и понижением тарифа.
