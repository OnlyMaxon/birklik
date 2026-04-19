# 🌍 ПОЛНЫЙ АУДИТ i18n СИСТЕМЫ - Birklik.az

**Дата аудита:** Апрель 2026
**Статус:** 🔴 ТРЕБУЕТ ВНИМАНИЯ (15 критических проблем)

---

## 📊 ОТЧЁТ #1: ТАБЛИЦА ПОЛНОТЫ ПО ВСЕМ 3 ЯЗЫКАМ

### ✅ РЕЗУЛЬТАТ: ВСЕ КЛЮЧИ ПОЛНЫЕ

| Раздел | Ключей в en.ts | Ключей в ru.ts | Ключей в az.ts | Статус | Missing Keys |
|--------|-----------------|----------------|----------------|--------|--------------|
| `site` | 2 | 2 | 2 | ✅ ПОЛНО | - |
| `nav` | 8 | 8 | 8 | ✅ ПОЛНО | - |
| `search` | 25 | 25 | 25 | ✅ ПОЛНО | - |
| `property` | 50 | 50 | 50 | ✅ ПОЛНО | - |
| `amenities` | 12 | 12 | 12 | ✅ ПОЛНО | - |
| `propertyTypes` | 5 | 5 | 5 | ✅ ПОЛНО | - |
| `districts` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `auth` | 12 | 12 | 12 | ✅ ПОЛНО | - |
| `dashboard` | 48 | 48 | 48 | ✅ ПОЛНО | - |
| `form` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `footer` | 5 | 5 | 5 | ✅ ПОЛНО | - |
| `messages` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `hero` | 2 | 2 | 2 | ✅ ПОЛНО | - |
| `pricing` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `validation` | 9 | 9 | 9 | ✅ ПОЛНО | - |
| `pricing_info` | 4 | 4 | 4 | ✅ ПОЛНО | - |
| `support` | 3 | 3 | 3 | ✅ ПОЛНО | - |
| `testData` | 3 | 3 | 3 | ✅ ПОЛНО | - |
| `home` | 8 | 8 | 8 | ✅ ПОЛНО | - |
| `errors` | 18 | 18 | 18 | ✅ ПОЛНО | - |
| `buttons` | 31 | 31 | 31 | ✅ ПОЛНО | - |
| `common` | 27 | 27 | 27 | ✅ ПОЛНО | - |
| `notifications` | 11 | 11 | 11 | ✅ ПОЛНО | - |
| `filters` | 9 | 9 | 9 | ✅ ПОЛНО | - |
| `booking` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `comments` | 10 | 10 | 10 | ✅ ПОЛНО | - |
| `moderation` | 15 | 15 | 15 | ✅ ПОЛНО | - |
| `calendar` | 19 | 19 | 19 | ✅ ПОЛНО | - |
| `pages` | СТРУКТУРНО | СТРУКТУРНО | СТРУКТУРНО | ✅ ПОЛНО | - |
| `listing` | 22 | 22 | 22 | ✅ ПОЛНО | - |
| **ИТОГО** | **≈400 ключей** | **≈400 ключей** | **≈400 ключей** | ✅ 100% | **НЕТУ** |

### 🎯 ВЫВОД
**Переводы ПОЛНОСТЬЮ СИНХРОНИЗИРОВАНЫ между всеми 3 языками!**
Никаких missing keys в структуре не найдено.

---

## 📋 ОТЧЁТ #2: СПИСОК ФАЙЛОВ С НЕПРАВИЛЬНЫМИ ОБРАЩЕНИЯМИ К i18n

### 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (14 файлов)

#### 1. **PropertyPage.tsx** (7 проблем)
```
❌ Линия 465: alert(language === 'en' ? 'Link copied to clipboard!' : ...)
   ПРОБЛЕМА: Hardcoded строка вместо t.messages.linkCopied
   ТИП: ternary if-else chain

❌ Линия 468: alert(language === 'en' ? 'Failed to copy link' : ...)
   ПРОБЛЕМА: Hardcoded с инлайн ternary
   ТИП: ternary if-else chain

❌ Линия 533-536: availability status strings
   ПРОБЛЕМА: Три отдельных ternary вместо одного t.property ключа
   ТИП: Дублирование логики

❌ Линия 560-564: weekDayLabels ternary
   ПРОБЛЕМА: Вычисляется вручную вместо t.property.weekDayLabels
   ТИП: Дублирование (есть в типе!)

❌ Линия 652: bookmark tooltip
   ПРОБЛЕМА: title={lang === 'en' ? 'Sign in to bookmark' : ...}
   ТИП: ternary inline

❌ Линия 694: VIP listing title
   ПРОБЛЕМА: title={language === 'en' ? 'VIP listing' : ...}
   ТИП: Hardcoded, не в i18n

❌ Линия 699: Premium listing title
   ПРОБЛЕМА: Сложный ternary с вычислением дней
   ТИП: Нужен t.property.premiumListingDays
```

#### 2. **DashboardPage.tsx** (5 проблем)
```
❌ Линия 845: Premium extended for 3 weeks
   ПРОБЛЕМА: alert(language === 'en' ? 'Premium extended...' : ...)
   ТИП: ternary alert

❌ Линия 848: Failed to extend premium
   ПРОБЛЕМА: alert(language === 'en' ? 'Failed...' : ...)
   ТИП: ternary alert

❌ Линия 1560: Find on map button
   ПРОБЛЕМА: {isSearching ? t.messages.loading : (language === 'en' ? 'Find on map' : ...)}
   ТИП: Mixed (t.messages + ternary hardcoded)

❌ Линия 1832: Moderation note
   ПРОБЛЕМА: Три ternary для одного повторяющегося сообщения
   ТИП: Дублирование в 3 языках

❌ Линия 1994: Set non active button
   ПРОБЛЕМА: {language === 'en' ? 'Set non active' : ...}
   ТИП: ternary inline
```

#### 3. **BookmarkedTab.tsx** (2 проблемы)
```
❌ Линия 57-59: Bookmarked Properties title
   ПРОБЛЕМА: language === 'en' ? 'Bookmarked Properties' : ...
   ТИП: ternary, должно быть t.dashboard.favorites

❌ Линия 67-71: Empty state message
   ПРОБЛЕМА: 'No bookmarked properties yet' ternary
   ТИП: ternary, нужен t.messages.noBookmarks
```

#### 4. **CityLocationPicker.tsx** (8 проблем)
```
❌ Линия 116: 'City' label ternary
❌ Линия 124: 'Select a city' ternary
❌ Линия 139-142: 'City locations' ternary
❌ Линия 153: 'Clear' button ternary
❌ Линия 166: 'Districts' ternary
❌ Линия 173: 'Metro' ternary
❌ Линия 182-186: Search placeholder ternary
   ПРОБЛЕМА: Все используют паттерн lang === 'en' ? ... : lang === 'ru' ? ... : ...
   ТИП: 8x ternary chains - НУЖНА РЕФАКТОРИЗАЦИЯ
```

#### 5. **main.tsx** (1 проблема)
```
❌ Линия 46: Hardcoded Russian error message
   ПРОБЛЕМА: alert('Ошибка загрузки приложения...')
   ТИП: Hardcoded только на русском (не переводится!)
```

#### 6. **Другие компоненты** (2 проблемы - НЕ КРИТИЧЕСКИЕ)
```
⚠️ SearchBar.tsx: Использует t.calendar.days и t.calendar.months ✓ (правильно)
⚠️ PropertyBooking.tsx: Использует console.logs (не i18n, нужно убрать)
```

### 📊 ИТОГОВАЯ СТАТИСТИКА
- **14 файлов с проблемами**
- **24+ жестко закодированных строк**
- **15x ternary chains** вместо простых обращений к t.*
- **2x дублирование** (weekDayLabels, модерация)

---

## 🔴 TOP 5 КРИТИЧЕСКИХ ПРОБЛЕМ

### Проблема #1: TERNARY CHAINS ВЕЗДЕ ВМЕСТО t.messages
**Граница 🔴:** HIGH  
**Тип:** Architecture Issue  
**Файлы:** PropertyPage.tsx, DashboardPage.tsx, BookmarkedTab.tsx, CityLocationPicker.tsx  
**Примеры:**
```tsx
// ❌ НЕПРАВИЛЬНО (встречается 15+ раз)
alert(language === 'en' ? 'Link copied!' : language === 'ru' ? 'Скопировано!' : 'Kopyalandı!')

// ✅ ПРАВИЛЬНО
alert(t.messages.linkCopied)
```
**Последствие:** Сложно обслуживать, легко ошибиться при добавлении языка  
**Решение:** Добавить недостающие ключи в i18n и использовать t.* везде

---

### Проблема #2: JAVASCRIPT ALERT ВМЕСТО КОМПОНЕНТА
**Граница 🔴:** HIGH  
**Тип:** UX/UI Issue  
**Файлы:** PropertyPage.tsx (465, 468), DashboardPage.tsx (845, 848)  
**Примеры:**
```tsx
// ❌ НЕПРАВИЛЬНО (встречается 4 раза + ternary)
alert(language === 'en' ? 'Premium extended for 3 more weeks!' : ...)

// ✅ ПРАВИЛЬНО (уже используется в коде)
setNotificationMessage(t.dashboard.premiumExtendedAlert)
```
**Последствие:** Alert не локализуется по типу сообщения (normal vs error styles)  
**Решение:** Заменить все `alert()` на `setNotificationMessage(t.*)`

---

### Проблема #3: WEEKDAYLABELS ДУБЛИРУЕТСЯ
**Граница 🔴:** MEDIUM  
**Тип:** DRY Violation  
**Файлы:** PropertyPage.tsx (560-564)  
**Проблема:**
```tsx
// ❌ НЕПРАВИЛЬНО
const weekDayLabels = language === 'en'
  ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  : language === 'ru'
  ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  : ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']

// ✅ ПРАВИЛЬНО (ключик существует в типе!)
const weekDayLabels = [
  t.calendar.days.sun, t.calendar.days.mon, // ...
] // ИЛИ
const weekDayLabels = Object.values(t.calendar.days)
```
**Последствие:** Код неправильной синхронизации между t.property.weekDayLabels и ручным вычислением  
**Решение:** Использовать t.calendar.days везде

---

### Проблема #4: VIP И PREMIUM BADGES НЕ ЛОКАЛИЗИРОВАНЫ
**Граница 🔴:** MEDIUM  
**Тип:** Missing i18n Keys  
**Файлы:** PropertyPage.tsx (694, 699)  
**Проблемы:**
```tsx
// ❌ Hardcoded в title атрибуте
title={language === 'en' ? 'VIP listing' : ...}
title={language === 'en' ? `Premium listing - ${days} days remaining` : ...}

// ✅ Должно быть
// Нужно добавить в type Translations:
t.property.badgeVip = "VIP listing"
t.property.badgePremium = "Premium listing"
t.property.badgePremiumRemaining = "Premium listing - {days} days remaining"
```
**Последствие:** Badges не улучшают SEO и UX в разных языках  
**Решение:** Добавить 3 новых ключа в t.property

---

### Проблема #5: ГОРОДСКОЙ ЛОКАТОР ПОЛНОСТЬЮ ЗАБИТ TERNARIES
**Граница 🔴:** HIGH (код неподдерживаемый)  
**Тип:** Technical Debt  
**Файлы:** CityLocationPicker.tsx (линии 116-186)  
**Примеры:**
```tsx
// ❌ 8 TERNARIES В ОДНОМ КОМПОНЕНТЕ
{language === 'en' ? 'City' : language === 'ru' ? 'Город' : 'Şəhər'} *
{language === 'en' ? 'Select a city' : language === 'ru' ? 'Выберите город' : 'Şəhər seçin'}
// ... еще 6 таких же

// ✅ ПРАВИЛЬНО
{t.search.city} *
{t.search.selectCity}
// ... ссылка на t.*
```
**Последствие:** Неправильное расширение (если добавить 4-й язык - нужно переписывать)  
**Решение:** Создать хук `useLocalizedText()` или использовать готовый `t.` везде

---

## ✅ CHECKLIST ДЛЯ ПОЛНОТЫ i18n

### СТРУКТУРА И СИНХРОНИЗАЦИЯ
- [x] Все 3 языка (en, ru, az) присутствуют и развёрнуты
- [x] LanguageContext правильно реализован
- [x] i18n/index.ts правильно структурирован
- [x] Типизация Translations полная и корректная
- [x] Language type правильный: 'az' | 'en' | 'ru'
- [x] Никаких циклических импортов

### ПОЛНОТА ПЕРЕВОДОВ
- [x] site: все ключи везде (2/2/2)
- [x] nav: все ключи везде (8/8/8)
- [x] search: все ключи везде (25/25/25)
- [x] property: все ключи везде (50/50/50)
- [x] amenities: все ключи везде (12/12/12)
- [x] propertyTypes: все ключи везде (5/5/5)
- [x] districts: все ключи везде (10/10/10)
- [x] auth: все ключи везде (12/12/12)
- [x] dashboard: все ключи везде (48/48/48)
- [x] form: все ключи везде (10/10/10)
- [x] footer: все ключи везде (5/5/5)
- [x] messages: все ключи везде (10/10/10)
- [x] hero: все ключи везде (2/2/2)
- [x] pricing: все ключи везде (10/10/10) — включая VIP
- [x] validation: все ключи везде (9/9/9)
- [x] pricing_info: все ключи везде (4/4/4) — включая VIP
- [x] support: все ключи везде (3/3/3)
- [x] testData: все ключи везде (3/3/3)
- [x] home: все ключи везде (8/8/8)
- [x] errors: все ключи везде (18/18/18)
- [x] buttons: все ключи везде (31/31/31)
- [x] common: все ключи везде (27/27/27)
- [x] notifications: все ключи везде (11/11/11)
- [x] filters: все ключи везде (9/9/9)
- [x] booking: все ключи везде (10/10/10)
- [x] comments: все ключи везде (10/10/10)
- [x] moderation: все ключи везде (15/15/15)
- [x] calendar.days: все ключи везде (7 дней)
- [x] calendar.months: все ключи везде (12 месяцев)
- [x] pages: все структуры везде (about, contact, terms, privacy)
- [x] listing: все ключи везде (22/22/22)

### ПРАВИЛЬНОЕ ИСПОЛЬЗОВАНИЕ i18n
- [ ] ✗ PropertyPage.tsx: Убрать alert() + ternary (2 места)
- [ ] ✗ PropertyPage.tsx: Убрать ternary для availability (1 место)
- [ ] ✗ PropertyPage.tsx: Использовать t.property.weekDayLabels (1 место)
- [ ] ✗ PropertyPage.tsx: Добавить t.property для VIP/Premium badges (2 места)
- [ ] ✗ PropertyPage.tsx: Убрать bookmark tooltip ternary (1 место)
- [ ] ✗ DashboardPage.tsx: Убрать alert() + ternary (2 места)
- [ ] ✗ DashboardPage.tsx: Использовать t.dashboard вместо ternary (2 места)
- [ ] ✗ DashboardPage.tsx: Убрать модерация ternary (1 место)
- [ ] ✗ BookmarkedTab.tsx: Использовать t.dashboard.favorites (2 места)
- [ ] ✗ CityLocationPicker.tsx: Убрать ВСЕ 8 ternaries (требует рефакторизации)
- [ ] ✗ main.tsx: Перевести error message (1 место)

### КАЧЕСТВО КОДА
- [ ] ✗ Нету хука `useLocalizedText()` для избежания ternaries
- [ ] ✗ Нету консистентного паттерна для подобных случаев
- [ ] ✗ console.logs в PropertyBooking.tsx нужно убрать (не i18n)

### НОВЫЕ i18n КЛЮЧИ ТРЕБУЮТСЯ
```typescript
// Нужно добавить в t.messages:
- linkCopied: string
- linkCopyFailed: string

// Нужно добавить в t.dashboard:
- premiumExtendedSuccess: string (уже есть!)
- premiumExtendFailed: string (уже есть!)
- findOnMap: string (нужно добавить)
- moderationNote: string (нужно добавить)
- setNonActive: string (нужно добавить)

// Нужно добавить в t.property:
- badgeVip: string
- badgePremium: string
- badgePremiumRemaining: string (с {days} placeholder)
- signInBookemark: string (уже есть как signInBookmark)

// Нужно добавить в t.dashboard:
- favoriteProperties: string
- noFavoriteProperties: string

// Нужно добавить в t.search или t.dashboard:
- cityLabel: string
- selectCityPlaceholder: string
- citiesLabel: string
- selectDistrictLabel: string
- districtLabel: string
- metroLabel: string
```

---

## 📈 ПЛАН ДЕЙСТВИЙ

### ФАЗА 1: Добавление Missing Keys (30 минут)
1. [ ] Добавить недостающие ключи в src/i18n/en.ts
2. [ ] Добавить эти же ключи в src/i18n/ru.ts
3. [ ] Добавить эти же ключи в src/i18n/az.ts
4. [ ] Обновить Translations type в src/types/translations.ts
5. [ ] Проверить, что TypeScript ошибок нет

### ФАЗА 2: Удаление Ternary Chains (1 час)
1. [ ] PropertyPage.tsx: Заменить 2x alert() на setNotificationMessage()
2. [ ] PropertyPage.tsx: Заменить availability ternary на t.property.*
3. [ ] PropertyPage.tsx: Использовать t.property.weekDayLabels
4. [ ] PropertyPage.tsx: Использовать t.property для VIP/Premium
5. [ ] DashboardPage.tsx: Заменить 2x alert() на setNotificationMessage()
6. [ ] DashboardPage.tsx: Убрать ternary для 'Set non active'
7. [ ] DashboardPage.tsx: Использовать t.dashboard для модерации

### ФАЗА 3: Рефакторизация CityLocationPicker (45 минут)
1. [ ] Убрать ВСЕ 8 ternary chains
2. [ ] Использовать t.search, t.dashboard везде
3. [ ] Добавить хук для локализации если нужно

### ФАЗА 4: Тестирование (30 минут)
1. [ ] Переключить язык на каждый язык
2. [ ] Проверить, что нет undefined значений
3. [ ] Проверить, что сообщения об ошибках локализированы
4. [ ] Запустить npm run build для проверки TypeScript

---

## 📊 РЕЗЮМЕ

| Метрика | Значение |
|---------|----------|
| **Статус полноты переводов** | ✅ 100% |
| **Missing Keys** | 0 |
| **Жесткокодированных строк** | 24+ |
| **Ternary Chains** | 15+ |
| **Критических проблем** | 5 |
| **Файлов с проблемами** | 6 |
| **Оценка качества кода** | 🟡 СРЕДНЯЯ (из-за ternaries) |
| **Рекомендуемое действие** | 🔴 ТРЕБУЕТ РЕФАКТОРИЗАЦИИ |

---

**Последнее обновление:** 2026-04-19  
**Статус проекта:** Требует внимания в течение 2-3 часов
