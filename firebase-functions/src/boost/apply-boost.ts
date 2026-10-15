import {admin} from '../firebase-admin';

/**
 * Применение оплаченного подъёма к объявлению.
 *
 * Рядом с `applyPaidTier` и по той же причине: касс две — карта через Azericard
 * на сайте и Google Play в приложении, — а следствие одно. Сюда не передаётся
 * ничего про способ оплаты: кто и чем заплатил, проверяет вызывающая сторона.
 *
 * ⚠️ **Отказывать здесь по смыслу нельзя — деньги уже списаны.** Проверка, что
 * объявление вообще стоит поднимать (на витрине, не черновик, не ждёт
 * модерации), обязана быть ДО оплаты: в `initiatePayment` на сайте и в скрытой
 * кнопке приложения. Здесь только применяем то, за что заплатили.
 */

/** Пакеты подъёма. ⚠️ Копия `BoostPackage` из `core/src/data/pricing.ts`. */
export type BoostPackage = 1 | 3 | 5 | 10;

export function isBoostPackage(value: unknown): value is BoostPackage {
  return value === 1 || value === 3 || value === 5 || value === 10;
}

/** Коллекция со счётчиками незакончившихся пакетов. Ключ — номер объявления. */
export const BOOSTS = 'boosts';

/**
 * Поднимает объявление сейчас же и запоминает остаток пакета.
 *
 * Первый подъём делается сразу, а не следующей ночью: человек заплатил и хочет
 * увидеть своё объявление наверху немедленно. Поэтому в счётчик уходит `count
 * - 1`, и у одиночного пакета записи не появляется вовсе — её нечему было бы
 * расходовать.
 *
 * Повторная покупка **прибавляется** к остатку, а не заменяет его. Ровно на
 * этом месте `applyPaidTier` поступает иначе — стирает дату прежнего тарифа, —
 * и из-за этого Premium нельзя предлагать VIP. Здесь такой ловушки быть не
 * должно: оплаченные подъёмы не сгорают.
 *
 * @returns сколько подъёмов осталось после этого и момент подъёма.
 */
export async function applyBoostPackage(params: {
  propertyId: string;
  count: BoostPackage;
  ownerId: string;
  source: 'azericard' | 'google_play';
}): Promise<{boostedAt: string; remaining: number}> {
  const {propertyId, count, ownerId, source} = params;
  const db = admin.firestore();
  const boostedAt = new Date().toISOString();
  const remainingFromThis = count - 1;

  const propertyRef = db.collection('properties').doc(propertyId);
  const boostRef = db.collection(BOOSTS).doc(propertyId);

  // Одной транзакцией: два одновременных платежа по одному объявлению иначе
  // прочитали бы один и тот же остаток и записали бы его дважды — человек
  // потерял бы оплаченный пакет.
  const remaining = await db.runTransaction(async (tx) => {
    const [existing, property] = await Promise.all([tx.get(boostRef), tx.get(propertyRef)]);

    // Объявление исчезло между оплатой и этим мгновением — владелец удалил его,
    // пока открыта страница банка. Поднимать нечего.
    //
    // ⚠️ Бросать здесь НЕЛЬЗЯ, хотя рука тянется: колбэк банка тогда ответит
    // пятисотой, платёж навсегда останется в `awaiting_payment`, а человек с
    // уже списанной картой увидит страницу ошибки. Громкая запись в журнал
    // полезнее: по ней деньги возвращают через кабинет Azericard, как и все
    // возвраты на этой площадке.
    if (!property.exists) {
      console.error(`[Boost] ОБЪЯВЛЕНИЕ ИСЧЕЗЛО до применения подъёма: ${propertyId}, пакет ${count}, владелец ${ownerId} — нужен возврат`);
      return 0;
    }

    const previous = existing.exists ? Number(existing.data()?.remaining ?? 0) : 0;
    const left = Math.max(0, previous) + remainingFromThis;

    // Дату подъёма пишем ВСЕГДА, даже поверх действующего подъёма: срок окна
    // считается от последней даты, и человек покупает в том числе его продление.
    tx.update(propertyRef, {boostedAt});

    if (left <= 0) {
      // Расходовать нечего. Запись не создаём и чужую не трогаем.
      return 0;
    }

    if (existing.exists) {
      tx.update(boostRef, {
        remaining: left,
        total: Number(existing.data()?.total ?? 0) + count,
        lastBumpAt: boostedAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(boostRef, {
        propertyId,
        ownerId,
        remaining: left,
        total: count,
        source,
        lastBumpAt: boostedAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return left;
  });

  console.log(`[Boost] ${propertyId}: поднято, пакет ${count}, осталось ${remaining}`);
  return {boostedAt, remaining};
}

/**
 * Снимает подъём и остаток пакета — после возврата денег.
 *
 * Рядом с `revokePaidTier` и по той же причине: возврат денег обязан забирать
 * оплаченное, иначе человек возвращает себе деньги и оставляет услугу.
 *
 * ⚠️ `boostedAt` УДАЛЯЕТСЯ, а не затирается пустой строкой. Лента сайта отбирает
 * поднятые по **наличию** поля (`orderBy` молча выбрасывает документы без него),
 * и пустая строка оставила бы объявление в этой выборке — то есть на главной,
 * среди закреплённых, уже без всякого подъёма.
 *
 * Уже израсходованные дни подъёма вернуть нельзя: они прошли. Забираем то, что
 * ещё не израсходовано, — это всё, что в наших силах.
 *
 * @returns сколько подъёмов было отобрано из остатка.
 */
export async function revokeBoostPackage(params: {
  propertyId: string;
  reason: string;
}): Promise<number> {
  const {propertyId, reason} = params;
  const db = admin.firestore();

  const propertyRef = db.collection('properties').doc(propertyId);
  const boostRef = db.collection(BOOSTS).doc(propertyId);

  const taken = await db.runTransaction(async (tx) => {
    const [property, existing] = await Promise.all([tx.get(propertyRef), tx.get(boostRef)]);

    const left = existing.exists ? Number(existing.data()?.remaining ?? 0) : 0;

    if (property.exists) {
      tx.update(propertyRef, {boostedAt: admin.firestore.FieldValue.delete()});
    }
    if (existing.exists) {
      tx.delete(boostRef);
    }

    return left;
  });

  console.log(`[Boost] Подъём снят у ${propertyId}: отобрано ${taken}, причина — ${reason}`);
  return taken;
}
