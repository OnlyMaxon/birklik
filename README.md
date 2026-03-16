# Birklik.az

Платформа аренды жилья в Азербайджане (AZ/RU/EN) на React + TypeScript + Firebase.

Этот гайд покрывает полную миграцию проекта на Firebase и настройку проекта с нуля.

## 1. Что уже реализовано в коде

- Каталог объектов на главной загружается из Firestore.
- Страница объекта загружает объект по id из Firestore.
- Личный кабинет пользователя работает с Firestore:
  - просмотр своих объявлений,
  - добавление объявлений,
  - загрузка фото в Firebase Storage,
  - удаление объявлений.
- Аутентификация и регистрация работают через Firebase Authentication.

## 2. Технологии

- React 18
- TypeScript 5
- Vite
- React Router DOM 6
- Firebase (Auth, Firestore, Storage)
- React Leaflet + OpenStreetMap
- Cloudflare Pages

## 3. Быстрый старт

```bash
npm install
```

Создайте файл .env:

- Linux/macOS:

```bash
cp .env.example .env
```

- Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Запуск:

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

Предпросмотр сборки:

```bash
npm run preview
```

## 4. Полный туториал по Firebase Console

### Шаг 1. Создайте проект Firebase

1. Откройте https://console.firebase.google.com/
2. Нажмите Create a project.
3. Назовите проект, например birklik-az.
4. Google Analytics можно выключить (необязательно).

### Шаг 2. Добавьте Web App

1. Внутри проекта нажмите Add app -> Web (</>). 
2. Укажите имя приложения, например birklik-web.
3. Получите объект firebaseConfig.

### Шаг 3. Заполните .env

Скопируйте значения из firebaseConfig в .env:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Шаг 4. Включите Authentication

1. Firebase Console -> Build -> Authentication.
2. Нажмите Get started.
3. Sign-in method -> Email/Password -> Enable.

### Шаг 5. Включите Firestore

1. Firebase Console -> Build -> Firestore Database.
2. Create database.
3. Выберите Production mode.
4. Выберите регион (лучше ближе к вашим пользователям).

### Шаг 6. Включите Storage

1. Firebase Console -> Build -> Storage.
2. Get started.
3. Выберите тот же регион.

## 5. Firestore структура данных

Коллекции:

- users/{uid}
- properties/{propertyId}

Пример users/{uid}:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+994501112233",
  "avatar": "https://...",
  "createdAt": "2026-03-16T10:00:00.000Z"
}
```

Пример properties/{propertyId}:

```json
{
  "type": "villa",
  "district": "mardakan",
  "price": {
    "daily": 250,
    "weekly": 1500,
    "monthly": 6000,
    "currency": "AZN"
  },
  "rooms": 4,
  "area": 220,
  "amenities": ["pool", "wifi", "parking"],
  "images": ["https://..."],
  "coordinates": { "lat": 40.4093, "lng": 49.8671 },
  "title": {
    "az": "Başlıq",
    "ru": "Заголовок",
    "en": "Title"
  },
  "description": {
    "az": "Təsvir",
    "ru": "Описание",
    "en": "Description"
  },
  "address": {
    "az": "Ünvan",
    "ru": "Адрес",
    "en": "Address"
  },
  "owner": {
    "name": "Test User",
    "phone": "+994501112233",
    "email": "test@example.com"
  },
  "ownerId": "firebase_uid",
  "isFeatured": false,
  "isActive": true,
  "city": "Baku",
  "createdAt": "2026-03-16T10:00:00.000Z",
  "updatedAt": "2026-03-16T10:00:00.000Z"
}
```

## 6. Firestore Rules (вставьте как есть)

Firebase Console -> Firestore -> Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && request.auth.uid == userId;
    }

    match /properties/{propertyId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.type is string
        && request.resource.data.district is string
        && request.resource.data.price.daily is number
        && request.resource.data.rooms is number;

      allow update, delete: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

## 7. Storage Rules (вставьте как есть)

Firebase Console -> Storage -> Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /properties/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 8. Firestore Indexes (важно)

Для текущих запросов нужны композитные индексы в коллекции properties.

Откройте Firebase Console -> Firestore -> Indexes -> Composite -> Create index и добавьте:

1. type Asc, createdAt Desc
2. district Asc, createdAt Desc
3. ownerId Asc, createdAt Desc
4. isFeatured Asc, createdAt Desc
5. type Asc, price.daily Asc, createdAt Desc
6. district Asc, price.daily Asc, createdAt Desc

Примечание: если Firebase вернет ссылку на конкретный индекс в ошибке запроса, просто откройте эту ссылку и создайте индекс в 1 клик.

## 9. Как проверить, что все подключено

1. Запустите проект: npm run dev.
2. Зарегистрируйте пользователя.
3. Войдите в Dashboard.
4. Создайте объявление и прикрепите фото.
5. Проверьте:
   - документ появился в Firestore -> properties,
   - фото появилось в Storage -> properties/,
   - объявление видно в списке Dashboard,
   - объявление видно на главной,
   - карточка открывается по маршруту /property/:id.

## 10. Деплой на Cloudflare Pages

### Через GitHub (рекомендуется)

1. Push в репозиторий.
2. Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages.
3. Connect to Git.
4. Build command: npm run build.
5. Build output: dist.
6. Добавьте все переменные VITE_FIREBASE_* в Environment Variables.
7. Deploy.

### Через Wrangler CLI

```bash
npm install -g wrangler
wrangler login
npm run build
wrangler pages deploy dist --project-name=birklik-az
```

## 11. Частые проблемы

1. Ошибка Missing or insufficient permissions:
   - проверьте Firestore Rules,
   - проверьте ownerId в документе.

2. Ошибка index required:
   - создайте индекс по ссылке из ошибки.

3. Картинки не загружаются:
   - проверьте Storage Rules,
   - проверьте, что пользователь авторизован.

4. Пустой каталог:
   - проверьте, есть ли документы в properties,
   - проверьте .env и корректный projectId.

## 12. Структура проекта

```text
src/
  components/
  config/
  context/
  data/
  i18n/
  layouts/
  pages/
  services/
  styles/
  types/
```

---

Если нужно, могу сделать второй этап миграции:

- редактирование объявления (update) прямо из Dashboard,
- геокодинг адреса и автоматическая установка coordinates,
- полноценный production-поиск через Algolia (вместо client-side фильтра).
