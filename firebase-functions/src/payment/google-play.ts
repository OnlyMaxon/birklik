import {GoogleAuth} from 'google-auth-library';

import type {PaidTier, TierDuration} from './apply-tier';

/**
 * Проверка покупок Google Play.
 *
 * Вторая касса рядом с Azericard: на сайте платят картой через банк, в
 * приложении — через магазин. Выбора тут нет, это требование правил. Google
 * обязывает пользоваться своим биллингом для всего, что открывает возможности
 * внутри приложения, а поднятие объявления в выдаче — именно это. Подробно:
 * 3.1.1 у Apple и раздел «Платежи» у Google.
 *
 * ⚠️ **Чек обязан проверяться на сервере.** Ответ библиотеки покупок на
 * устройстве доверия не заслуживает: приложение на телефоне у покупателя, и
 * подделать успешный ответ умеет любой готовый инструмент. Единственное
 * доказательство — ответ серверов Google на присланный `purchaseToken`.
 */

/** Имя пакета приложения. Должно совпадать с `android.package` в app.json. */
const PACKAGE_NAME = 'az.birklik.app';

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/**
 * Соответствие товаров магазина тарифам.
 *
 * Имена выбраны нами и **обязаны совпадать** с идентификаторами товаров,
 * заведённых в Play Console. Опечатка здесь выглядит как «покупка прошла, тариф
 * не поставился»: Google спишет деньги за товар, которого мы не узнаём.
 *
 * Цен здесь нет намеренно. Их задаёт Google ценовыми уровнями в своей валюте, и
 * приложение показывает то, что вернул магазин. Дублировать 20/30/55 AZN из
 * TIER_PRICES в azericard.ts здесь нельзя — разойдутся.
 */
export const PLAY_PRODUCTS: Record<string, {tier: PaidTier; duration: TierDuration}> = {
  vip_14: {tier: 'vip', duration: '14days'},
  vip_30: {tier: 'vip', duration: '30days'},
  premium_14: {tier: 'premium', duration: '14days'},
  premium_30: {tier: 'premium', duration: '30days'},
};

/** Состояние покупки в ответе Google. 0 — куплено, это единственное, что нас устраивает. */
const PURCHASED = 0;

export interface PlayPurchase {
  purchaseState?: number;
  consumptionState?: number;
  orderId?: string;
  purchaseTimeMillis?: string;
  /**
   * Ставится ТОЛЬКО если покупка прошла не обычным путём: 0 — тестовая из
   * лицензионного теста, 1 — по промокоду, 2 — за награду. У настоящей покупки
   * поля нет вовсе, поэтому `purchaseType === 0` и означает «тестовая».
   * Не перепутать: нуль здесь не «нормальная».
   */
  purchaseType?: number;
  /**
   * Привязка, сделанная приложением ДО оплаты, и возвращённая нам Google.
   *
   * Приложение передаёт в покупку `obfuscatedAccountId` (кто покупает) и
   * `obfuscatedProfileId` (какое объявление продвигает). Google хранит это
   * внутри записи о покупке, поэтому **здесь она приходит не от приложения, а
   * от Google** — подменить её на устройстве нельзя.
   *
   * Зачем: токен покупки сам по себе не говорит, к чему её применить. Без
   * привязки пришлось бы верить приложению, а оно у покупателя в руках. Плюс
   * привязка спасает прерванную покупку: если приложение закрыли до проверки,
   * объявление всё равно известно.
   */
  obfuscatedExternalAccountId?: string;
  obfuscatedExternalProfileId?: string;
}

/**
 * Доступ к Google Play Developer API.
 *
 * Область запрашивается явно: у служебной учётной записи функций по умолчанию
 * области Firebase, а `androidpublisher` в них не входит. Одной подписи от
 * firebase-admin здесь не хватит.
 *
 * ⚠️ Эта же учётная запись должна быть **добавлена в Play Console** с правом
 * смотреть финансовые данные, иначе Google отвечает 401 при совершенно
 * правильном токене. Шаг делается руками в консоли и кодом не заменяется.
 */
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});

/**
 * Спрашивает Google, настоящая ли покупка.
 *
 * @returns запись о покупке или `null`, если Google её не знает — то есть токен
 *   выдуман или относится к другому приложению.
 * @throws если до Google не дошли: сеть, права, неверная настройка. Отличать это
 *   от «покупки нет» обязательно — на недоступности Google нельзя отказывать
 *   человеку, который заплатил.
 */
export async function fetchPlayPurchase(
  productId: string,
  purchaseToken: string
): Promise<PlayPurchase | null> {
  const client = await auth.getClient();
  const {token} = await client.getAccessToken();
  if (!token) throw new Error('play-auth-failed');

  const url =
    `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}` +
    `/purchases/products/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}`;

  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});

  // 404 — Google такой покупки не знает. Это не сбой, а ответ «нет».
  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`play-api-${response.status}: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as PlayPurchase;
}

/** Куплено ли по-настоящему. Вынесено, чтобы условие не расползалось по вызовам. */
export function isPurchased(purchase: PlayPurchase): boolean {
  return purchase.purchaseState === PURCHASED;
}
