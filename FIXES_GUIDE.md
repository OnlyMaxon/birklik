# 🛠️ ПРАКТИЧЕСКИЙ ГАЙД ПО ИСПРАВЛЕНИЯМ

## Примеры кода для решения критических проблем

---

## 1️⃣ УДАЛЕНИЕ console.log ИЗ PRODUCTION

### Проблема
```typescript
// ❌ PropertyBooking.tsx:76-113
console.log('[PropertyBooking] isBooking changed to:', isBooking)
console.log('[PropertyBooking] Selected dates changed:', { selectedCheckIn, selectedCheckOut })
```

### Решение

**Шаг 1: Обновить logger.ts**
```typescript
// src/services/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDevelopment = process.env.NODE_ENV === 'development'
const logLevel: LogLevel = isDevelopment ? 'debug' : 'warn'

const logLevelMap = { debug: 0, info: 1, warn: 2, error: 3 }

export const debug = (message: string, data?: unknown): void => {
  if (isDevelopment) {
    console.debug(`[DEBUG] ${message}`, data)
  }
}

export const info = (message: string, data?: unknown): void => {
  if (isDevelopment) {
    console.info(`[INFO] ${message}`, data)
  }
}

export const warn = (message: string, data?: unknown): void => {
  console.warn(`[WARN] ${message}`, data)
}

export const error = (message: string, error?: unknown): void => {
  console.error(`[ERROR] ${message}`, error)
  // TODO: Отправить на backend логирование сервис
  if (!isDevelopment) {
    sendErrorToBackend(message, error)
  }
}

const sendErrorToBackend = async (message: string, error: unknown) => {
  try {
    // Отправить на backend
    // await fetch('/api/logs', { method: 'POST', body: JSON.stringify(...) })
  } catch (e) {
    // Ignore
  }
}
```

**Шаг 2: Заменить все console.log на logger**
```typescript
// PropertyBooking.tsx

// ❌ БЫЛО:
console.log('[PropertyBooking] isBooking changed to:', isBooking)
console.log('[PropertyBooking] Selected dates changed:', { selectedCheckIn, selectedCheckOut })
console.log('[PropertyBooking] handleCancelBooking called:', { lastBookingId })

// ✅ ДОЛЖНО БЫТЬ:
import * as logger from '../../services/logger'

// В development:
logger.debug('isBooking changed to:', isBooking)
logger.debug('Selected dates changed:', { selectedCheckIn, selectedCheckOut })
logger.debug('handleCancelBooking called:', { lastBookingId })

// Production будет молчать
```

---

## 2️⃣ ЗАМЕНА `any` НА ПРАВИЛЬНЫЕ ТИПЫ

### Проблема
```typescript
// ❌ utils/errorHandler.ts
export const parseFirebaseError = (error: any): AppError
export const getErrorMessage = (error: any): string
```

### Решение

**Создать правильные типы:**
```typescript
// src/types/errors.ts
export interface FirebaseErrorBase {
  code?: string
  message?: string
}

export class AppError extends Error {
  constructor(
    public message: string,
    public code?: string,
    public details?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: string) {
    super(message, 'validation-error', details)
    this.name = 'ValidationError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: string) {
    super(message, 'database-error', details)
    this.name = 'DatabaseError'
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: string) {
    super(message, 'network-error', details)
    this.name = 'NetworkError'
  }
}
```

**Обновить errorHandler:**
```typescript
// ✅ utils/errorHandler.ts
import { FirebaseErrorBase, AppError, ValidationError, DatabaseError, NetworkError } from '../types'

export const parseFirebaseError = (error: unknown): AppError => {
  // Если это уже AppError, вернуть как-есть
  if (error instanceof AppError) {
    return error
  }

  // Если это Error
  if (error instanceof Error) {
    const firebaseErr = error as FirebaseErrorBase
    
    if (firebaseErr.code?.includes('auth/')) {
      if (firebaseErr.code === 'auth/user-not-found') {
        return new ValidationError('Invalid email or password')
      }
      if (firebaseErr.code === 'auth/weak-password') {
        return new ValidationError('Password does not meet security requirements')
      }
      // ... больше cases
    }

    return new DatabaseError(firebaseErr.message || 'An error occurred', error.message)
  }

  // За пределами всех типов
  return new AppError('An unexpected error occurred')
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred. Please try again.'
}

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof NetworkError) return true
  
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('timeout')
  }
  
  return false
}
```

**Использование:**
```typescript
// ✅ bookingService.ts
try {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), bookingData)
  return { id: docRef.id, ...bookingData } as Booking
} catch (error) {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    throw new ValidationError('You do not have permission to create bookings')
  }
  throw new DatabaseError('Failed to create booking', getErrorMessage(error))
}
```

---

## 3️⃣ ИСПРАВЛЕНИЕ N+1 FIRESTORE QUERIES

### Проблема
```typescript
// ❌ PropertyPage.tsx:87-127
const loadProperty = async () => {
  const data = await getPropertyById(id)                      // Query 1
  const favorited = await isPropertyFavorited(...)           // Query 2
  const booked = await hasUserBookedProperty(user.id, id)    // Query 3
  const rating = await getUserRatingForProperty(id, user.id) // Query 4
  const bookings = await getPropertyBookings(id)             // Query 5
}
```

### Решение

**Оптимизировать с Promise.all:**
```typescript
// ✅ PropertyPage.tsx
const loadProperty = async () => {
  try {
    setIsLoading(true)
    
    // Загрузить основное свойство + bookings параллельно
    const [data, bookings] = await Promise.all([
      getPropertyById(id),
      getPropertyBookings(id)
    ])

    if (!data) {
      setProperty(null)
      setIsLoading(false)
      return
    }

    setProperty(data)

    // Если есть user - загрузить user-specific данные
    if (user) {
      const [booked, rating] = await Promise.all([
        hasUserBookedProperty(user.id, id),
        getUserRatingForProperty(id, user.id)
      ])

      setUserBooked(booked)
      setUserRating(rating)
    }

    setShowNotification(true)
    setIsLoading(false)
  } catch (error) {
    logger.error('Error loading property:', error)
    setError('Failed to load property')
    setIsLoading(false)
  }
}
```

---

## 4️⃣ ДОБАВЛЕНИЕ React.memo К КОМПОНЕНТАМ

### Проблема
```typescript
// ❌ PropertyCard.tsx - re-renders при каждом рендере родителя
export const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property, 
  checkIn, 
  checkOut,
  onFavoriteToggle
}) => {
  // Component
}
```

### Решение

```typescript
// ✅ PropertyCard.tsx
interface PropertyCardProps {
  property: Property
  checkIn?: string
  checkOut?: string
  onFavoriteToggle?: (propertyId: string, isFavorited: boolean) => void
}

// Кастомный comparator для правильного сравнения
const arePropsEqual = (prevProps: PropertyCardProps, nextProps: PropertyCardProps): boolean => {
  return (
    prevProps.property.id === nextProps.property.id &&
    prevProps.property.images[0] === nextProps.property.images[0] &&
    prevProps.property.price.daily === nextProps.property.price.daily &&
    prevProps.checkIn === nextProps.checkIn &&
    prevProps.checkOut === nextProps.checkOut &&
    // onFavoriteToggle - сравнивать функцию осторожно (всегда useCallback в parent!)
    prevProps.onFavoriteToggle === nextProps.onFavoriteToggle
  )
}

export const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ 
  property, 
  checkIn, 
  checkOut,
  onFavoriteToggle
}) => {
  const { language, t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  
  // ... component code
  
  return (
    // JSX
  )
}, arePropsEqual)
```

**В родительском компоненте используйте useCallback:**
```typescript
// ✅ HomePage.tsx
const handleFavoriteToggle = useCallback((propertyId: string, isFavorited: boolean) => {
  // Логика
}, []) // Зависимости

const filteredProperties = React.useMemo(() => {
  return filterProperties(properties, { ... })
}, [properties, filters])

return (
  <>
    {filteredProperties.map(property => (
      <PropertyCard
        key={property.id}
        property={property}
        checkIn={filters.checkIn}
        checkOut={filters.checkOut}
        onFavoriteToggle={handleFavoriteToggle}  // ✅ Стабильная ссылка
      />
    ))}
  </>
)
```

---

## 5️⃣ СОЗДАНИЕ CUSTOM HOOKS

### useIsModerator Hook

**Problem:**
```typescript
// ❌ Дублируется в Header, DashboardPage, ModerationPage, ModerationReviewPage
React.useEffect(() => {
  const checkModerator = async () => {
    if (firebaseUser) {
      const token = await firebaseUser.getIdTokenResult()
      setIsModeratorUser(isModerator(token))
    }
  }
  checkModerator()
}, [firebaseUser])
```

**Solution:**
```typescript
// ✅ src/hooks/useIsModerator.ts
import { useState, useEffect } from 'react'
import { useAuth } from '../context'
import { isModerator } from '../config/constants'

export const useIsModerator = (): boolean => {
  const { firebaseUser } = useAuth()
  const [isMod, setIsMod] = useState(false)

  useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsMod(isModerator(token))
      } else {
        setIsMod(false)
      }
    }

    checkModerator()
  }, [firebaseUser])

  return isMod
}
```

**Usage:**
```typescript
// ✅ Header.tsx
export const Header: React.FC = () => {
  const isMod = useIsModerator()  // Одна строка!
  
  return (
    <>
      {isMod && (
        <NavLink to="/dashboard/review">Moderation</NavLink>
      )}
    </>
  )
}
```

### useFavorite Hook

```typescript
// ✅ src/hooks/useFavorite.ts
import { useState, useCallback } from 'react'
import { useAuth } from '../context'
import { useLanguage } from '../context'
import { toggleFavorite, isPropertyFavorited } from '../services/favoritesService'
import * as logger from '../services/logger'

export const useFavorite = (propertyId: string, initialFavorites?: string[]) => {
  const { user, isAuthenticated } = useAuth()
  const { language, t } = useLanguage()
  const [isFavorited, setIsFavorited] = useState(
    isPropertyFavorited(initialFavorites || [], user?.id ?? '')
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setError(t.errors.signin_to_favorite)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await toggleFavorite(propertyId, user.id, isFavorited)
      setIsFavorited(!isFavorited)
    } catch (err) {
      logger.error('Error toggling favorite:', err)
      setError(t.errors.favorite_update_failed)
    } finally {
      setIsLoading(false)
    }
  }, [propertyId, user, isAuthenticated, isFavorited, language, t])

  return {
    isFavorited,
    isLoading,
    error,
    toggle
  }
}
```

**Usage:**
```typescript
// ✅ PropertyCard.tsx
export const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ property, ... }) => {
  const { isFavorited, isLoading, error, toggle } = useFavorite(property.id, property.favorites)

  return (
    <button onClick={toggle} disabled={isLoading}>
      {isFavorited ? '♥' : '♡'}
    </button>
  )
})
```

---

## 6️⃣ ИСПРАВЛЕНИЕ API CALL SECURITY

### Проблема
```typescript
// ❌ DashboardPage.tsx:414-431 - No Rate Limiting
const handleSearchLocation = async () => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationSearch)}&format=json&limit=5`
  const response = await fetch(url)
}
```

### Решение

**Создать debounced + limited service:**
```typescript
// ✅ src/services/geocodingService.ts
import { debounce } from 'lodash-es'

interface GeocodingResult {
  lat: string
  lon: string
  display_name: string
}

const cache = new Map<string, GeocodingResult[]>()

export const geocodingService = {
  async search(query: string): Promise<GeocodingResult[]> {
    if (!query || query.trim().length < 3) {
      return []
    }

    // Проверить кеш
    if (cache.has(query)) {
      return cache.get(query) || []
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.append('q', query)
      url.searchParams.append('format', 'json')
      url.searchParams.append('limit', '5')

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Birklik.az (+https://birklik.az)'
        }
      })

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`)
      }

      const results: GeocodingResult[] = await response.json()

      // Сохранить в кеш на 1 час
      cache.set(query, results)
      setTimeout(() => cache.delete(query), 3600000)

      return results
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Geocoding request timeout')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
```

**Использование с debounce:**
```typescript
// ✅ DashboardPage.tsx
const handleSearchLocation = useCallback(
  debounce(async (query: string) => {
    if (query.length < 3) return

    setIsSearchingLocation(true)
    setLocationSearchError('')

    try {
      const results = await geocodingService.search(query)

      if (results.length === 0) {
        setLocationSearchError(t.dashboard.noResults)
        return
      }

      setListingCoordinates({
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon)
      })
    } catch (error) {
      logger.error('Geocoding error:', error)
      setLocationSearchError(t.dashboard.locationError)
    } finally {
      setIsSearchingLocation(false)
    }
  }, 500),  // 500ms debounce
  [t, language]
)
```

---

## 7️⃣ УСИЛЕНИЕ ВАЛИДАЦИИ ПАРОЛЯ

### Проблема
```typescript
// ❌ validators.ts - Только 6 символов
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') return false
  return password.length >= 6
}
```

### Решение

```typescript
// ✅ validators.ts
export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = []

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] }
  }

  if (password.length < 8) {
    errors.push('Minimum 8 characters required')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Must contain lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Must contain number')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Must contain special character (!@#$%^&*)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Использование:
// ✅ RegisterPage.tsx
const validation = validatePassword(password)
if (!validation.valid) {
  return { success: false, error: validation.errors.join(', ') }
}
```

---

## 8️⃣ РАЗБИЕНИЕ DashboardPage НА КОМПОНЕНТЫ

### Текущая структура (❌)
```
DashboardPage.tsx - 1100+ строк
```

### Новая структура (✅)
```
DashboardPage/
├── DashboardPage.tsx (основной компонент с routing, ~200 строк)
├── ListingsTab.tsx (управление объявлениями, ~300 строк)
├── AddListingForm.tsx (форма добавления/редактирования, ~400 строк)
├── ProfileTab.tsx (профиль пользователя, ~150 строк)
├── FavoritesTab.tsx (уже существует)
├── BookingsTab.tsx (уже существует)
└── components/
    ├── ListingCard.tsx
    ├── PropertyForm.tsx
    ├── LocationPicker.tsx
    └── ...
```

**Пример разбиения:**
```typescript
// ✅ DashboardPage/ListingsTab.tsx
import React from 'react'
import { Property } from '../../types'
import { useLanguage, useAuth } from '../../context'
import * as logger from '../../services/logger'

interface ListingsTabProps {
  listings: Property[]
  isLoading: boolean
  onEdit: (listing: Property) => void
  onDelete: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export const ListingsTab: React.FC<ListingsTabProps> = ({
  listings,
  isLoading,
  onEdit,
  onDelete,
  onRefresh
}) => {
  const { t, language } = useLanguage()
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm(t.dashboard.confirmDelete)) return

    setDeleting(id)
    try {
      await onDelete(id)
      await onRefresh()
    } catch (error) {
      logger.error('Error deleting listing:', error)
      alert(t.errors.delete_failed)
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="listings-tab">
      <h2>{t.dashboard.myListings}</h2>
      {listings.map(listing => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onEdit={() => onEdit(listing)}
          onDelete={() => handleDelete(listing.id)}
          isDeleting={deleting === listing.id}
        />
      ))}
    </div>
  )
}
```

---

## 9️⃣ PROPER ERROR HANDLING В HANDLERS

### Проблема
```typescript
// ❌ PropertyPage.tsx:289-310 - Нет try-catch
const handleAddComment = async () => {
  const success = await addCommentToProperty(...)  // Может выбросить ошибку!
  if (success) {
    // ...
  }
}
```

### Решение

```typescript
// ✅ PropertyPage.tsx
const handleAddComment = async () => {
  if (!newComment.trim()) {
    setCommentError(t.errors.empty_comment)
    return
  }

  if (!isAuthenticated || !user) {
    setCommentError(t.errors.signin_to_comment)
    return
  }

  setIsAddingComment(true)
  setCommentError('')

  try {
    const success = await addCommentToProperty(
      property.id,
      user.id,
      user.name || 'Anonymous',
      user.avatar,
      newComment
    )

    if (!success) {
      setCommentError(t.errors.comment_failed)
      return
    }

    // Refresh property data
    const updated = await getPropertyById(property.id)
    if (updated) {
      setProperty(updated)
    }

    // Send notification to owner
    await createCommentNotification(property.ownerId, {
      type: 'comment',
      propertyId: property.id,
      commentText: newComment,
      commenterName: user.name || 'Anonymous',
      read: false
    })

    setNewComment('')
  } catch (error) {
    logger.error('Error adding comment:', error)
    setCommentError(getErrorMessage(error))
  } finally {
    setIsAddingComment(false)
  }
}
```

---

## 🔟 FIRESTORE SECURITY RULES CHECKLIST

**firestore.rules - ДОЛЖНО СОДЕРЖАТЬ:**

```typescript
// ✅ Публичные данные для читации
match /properties/{propertyId} {
  allow read: if true;  // Все могут читать свойства
  allow create: if request.auth != null;  // ТолькоAuth пользователи могут создавать
  allow update: if request.auth != null && 
                   resource.data.ownerId == request.auth.uid;  // Только владелец может обновлять
  allow delete: if request.auth != null && 
                   resource.data.ownerId == request.auth.uid;  // Только владелец может удалять
}

// ✅ Приватные данные пользователя
match /users/{userId} {
  allow read: if request.auth.uid == userId;  // Только свой профиль
  allow write: if request.auth.uid == userId;  // Только свой профиль
}

// ✅ Bookings - Только владелец и гость
match /bookings/{bookingId} {
  allow read: if request.auth.uid == resource.data.userId || 
                 request.auth.uid == resource.data.ownerId;
  allow create: if request.auth != null && 
                   request.auth.uid == request.resource.data.userId;
  allow update: if request.auth.uid == resource.data.ownerId;  // Только владелец может обновлять
}

// ✅ Comments - Модерируемые
match /properties/{propertyId}/comments/{commentId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update: if request.auth.uid == resource.data.userId;  // Только автор
  allow delete: if request.auth.uid == resource.data.userId || 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}
```

---

## ИТОГОВЫЙ CHECKLIST ДЛЯ РАЗРАБОТЧИКА

- [ ] Удалить все `console.log` из production кода
- [ ] Заменить 20+ `any` типов на правильные типы ошибок
- [ ] Добавить try-catch во все async handlers
- [ ] Оптимизировать PropertyPage Firestore queries (Promise.all)
- [ ] Обернуть PropertyCard в React.memo
- [ ] Создать useIsModerator hook
- [ ] Создать useFavorite hook
- [ ] Добавить debounce к API geocoding
- [ ] Усилить валидацию пароля (8+ символов, complexity)
- [ ] Разбить DashboardPage на подкомпоненты
- [ ] Добавить useCallback на обработчики событий
- [ ] Проверить Firestore Security Rules
- [ ] Добавить DOMPurify для XSS защиты
- [ ] Создать кастомные типы ошибок (ValidationError, DatabaseError, etc)
- [ ] Добавить retry логику для API вызовов

---

**Документ создан:** April 19, 2026
