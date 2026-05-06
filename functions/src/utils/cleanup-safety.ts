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

  // Проверка 3: Активные documents (только явное true блокирует)
  if (doc.isActive === true) {
    return {
      safe: false,
      reason: 'Document is still active',
    };
  }

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

/**
 * Типы очистки и их конфигурация
 */
export interface CleanupType {
  name: string;
  collection: string;
  query: {
    field: string;
    operator: '<' | '==' | '!=';
    value: any;
  }[];
  batchSize: number;
  description: string;
}

export const CLEANUP_TYPES: Record<string, CleanupType> = {
  EXPIRED_PREMIUM: {
    name: 'Expired Premium Listings',
    collection: 'properties',
    query: [
      { field: 'listingTier', operator: '==', value: 'premium' },
      { field: 'premiumExpiresAt', operator: '<', value: new Date().toISOString() },
    ],
    batchSize: 50,
    description: 'Remove premium status from expired listings',
  },

  REJECTED_LISTINGS: {
    name: 'Old Rejected Listings',
    collection: 'properties',
    query: [
      { field: 'status', operator: '==', value: 'pending' },
      { field: 'createdAt', operator: '<', value: getDateDaysAgo(30) },
    ],
    batchSize: 100,
    description: 'Delete pending listings older than 30 days (likely stuck)',
  },

  CANCELLED_BOOKINGS: {
    name: 'Old Cancelled Bookings',
    collection: 'bookings',
    query: [
      { field: 'status', operator: '==', value: 'cancelled' },
      { field: 'createdAt', operator: '<', value: getDateDaysAgo(90) },
    ],
    batchSize: 100,
    description: 'Delete cancelled bookings older than 90 days',
  },

  REJECTED_BOOKINGS: {
    name: 'Old Rejected Bookings',
    collection: 'bookings',
    query: [
      { field: 'status', operator: '==', value: 'rejected' },
      { field: 'createdAt', operator: '<', value: getDateDaysAgo(30) },
    ],
    batchSize: 100,
    description: 'Delete rejected bookings older than 30 days',
  },

  TEST_DATA: {
    name: 'Test Data',
    collection: 'properties',
    query: [
      { field: 'isTest', operator: '==', value: true },
      { field: 'createdAt', operator: '<', value: getDateDaysAgo(7) },
    ],
    batchSize: 100,
    description: 'Delete test listings older than 7 days',
  },
};

/**
 * Вспомогательная функция для получения даты N дней назад
 */
export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
