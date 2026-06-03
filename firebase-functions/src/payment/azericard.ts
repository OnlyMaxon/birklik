import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const AZERICARD_URL_TEST = 'https://213.172.75.248/cgi-bin/cgi_link';
const AZERICARD_URL_PROD = 'https://mpi.azericard.com/cgi-bin/cgi_link'; // Уточнить у Azericard

const MERCH_NAME = 'Birklik.az';
const MERCH_URL = 'https://birklik.az';
const MERCH_EMAIL = 'info@birklik.az';
const COUNTRY = 'AZ';
const MERCH_GMT = '+4';
const CURRENCY = '944'; // AZN

const TIER_PRICES: Record<string, Record<string, number>> = {
  vip: { '14days': 20, '30days': 30 },
  premium: { '14days': 30, '30days': 55 },
};

// MAC source: конкатенация "длина+значение" для каждого поля
// Если значение пустое — добавляется "-" (по документации Azericard)
function buildMacSource(fields: string[], params: Record<string, string>): string {
  return fields.map(field => {
    const val = params[field] ?? '';
    return val === '' ? '-' : `${val.length}${val}`;
  }).join('');
}

function signWithPrivateKey(macSource: string, privateKeyPem: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(macSource, 'utf8');
  return sign.sign(privateKeyPem, 'hex').toUpperCase();
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
    return verify.verify(publicKeyPem, psign, 'hex');
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
  // Минимум 6 символов по требованию Azericard
  return Date.now().toString().slice(-8);
}

function getExpiryDate(duration: string): string {
  const d = new Date();
  d.setDate(d.getDate() + (duration === '14days' ? 14 : 30));
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// =========================================================
// FUNCTION 1: initiatePayment
// Вызывается с фронтенда после валидации формы.
// Создаёт запись о платеже и возвращает параметры для
// редиректа на страницу оплаты Azericard.
// =========================================================
export const initiatePayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { propertyId, tier, duration } = data as {
      propertyId: string;
      tier: 'vip' | 'premium';
      duration: '14days' | '30days';
    };

    if (!propertyId || !tier || !duration) {
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

    const amount = TIER_PRICES[tier]?.[duration];
    if (!amount) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid tier or duration');
    }

    const privateKey = process.env.AZERICARD_PRIVATE_KEY;
    const terminal = process.env.AZERICARD_TERMINAL;
    const callbackUrl = process.env.AZERICARD_CALLBACK_URL;

    if (!privateKey || !terminal || !callbackUrl) {
      throw new functions.https.HttpsError('internal', 'Payment not configured');
    }

    const orderId = generateOrderId();
    const timestamp = generateTimestamp();
    const nonce = generateNonce();
    const tierLabel = tier === 'premium' ? 'Premium' : 'VIP';
    const daysLabel = duration === '14days' ? '14 gun' : '30 gun';

    const params: Record<string, string> = {
      AMOUNT: amount.toFixed(2),
      CURRENCY,
      ORDER: orderId,
      DESC: `Birklik.az ${tierLabel} - ${daysLabel}`,
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
    };

    const macFields = [
      'AMOUNT', 'ORDER', 'CURRENCY', 'TERMINAL', 'MERCH_NAME',
      'MERCH_URL', 'COUNTRY', 'MERCH_GMT', 'TIMESTAMP', 'NONCE', 'BACKREF',
    ];
    params.P_SIGN = signWithPrivateKey(buildMacSource(macFields, params), privateKey);

    // Сохраняем запись о платеже
    await admin.firestore().collection('payments').add({
      propertyId,
      userId: context.auth.uid,
      tier,
      duration,
      amount,
      orderId,
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
  .https.onRequest(async (req, res) => {
    const frontendBase = 'https://birklik.az';

    if (req.method !== 'POST') {
      res.redirect(`${frontendBase}/dashboard`);
      return;
    }

    const body = req.body as Record<string, string>;
    const { ORDER, ACTION, RC, APPROVAL, RRN, INT_REF, AMOUNT, TERMINAL, P_SIGN } = body;

    // Верификация подписи Azericard
    // TODO: раскомментировать когда получим публичный ключ от Azericard
    // const azericardPublicKey = process.env.AZERICARD_PUBLIC_KEY;
    // if (azericardPublicKey) {
    //   const cbFields = ['AMOUNT', 'TERMINAL', 'APPROVAL', 'RRN', 'INT_REF'];
    //   const isValid = verifyWithPublicKey(cbFields, { AMOUNT, TERMINAL, APPROVAL, RRN, INT_REF }, P_SIGN, azericardPublicKey);
    //   if (!isValid) {
    //     console.error('[Azericard] Invalid P_SIGN for ORDER:', ORDER);
    //     res.redirect(`${frontendBase}/dashboard?payment=error`);
    //     return;
    //   }
    // }

    // Подавляем предупреждение о неиспользуемых переменных до раскомментирования
    void P_SIGN; void TERMINAL;

    if (!ORDER) {
      res.redirect(`${frontendBase}/dashboard?payment=error`);
      return;
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

    // ACTION=0 и RC=00 означает успешный платёж
    if (ACTION === '0' && RC === '00') {
      const expiryDate = getExpiryDate(payment.duration);

      await admin.firestore().collection('properties').doc(payment.propertyId).update({
        status: 'pending', // Отправляем на модерацию
        listingTier: payment.tier,
        ...(payment.tier === 'premium' ? {
          isFeatured: true,
          premiumExpiresAt: expiryDate,
        } : {}),
        ...(payment.tier === 'vip' ? {
          isFeatured: false,
          vipExpiresAt: expiryDate,
        } : {}),
      });

      await paymentDoc.ref.update({
        status: 'completed',
        approval: APPROVAL ?? '',
        rrn: RRN ?? '',
        intRef: INT_REF ?? '',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.redirect(`${frontendBase}/dashboard?payment=success`);
    } else {
      console.warn('[Azericard] Payment failed. ORDER:', ORDER, 'ACTION:', ACTION, 'RC:', RC);

      await paymentDoc.ref.update({
        status: 'failed',
        rc: RC ?? '',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Удаляем черновик объявления
      await admin.firestore().collection('properties').doc(payment.propertyId).delete();

      res.redirect(`${frontendBase}/dashboard?payment=failed`);
    }
  });
