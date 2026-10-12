import {admin} from '../firebase-admin';
import {BOOSTS} from './apply-boost';

/**
 * Ежедневный расход пакетов подъёма: по одному подъёму в сутки, пока счётчик не
 * кончится.
 *
 * Коллекция `boosts` маленькая по устройству — в ней лежат только НЕЗАКОНЧЕННЫЕ
 * пакеты, и запись исчезает в тот же миг, когда расходуется последний подъём.
 * Поэтому обходим её целиком, без выборок и индексов.
 */

/**
 * Насколько недавний подъём считается уже сделанным.
 *
 * ⚠️ Без этой проверки повторный прогон сжигал бы оплаченные дни. Планировщик
 * Google повторяет вызов при любой ошибке функции, а запустить задачу руками
 * можно в любой момент — и оба случая выглядели бы как «пакет на десять дней
 * кончился за три».
 *
 * Двадцать часов, а не двадцать четыре: прогон может сдвинуться на час-другой,
 * и тогда ровные сутки отложили бы подъём на день.
 */
const MIN_HOURS_BETWEEN_BUMPS = 20;

/**
 * Когда брошенный пакет убирается независимо ни от чего.
 *
 * Пакет расходуется только пока объявление на витрине — снятое его не тратит
 * (см. ниже). Значит запись брошенного объявления осталась бы навсегда. Через
 * три месяца такой пакет закрывается: срок заведомо больше любого честного
 * перерыва, а держать мёртвую запись вечно незачем.
 */
const ABANDONED_DAYS = 90;

/**
 * Содержимое документа объявления.
 *
 * `Record`, а не тип из firebase-admin: `admin` здесь это наш собственный
 * объект-обёртка над модульным SDK (см. `firebase-admin.ts`), пространства имён
 * с типами за ним нет.
 */
type DocumentFields = Record<string, unknown>;

/** Истёк ли платный тариф. ⚠️ Копия правила из `core/src/utils/premium-helper.ts`. */
function isTierExpired(data: DocumentFields): boolean {
  const tier = data.listingTier;
  if (tier !== 'vip' && tier !== 'premium') return false;
  const raw = (tier === 'vip' ? data.vipExpiresAt : data.premiumExpiresAt) as string | undefined;
  if (!raw) return true;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now();
}

/**
 * Стоит ли объявление на витрине. ⚠️ Копия `isOnDisplay` из общего пакета:
 * подмодуль `core` в сборку функций не тянут.
 */
function isOnDisplay(data: DocumentFields): boolean {
  if (data.status !== 'active') return false;
  return !isTierExpired(data);
}

export interface DailyBoostResult {
  bumped: number;
  finished: number;
  skipped: number;
  removed: number;
}

/**
 * Один проход по пакетам.
 *
 * Правила по порядку применения:
 *
 * ```
 * объявления больше нет        → запись убираем, поднимать нечего
 * подъём был меньше 20 часов   → пропускаем, НЕ расходуя: это повторный прогон
 * объявление не на витрине     → пропускаем, НЕ расходуя: пакет ждёт возвращения
 * пакет брошен больше 90 дней  → убираем
 * иначе                        → поднимаем и списываем один
 * последний подъём списан      → запись убираем, чтобы не копить мусор
 * ```
 *
 * Пропуск снятого с витрины объявления — решение в пользу заплатившего. Поднять
 * скрытое объявление значит списать день за то, чего никто не увидит.
 */
export async function runDailyBoosts(): Promise<DailyBoostResult> {
  const db = admin.firestore();
  const snapshot = await db.collection(BOOSTS).get();

  const result: DailyBoostResult = {bumped: 0, finished: 0, skipped: 0, removed: 0};
  const now = Date.now();
  const boostedAt = new Date(now).toISOString();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const propertyId = (data.propertyId as string) || doc.id;
    const remaining = Number(data.remaining ?? 0);

    if (remaining <= 0) {
      // Такого быть не должно — запись закрывается на последнем подъёме, — но
      // если случилось, держать её незачем.
      await doc.ref.delete();
      result.removed += 1;
      continue;
    }

    const propertyRef = db.collection('properties').doc(propertyId);
    const property = await propertyRef.get();

    if (!property.exists) {
      await doc.ref.delete();
      result.removed += 1;
      continue;
    }

    const lastBump = data.lastBumpAt ? new Date(data.lastBumpAt as string).getTime() : 0;
    if (Number.isFinite(lastBump) && now - lastBump < MIN_HOURS_BETWEEN_BUMPS * 3600000) {
      result.skipped += 1;
      continue;
    }

    if (!isOnDisplay(property.data() ?? {})) {
      // `createdAt` лежит отметкой времени Firestore, но у записи, поправленной
      // руками, может оказаться и строкой — разбираем оба вида, как это делает
      // `ageInHours` в чистке.
      const createdRaw = data.createdAt as {toMillis?: () => number} | string | undefined;
      const created =
        typeof createdRaw === 'object' && typeof createdRaw?.toMillis === 'function'
          ? createdRaw.toMillis()
          : typeof createdRaw === 'string'
            ? new Date(createdRaw).getTime()
            : now;
      if (now - created > ABANDONED_DAYS * 86400000) {
        await doc.ref.delete();
        result.removed += 1;
      } else {
        result.skipped += 1;
      }
      continue;
    }

    await propertyRef.update({boostedAt});

    const left = remaining - 1;
    if (left <= 0) {
      // Пакет закончился. Запись удаляем, а дату подъёма на объявлении
      // оставляем: последний оплаченный подъём обязан отработать свои сутки.
      await doc.ref.delete();
      result.finished += 1;
    } else {
      await doc.ref.update({
        remaining: left,
        lastBumpAt: boostedAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    result.bumped += 1;
  }

  return result;
}
