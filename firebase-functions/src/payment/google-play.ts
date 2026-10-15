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

/**
 * Товары подъёма — отдельной таблицей, а не ещё одним полем в `PLAY_PRODUCTS`.
 *
 * Подъём это не тариф: он не меняет полосу, не имеет срока и не стирает дат.
 * Смешай их в одной записи — и пришлось бы заводить необязательные поля,
 * которые каждый читающий обязан не перепутать. Здесь же товар либо тариф, либо
 * подъём, и третьего нет.
 *
 * ⚠️ Имена обязаны совпадать с товарами в Play Console и со `BOOST_PRODUCTS` в
 * `billing-service.ts` приложения. Цены задаёт Google, у нас их нет.
 */
export const BOOST_PRODUCTS: Record<string, {count: 1 | 3 | 5 | 10}> = {
  boost_1: {count: 1},
  boost_3: {count: 3},
  boost_5: {count: 5},
  boost_10: {count: 10},
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

/** Отменённая покупка: возврат, отзыв или оспаривание платежа. */
export interface VoidedPurchase {
  purchaseToken: string;
  orderId?: string;
  purchaseTimeMillis?: string;
  voidedTimeMillis?: string;
  /** 0 — покупатель, 1 — разработчик, 2 — Google. */
  voidedSource?: number;
  /** 0 другое, 1 передумал, 2 не получил, 3 брак, 4 случайно, 5 мошенничество,
   *  6 мошенничество «со своими», 7 оспаривание платежа. */
  voidedReason?: number;
}

/** Расшифровка причины возврата — для журнала, чтобы не читать цифры. */
export const VOIDED_REASONS: Record<number, string> = {
  0: 'другое',
  1: 'передумал',
  2: 'не получил товар',
  3: 'товар с браком',
  4: 'купил случайно',
  5: 'мошенничество',
  6: 'мошенничество со знакомой карты',
  7: 'оспаривание платежа',
};

export const VOIDED_SOURCES: Record<number, string> = {
  0: 'покупатель',
  1: 'разработчик',
  2: 'Google',
};

/**
 * Список отменённых покупок — возвраты, отзывы и оспаривания.
 *
 * ⚠️ Зачем вообще нужен отдельный запрос. Про возврат Google **нам не сообщает**:
 * покупка просто перестаёт быть действительной, а у нас тариф уже стоит. Без
 * этого опроса человек возвращает деньги и оставляет себе оплаченное — убыток
 * тихий, жалоб не вызывает, и поэтому его легко не заметить годами. Второй
 * способ узнавать — подписка на уведомления Google через Pub/Sub; опрос выбран
 * потому, что не требует ни темы Pub/Sub, ни настройки в консоли, а задержка до
 * суток для возврата несущественна.
 *
 * ⚠️ `type=1` обязателен. По умолчанию Google отдаёт **только подписки**, а у нас
 * все товары одноразовые — без этого параметра список всегда приходил бы пустым,
 * и дыра выглядела бы закрытой.
 *
 * ⚠️ История ограничена: Google держит отменённые покупки около тридцати дней.
 * Поэтому опрос обязан быть регулярным — пропущенный месяц не догнать.
 *
 * @param sinceMs с какого момента искать (миллисекунды эпохи).
 */
export async function listVoidedPurchases(sinceMs: number): Promise<VoidedPurchase[]> {
  const client = await auth.getClient();
  const {token} = await client.getAccessToken();
  if (!token) throw new Error('play-auth-failed');

  const found: VoidedPurchase[] = [];
  let pageToken: string | undefined;

  // Предел страниц — защита от бесконечного цикла, если Google когда-нибудь
  // начнёт отдавать тот же токен страницы. Тысяча возвратов за раз у нас
  // означала бы беду совсем другого рода.
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(
      `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/voidedpurchases`
    );
    url.searchParams.set('startTime', String(Math.floor(sinceMs)));
    url.searchParams.set('type', '1');
    url.searchParams.set('maxResults', '100');
    if (pageToken) url.searchParams.set('token', pageToken);

    const response = await fetch(url.toString(), {
      headers: {Authorization: `Bearer ${token}`},
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`play-voided-${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      voidedPurchases?: VoidedPurchase[];
      tokenPagination?: {nextPageToken?: string};
    };

    found.push(...(data.voidedPurchases ?? []));

    pageToken = data.tokenPagination?.nextPageToken;
    if (!pageToken) break;
  }

  return found;
}
