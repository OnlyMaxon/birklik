// functions/src/utils/cleanup-safety.ts
/**
 * Правила безопасности для очистки данных
 * Защищает от случайного удаления важных данных
 */

export const CLEANUP_RULES = {
  // Статусы которые НИКОГДА не удаляем
  protectedStatuses: ['active', 'premium', 'featured', 'published'],

  // Минимальный возраст данных (дни) перед удалением
  minAgeInDays: {
    draft: 30,
    pending: 30,
    cancelled: 90,
    rejected: 90,
    testData: 7,
    failedBooking: 14,
  },

  // Максимум удалений за один раз
  maxDeletesPerRun: 100,

  // Коллекции, которые ЗАПРЕЩЕНО удалять автоматически
  protectedCollections: [
    'users',
    'payments',
    'transactions',
    'subscriptions',
  ],

  // Поля которые ДОЛЖНЫ присутствовать для удаления
  requiredFieldsForDeletion: {
    listings: ['status', 'createdAt'],
    bookings: ['status', 'createdAt'],
    comments: ['createdAt', 'userId'],
  },
};

/**
 * Проверяет безопасность перед удалением документа
 */
export async function validateSafeDelete(
  collection: string,
  doc: any
): Promise<{ safe: boolean; reason?: string }> {
  // Проверка 1: Защищённые статусы
  if (CLEANUP_RULES.protectedStatuses.includes(doc.status)) {
    return {
      safe: false,
      reason: `Protected status: ${doc.status}`,
    };
  }

  // Проверка 2: Возраст документа
  const ageInDays = calculateAgeInDays(doc.createdAt);
  const requiredAge = CLEANUP_RULES.minAgeInDays[doc.status as keyof typeof CLEANUP_RULES.minAgeInDays];

  if (requiredAge && ageInDays < requiredAge) {
    return {
      safe: false,
      reason: `Too young: ${ageInDays} days (minimum ${requiredAge})`,
    };
  }

  // Проверка 3 убрана.
  //
  // Здесь стояло `if (doc.isActive === true) → небезопасно`, а createProperty
  // ставит `isActive: true` вообще всем объявлениям. То есть проверка блокировала
  // не «живое», а вообще всё, и cleanupStalePendingListings не удалила бы ни
  // одной записи, даже если бы её запустили.
  //
  // Видимость на витрине определяет `status`, и он уже проверен выше списком
  // protectedStatuses. Поле isActive означает другое — временное «занято» на
  // выбранные владельцем даты, к удалению оно отношения не имеет.

  // Проверка 4: Недавние обновления
  if (doc.lastUpdated) {
    const updateAgeInDays = calculateAgeInDays(doc.lastUpdated);
    if (updateAgeInDays < 7) {
      return {
        safe: false,
        reason: `Recently updated: ${updateAgeInDays} days ago`,
      };
    }
  }

  return { safe: true };
}

/**
 * Вычисляет возраст документа в днях
 */
function calculateAgeInDays(timestamp: any): number {
  if (!timestamp) return 0;

  const createdDate =
    timestamp instanceof Date ? timestamp : timestamp.toDate?.() || new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - createdDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

;

