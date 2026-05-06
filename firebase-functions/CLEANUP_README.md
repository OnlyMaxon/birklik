# 🧹 Birklik.az Cleanup System

Полностью автоматизированная система еженедельной очистки данных Firestore и Storage.

## 📋 Что удаляется

### Firestore Cleanup (По понедельникам)
- ✅ **Expired Premium**: Удаляет premium status с истекших listings
- ✅ **Old Draft Listings**: Удаляет черновики старше 30 дней
- ✅ **Failed Bookings**: Удаляет неудачные bookings старше 14 дней
- ✅ **Test Data**: Удаляет test listings старше 7 дней

### Storage Cleanup (По вторникам)
- ✅ **Orphaned Images**: Удаляет изображения без ссылки в документе
- ✅ **Temp Files**: Удаляет временные файлы старше 24 часов
- ✅ **Old Avatars**: Удаляет неиспользуемые аватары старше 1 года

## 🛡️ Безопасность

Все операции защищены многоуровневой проверкой:

1. **Статус проверка** - Активные документы не трогаются
2. **Возраст проверка** - Только документы старше минимального возраста
3. **Batch limit** - Максимум 100 удалений за раз
4. **Логирование** - Все операции записываются в `cleanup-logs`
5. **Validation** - Двойная проверка перед каждым удалением

## 🚀 Как использовать

### Автоматический запуск (Production)

Система автоматически запускается:
- **Понедельник 02:00 UTC** - Firestore cleanup
- **Вторник 02:00 UTC** - Storage cleanup

### Ручной запуск (Local Testing)

```bash
# Сухой прогон - показывает что удалится БЕЗ удаления
npm run cleanup:dry

# Реальное выполнение - удаляет данные
npm run cleanup:execute
```

### HTTP запрос (Production)

```bash
curl -X POST https://your-project.cloudfunctions.net/manualCleanup \
  -H "Authorization: Bearer YOUR_CLEANUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

## 📊 Логирование

Все результаты cleanup записываются в Firestore коллекцию `cleanup-logs`:

```javascript
{
  timestamp: Date,
  type: string,        // 'expired_premium', 'draft_listings' и т.д.
  status: string,      // 'success' | 'failed' | 'partial'
  count: number,       // Сколько удалено
  deletedIds: array,   // IDs удаленных документов
  error?: string,      // Если была ошибка
  duration: number     // Время выполнения в мс
}
```

## 🔧 Конфигурация

Правила в `functions/src/utils/cleanup-safety.ts`:

```typescript
CLEANUP_RULES = {
  // Статусы которые никогда не удаляются
  protectedStatuses: ['active', 'premium', 'featured'],
  
  // Минимальный возраст перед удалением (дни)
  minAgeInDays: {
    draft: 30,
    cancelled: 90,
    testData: 7
  },
  
  // Максимум удалений за раз
  maxDeletesPerRun: 100
}
```

## ⚠️ Важно

1. **Backup** - Firebase автоматически хранит backups
2. **Monitoring** - Проверяйте `cleanup-logs` коллекцию
3. **Testing** - Всегда сначала запустите `--dry-run`
4. **Permissions** - Убедитесь что Cloud Functions имеют нужные права

## 🐛 Troubleshooting

### Cleanup не запускается

Проверьте:
- [ ] Cloud Functions deployed (`firebase deploy --only functions`)
- [ ] Cloud Scheduler enabled в проекте
- [ ] Firestore rules разрешают запись в `cleanup-logs`

### Ошибка: "Too many deletes"

Система автоматически ограничивает удаления до 100 за раз. Если больше - запустится повторный запрос в следующую неделю.

### Нужно отменить удаление

К сожалению, Firestore удаления необратимы. Однако:
- Backup можно восстановить
- Storage файлы хранятся с timestamp в имени
- Все операции залогированы

## 📞 Поддержка

При проблемах проверьте:
1. Логи в Cloud Functions (Firebase Console)
2. `cleanup-logs` в Firestore
3. Storage permissions в `storage.rules`

---

**Статус**: ✅ Production Ready | Последнее обновление: 2026-04-28
