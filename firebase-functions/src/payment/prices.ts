/**
 * Прейскурант площадки манатами — для функций.
 *
 * ⚠️ **КОПИЯ.** Источник — `TIER_PRICES` и `BOOST_PRICES` в
 * `core/src/data/pricing.ts`, оттуда берут цену сайт и приложение.
 * Импортировать сюда нельзя: функции собираются отдельным пакетом и подмодуль
 * `core` в сборку не тянут. **Меняя цену, править оба места.** По этим числам
 * банк берёт настоящие деньги; расхождение выглядит как «на экране одна сумма,
 * списали другую».
 *
 * До 2026-11-12 копия лежала прямо в `azericard.ts`, и это было терпимо, пока
 * читал её один файл. Теперь цену спрашивает ещё и счётчик выручки — у платежей
 * Google суммы нет вовсе, и взять её больше неоткуда. Третьей копии заводить не
 * стали: внутри пакета функций прейскурант отныне ровно здесь.
 */

import {BOOST_PRODUCTS, PLAY_PRODUCTS} from './google-play';

/** Цены платных тарифов манатами. */
export const TIER_PRICES: Record<string, Record<string, number>> = {
  vip: {'14days': 20, '30days': 30},
  premium: {'14days': 30, '30days': 55},
};

/** Цены пакетов подъёма манатами. */
export const BOOST_PRICES: Record<number, number> = {1: 2, 3: 5, 5: 8, 10: 15};

/** Валюта площадки. Ею же считает Azericard — см. `CURRENCY` в `azericard.ts`. */
export const PLATFORM_CURRENCY = 'AZN';

/**
 * Цена товара магазина манатами по его имени: `boost_3` → 5, `premium_30` → 55.
 *
 * ⚠️ Это НАША цена, а не та, что списал магазин. Нужна там, где магазин сумму
 * не сообщает: ответ Google по чеку цены не содержит вовсе. Для
 * азербайджанской витрины числа совпадают — цены в Play Console выставлены
 * манатами по этому же прейскуранту; для чужой витрины это оценка, и платёж,
 * посчитанный так, помечается `amountSource: 'pricelist'`.
 *
 * Имена товаров берём из таблиц, по которым работают обе кассы, а не отдельным
 * списком: четвёртая копия имён разошлась бы с Play Console молча.
 */
export function productPriceAzn(productId: string): number | undefined {
  const tier = PLAY_PRODUCTS[productId];
  if (tier) return TIER_PRICES[tier.tier]?.[tier.duration];

  const boost = BOOST_PRODUCTS[productId];
  if (boost) return BOOST_PRICES[boost.count];

  return undefined;
}
