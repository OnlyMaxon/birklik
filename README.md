# Birklik.az

Маркетплейс краткосрочной аренды жилья в Азербайджане на трёх языках (AZ/RU/EN).
Next.js 16 App Router на Cloudflare Workers, данные и вход — Firebase.

Этот файл про то, **как поднять проект и как его выкатывать**. Про то, *почему*
он устроен именно так, — [Architecture.md](./Architecture.md).

## 📚 Документация

| файл | о чём |
| --- | --- |
| [Architecture.md](./Architecture.md) | устройство, границы отрисовки, соглашения. Источник истины по замыслу |
| [AUDIT.md](./AUDIT.md) | сплошной аудит кода и данных, найденные дефекты и что с ними сделано |
| [CLAUDE.md](./CLAUDE.md) | правила для ИИ-агентов, работающих с этим репозиторием |

⚠️ Имя файла — `Architecture.md`, именно в таком регистре. Windows разницы не
видит (`core.ignorecase = true`), а на Linux и в CI ссылка на `ARCHITECTURE.md`
никуда не ведёт.

## 1. Что умеет проект

**Витрина.** Каталог с поиском, фильтрами и картой; постраничная подгрузка;
страницы регионов; карточка объявления с галереей, комментариями и оценками.

**Кабинет владельца.** Создание и редактирование объявлений, загрузка фото,
тарифы, продление, просмотр броней и уведомлений.

**Брони.** Заявка от гостя, подтверждение или отказ владельцем, запросы на
отмену, календарь занятости.

**Модерация.** Очередь объявлений и жалоб на комментарии, роль модератора через
custom claims.

**Тарифы и оплата.** Бесплатный `standard`, платные `vip` и `premium` со сроком
14 или 30 дней. На сайте оплата через Azericard, в мобильном приложении — через
Google Play Billing. Обе кассы применяют тариф одной общей функцией.

**Уведомления.** Внутренние плюс веб-пуши и пуши в приложении через FCM.

**Фоновые задачи.** Четыре плановые функции: снятие истёкших тарифов, чистка
черновиков, чистка зависших запросов и чистка осиротевших файлов в Storage.

## 2. Технологии

- Next.js 16 (App Router), React 19, TypeScript 5
- next-intl — три языка, локаль в адресе
- Firebase: Authentication, Firestore, Storage, Cloud Functions, App Check
- Cloudflare Workers через `@opennextjs/cloudflare`
- Leaflet + React Leaflet, тайлы CARTO с откатом на OpenStreetMap
- pnpm-воркспейс; общая логика — подмодуль [`core`](https://github.com/OnlyMaxon/birklik-core)

⚠️ На Workers **нет** `firebase-admin`: его зависимости генерируют код из строк,
а воркеры это запрещают. Серверный доступ к Firestore идёт по REST —
`src/lib/firebase/firestore-rest.ts`. Из этого следует общее правило: в проект
нельзя тащить библиотеки, которым нужен настоящий Node-рантайм.

## 3. Быстрый старт

```bash
git clone --recurse-submodules <repo>
pnpm install
```

Если репозиторий уже склонирован без подмодуля:

```bash
git submodule update --init --recursive
```

Переменные окружения:

```bash
cp .env.example .env          # Linux/macOS
Copy-Item .env.example .env   # Windows PowerShell
```

`.env.example` объясняет каждую переменную и ловушки — прочитай его целиком,
там не только имена. Особенно важны две:

- **`NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`** — именно с `_ENTERPRISE_`.
  Положишь тот же ключ под именем без этого куска — код возьмёт провайдер
  reCAPTCHA v3, App Check начнёт выдавать негодные токены, и Firestore с
  Authentication станут молча отбивать запросы клиента;
- **`NEXT_PUBLIC_CARTO_API_KEY`** — попадает в бандл **на сборке**, а не в
  рантайме, поэтому обязан быть в окружении во время `pnpm cf:build`.

Команды разработки:

```bash
pnpm dev          # локальный сервер
pnpm typecheck    # tsc --noEmit
pnpm test:run     # юнит-тесты
pnpm test:rules   # тесты правил Firestore, нужен эмулятор и JDK
```

### Ключи служебных учётных записей

Никогда не коммить и не вставлять JSON служебной учётной записи в исходники,
`.env`, задачи или переписку. Файл держать вне репозитория и отдавать Google
только путь к нему:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

Утёкший ключ немедленно отзывать: Google Cloud Console → **IAM & Admin →
Service Accounts → Keys**.

## 4. Настройка Firebase с нуля

### Шаг 1. Проект

1. https://console.firebase.google.com/ → **Create a project**.
2. Имя, например `birklik-az`. Google Analytics можно выключить.

### Шаг 2. Web App

1. **Add app → Web (</>)**, имя например `birklik-web`.
2. Забрать объект `firebaseConfig` — его значения идут в `.env`.

### Шаг 3. Authentication

1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable**.
3. **Settings → Authorized domains** — добавить рабочий домен (`birklik.az`)
   и адрес воркера, с которого ходят превью.

Без этого Firebase ругается на OAuth redirect domain, а вход через
popup/redirect не работает.

### Шаг 4. Firestore и Storage

1. **Build → Firestore Database → Create database → Production mode**, регион
   поближе к пользователям.
2. **Build → Storage → Get started**, тот же регион.

### Шаг 5. App Check

Ключ reCAPTCHA Enterprise создаётся в Google Cloud Console → **Security →
reCAPTCHA Enterprise**; там же, на самом ключе, задаются домены, с которых
разрешено брать токен. Мобильное приложение использует Play Integrity —
подробности в Architecture.md.

## 5. Структура данных Firestore

Основные коллекции:

```
users/{uid}                              профиль, роль, токены пушей
properties/{propertyId}                  объявления
bookings/{bookingId}                     брони
cancellationRequests/{id}                запросы на отмену
payments/{paymentId}                     общий журнал оплат (Azericard и Google Play)
playPurchases/{purchaseToken}            защита от повторного зачёта покупки
users/{uid}/notifications/{id}           уведомления
```

Пример `properties/{propertyId}` — только ключевые поля, полный набор описан
типами в `core/src/types`:

```json
{
  "ownerId": "firebase_uid",
  "status": "active",
  "listingTier": "premium",
  "premiumExpiresAt": "2026-10-14T19:59:59.000Z",
  "vipExpiresAt": "",
  "isFeatured": true,
  "type": "villa",
  "city": "Baku",
  "district": "mardakan",
  "locationTags": ["mardakan"],
  "price": { "daily": 250, "weekly": 1500, "monthly": 6000, "currency": "AZN" },
  "rooms": 4,
  "area": 220,
  "minGuests": 2,
  "maxGuests": 8,
  "amenities": ["pool", "wifi", "parking"],
  "images": ["https://..."],
  "coordinates": { "lat": 40.4093, "lng": 49.8671 },
  "title":       { "az": "Başlıq", "ru": "Заголовок", "en": "Title" },
  "description": { "az": "Təsvir", "ru": "Описание",  "en": "Description" },
  "address":     { "az": "Ünvan",  "ru": "Адрес",     "en": "Address" },
  "owner": { "name": "...", "phone": "+994...", "email": "..." },
  "createdAt": "2026-03-16T10:00:00.000Z",
  "updatedAt": "2026-03-16T10:00:00.000Z"
}
```

⚠️ **`status` в базе отстаёт от срока тарифа** — статус `inactive` проставляет
ночная функция, и до её прогона проходит до суток. Поэтому каждый список обязан
досеивать выдачу функцией `isOnDisplay` из `core`. Разъедься эта проверка между
сайтом и приложением — на телефоне неделю висели бы объявления, которых на сайте
уже нет.

## 6. Правила Firestore и Storage

Правила живут **в репозитории** и являются источником истины:

```
firestore.rules          258 строк
storage.rules             42 строки
firestore.indexes.json   композитные индексы
```

⚠️ **Не вставлять правила руками через Firebase Console.** Раньше здесь лежали
«стартовые» правила с пометкой «вставьте как есть» — вставка любого такого
образца затирает настоящие правила, а вместе с ними закрытые дыры из
[AUDIT.md](./AUDIT.md): чужие комментарии и оценки на чужих объявлениях (C1, C6)
и самоназначение роли модератора в собственном профиле (C7).

Выкладывать только командами:

```bash
pnpm firestore:deploy-rules          # правила Firestore
firebase deploy --only storage       # правила Storage
firebase deploy --only firestore:indexes
```

Проверять до выкладки:

```bash
pnpm test:rules      # 90 тестов, нужен эмулятор Firestore и установленный JDK
```

## 7. Проверка, что всё подключено

1. `pnpm dev`.
2. Зарегистрировать пользователя, подтвердить почту.
3. Создать объявление с фото.
4. Убедиться, что:
   - документ появился в `properties` со `status: pending`,
   - фото легло в Storage,
   - объявление видно в кабинете,
   - после одобрения модератором оно видно на главной,
   - карточка открывается по адресу `/property/<id>`.

## 8. Деплой

Три независимые цели, и выкладываются они **по отдельности**:

```bash
# 1. Сайт (Cloudflare Workers)
pnpm cf:build
npx wrangler deploy

# 2. Cloud Functions
pnpm functions:deploy

# 3. Правила Firestore
pnpm firestore:deploy-rules
```

⚠️ **Обязательно `pnpm cf:build`, а не `pnpm build`.** Второй собирает только
`.next`; `wrangler deploy` ничего не собирает и молча зальёт **старый** бандл из
`.open-next`. Ошибка тихая — по времени файлов её не видно.

Проверить, что в бою именно свежая сборка, — сверить `BUILD_ID`:

```powershell
$local = (Get-Content ".open-next\assets\BUILD_ID" -Raw).Trim()
$r = Invoke-WebRequest "https://birklik.az/BUILD_ID" -UseBasicParsing
$live = ([System.Text.Encoding]::UTF8.GetString($r.Content)).Trim()
"local $local / live $live / совпало: $($local -eq $live)"
```

Рискованное катить через превью, не трогая боевой трафик:

```bash
npx wrangler versions upload                    # даёт превью-адрес
npx wrangler versions list                      # взять ПОЛНЫЙ id последней версии
npx wrangler versions deploy "<полный-id>@100%" --yes
```

⚠️ **Домены в `wrangler.jsonc` трогать осторожно.** wrangler приводит привязки
воркера к списку `routes`: домен, добавленный через дашборд, но забытый в
конфиге, ближайший `deploy` снимет вместе с DNS-записью. Боевой сайт так падал.

## 9. Частые проблемы

| симптом | куда смотреть |
| --- | --- |
| `Missing or insufficient permissions` | правила Firestore; `ownerId` в документе; не отбивает ли App Check |
| `index required` | открыть ссылку из текста ошибки, затем внести индекс в `firestore.indexes.json` |
| Карта с надписью «API KEY REQUIRED» | нет `NEXT_PUBLIC_CARTO_API_KEY` на момент сборки. Тайл при этом приходит с кодом 200, поймать обработчиком нельзя |
| Вход крутит редиректы | несовпадение куки сессии и состояния Firebase — см. Architecture.md |
| Задеплоили, а изменений нет | собрали `pnpm build` вместо `pnpm cf:build`; сверить `BUILD_ID` |
| Картинки не грузятся | правила Storage; формат адреса (`/api/images/` против прямой ссылки) |

## 10. Структура проекта

```text
src/
  app/            маршруты App Router, серверные действия, обработчики /api
  components/     общие компоненты интерфейса
  hooks/          клиентские хуки
  lib/            firebase (REST и клиент), сессии, картинки, локали
  messages/       переводы az / en / ru
  services/       работа с данными на клиенте
  utils/          мелкие помощники
core/             подмодуль @birklik/core — логика, общая с приложением
firebase-functions/
  src/cleanup/    плановые чистки и ручные инструменты
  src/payment/    Azericard, Google Play, применение тарифа
  src/notifications/
tests/rules/      тесты правил Firestore (эмулятор)
```

⚠️ **Подмодуль `core` общий с мобильным приложением.** Правка общей логики — это
три коммита подряд: сначала в `core`, потом указатель подмодуля в вебе, потом в
приложении. Пропустишь второй — приложение соберётся со старой версией.

В `core` не должно попадать ничего, знающего про окружение: там нет `lib: DOM`,
и он обязан работать под голым Node.

## 11. Кратко о бизнесе

Birklik.az — маркетплейс краткосрочной аренды жилья в Азербайджане.

**Модель.** Публикация объявления бесплатна (`standard`). Платные тарифы `vip` и
`premium` на 14 или 30 дней дают место выше в выдаче и больше возможностей у
объявления.

**Гость.** Открывает каталог, ищет и фильтрует, смотрит карточку с фото,
описанием, ценой и картой, отправляет заявку на бронь.

**Владелец.** Регистрируется, создаёт объявление, проходит модерацию, при
желании покупает тариф, дальше управляет бронями и объявлениями из кабинета.

**Модератор.** Разбирает очередь новых объявлений и жалобы на комментарии.
