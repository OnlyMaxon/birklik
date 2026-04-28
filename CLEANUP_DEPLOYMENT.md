# 🚀 Deployment Guide - Cleanup System

## Этап 1: Подготовка

### 1.1 Установите зависимости functions

```bash
cd functions
npm install
cd ..
```

### 1.2 Убедитесь что Firebase CLI установлен

```bash
firebase --version
# Должно вывести версию > 12.0.0
```

### 1.3 Убедитесь что вы authenticated

```bash
firebase login
firebase use birklik-az  # или ваш project ID
```

## Этап 2: Локальное тестирование

### 2.1 Запустите DRY RUN (сухой прогон)

```bash
npm run cleanup:dry
```

**Ожидаемый результат:**
```
🧹 Birklik.az Cleanup Utility
📋 DRY RUN MODE - Ничего не будет удалено...

▶️  Starting Firestore cleanup...
✅ EXPIRED_PREMIUM: 5 items (234ms)
✅ DRAFT_LISTINGS: 12 items (456ms)
...
```

### 2.2 Проверьте что удалится

Посмотрите результаты - они должны быть разумными:
- Expired premium: несколько
- Old drafts: может быть 0
- Failed bookings: может быть 0
- Test data: может быть несколько

**❌ КРАСНЫЙ ФЛАГ** - если будет удалено > 1000 items за раз, проверьте конфигурацию

## Этап 3: Развертывание в Production

### 3.1 Сбилдьте functions

```bash
npm run functions:build
```

**Проверьте результат:**
```bash
ls functions/lib/
# Должны быть: index.js, cleanup/, utils/ и т.д.
```

### 3.2 Задеплойте функции

```bash
npm run functions:deploy
```

**Ожидаемый результат:**
```
✔ functions[weeklyFirestoreCleanup]: scheduled pubsub function deployed.
✔ functions[weeklyStorageCleanup]: scheduled pubsub function deployed.
✔ functions[manualCleanup]: http function deployed.

✔ Deploy complete!
```

### 3.3 Проверьте что функции развернулись

```bash
firebase functions:list
```

Должны увидеть:
- `weeklyFirestoreCleanup` (region: europe-west1)
- `weeklyStorageCleanup` (region: europe-west1)
- `manualCleanup` (region: europe-west1)

## Этап 4: Настройка Cloud Scheduler

### 4.1 Перейдите в Firebase Console

1. Откройте [Firebase Console](https://console.firebase.google.com)
2. Выберите ваш проект
3. Перейдите в **Functions** → **Triggers**

### 4.2 Проверьте расписание

- **weeklyFirestoreCleanup**: `every monday 02:00` ✓
- **weeklyStorageCleanup**: `every tuesday 02:00` ✓

### 4.3 Optionally: Enable notifications

Перейдите в Cloud Logging и настройте алерты на:
- `weeklyFirestoreCleanup` failures
- `weeklyStorageCleanup` failures

## Этап 5: Мониторинг

### 5.1 Смотрите логи

```bash
npm run functions:logs
```

Или в Firebase Console → Functions → Logs

### 5.2 Проверьте cleanup-logs коллекцию

```bash
firebase firestore:inspectIndexes
# Потом посмотрите cleanup-logs в Console
```

Должны увидеть записи после каждого запуска.

## Этап 6: После первого запуска

### 6.1 Проверьте результаты

1. Откройте Firebase Console
2. Перейдите в Firestore
3. Проверьте коллекцию `cleanup-logs`
4. Должны быть записи с типом `weekly_summary_firestore` и `weekly_summary_storage`

### 6.2 Проверьте что удалилось корректно

- Expired premium listings: no longer have premium flag ✓
- Old drafts: deleted ✓
- Failed bookings: deleted ✓
- Orphaned images: deleted from storage ✓

## 🚨 Если что-то пошло не так

### Функции не запускаются

**Причины:**
- Cloud Scheduler отключен
- Неправильные permissions
- Budget лимит достигнут

**Решение:**
```bash
# Проверьте статус
firebase functions:log | tail -100

# Или смотрите в Console → Functions → Logs
```

### Удаляется слишком много

**Причина:** Конфигурация настроена неправильно

**Решение:**
```bash
# Проверьте cleanup-safety.ts
# Увеличьте minAgeInDays значения
# Уменьшите maxDeletesPerRun
```

### Удаляется слишком мало

**Причина:** Может быть нормально (нечего удалять)

**Проверка:**
```bash
# Запустите DRY RUN еще раз
npm run cleanup:dry
```

## 📋 Чеклист перед Production

- [ ] DRY RUN запущен и результаты разумны
- [ ] Functions успешно задеплоены (`firebase functions:list`)
- [ ] Triggers видны в Console
- [ ] Firestore rules разрешают писать в `cleanup-logs`
- [ ] Storage permissions корректны
- [ ] backup/restore процедура протестирована
- [ ] Team уведомлен о автоматическом cleanup

## 📞 Support

При проблемах:
1. Проверьте `firebase functions:log`
2. Посмотрите `cleanup-logs` коллекцию
3. Проверьте serviceAccountKey.json permissions
4. Посмотрите firestore.rules и storage.rules

---

**Deploy Date**: 2026-04-28  
**Status**: Ready for Production ✅
