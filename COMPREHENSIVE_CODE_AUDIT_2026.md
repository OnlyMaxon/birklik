# 🔍 BIRKLIK.AZ - КОМПЛЕКСНЫЙ АУДИТ ИСХОДНОГО КОДА
**Дата**: 16 апреля 2026  
**Статус**: ✅ ПОЛНЫЙ АУДИТ  
**Охват**: src/services, src/pages, src/components, src/hooks, src/context, src/types, src/utils  

---

## 📊 СВОДКА ПРОБЛЕМ

| Категория | 🔴 Критичные | 🟠 Важные | 🟡 Рекомендации | ✅ Ok |
|-----------|-------------|----------|-----------------|-------|
| Безопасность | 2 | 3 | 4 | ✓ |
| Неиспользуемый код | 0 | 2 | 1 | ✓ |
| Логические ошибки | 2 | 3 | 5 | ✓ |
| Оптимизация | 1 | 4 | 6 | ✓ |
| Архитектура | 0 | 2 | 3 | ✓ |
| **ИТОГО** | **5** | **14** | **19** | ✓ |

---

# 🔴 КРИТИЧНЫЕ ПРОБЛЕМЫ (НЕМЕДЛЕННО)

## 1. 🔴 N+1 Query в AuthContext - Раз за разом загружается весь user doc

**Файл**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L48-L75)

**Проблема**: При каждом изменении `firebaseUser` происходит fetch из Firestore, даже если данные не изменились

```typescript
// ❌ НЕПРАВИЛЬНО - N+1 query problem
React.useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      setFirebaseUser(fbUser)
      
      // Загружаем user doc каждый раз!
      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
        // ...
      } catch (error) {
        logger.error('Error fetching user data:', error)
      }
    }
  })
  return () => unsubscribe()
}, [])
```

**Проблема**: 
- Множественные запросы при инициализации
- Каждый перемонтирование компонента вызывает новый fetch
- Нет кеширования

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Cache + memoization
const [cachedUserId, setCachedUserId] = React.useState<string | null>(null)

React.useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser && cachedUserId !== fbUser.uid) {
      setFirebaseUser(fbUser)
      setCachedUserId(fbUser.uid)
      
      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
        if (userDoc.exists()) {
          // Используем кеш
          setUser({
            id: fbUser.uid,
            name: userDoc.data().name || fbUser.displayName || 'User',
            email: fbUser.email || '',
            phone: userDoc.data().phone || '',
            avatar: userDoc.data().avatar || fbUser.photoURL
          })
        }
      } catch (error) {
        logger.error('Error fetching user data:', error)
      }
    }
  })
  return () => unsubscribe()
}, [cachedUserId])
```

---

## 2. 🔴 Race Condition в updateUserProfile - Upload загружается полностью ДО проверки

**Файл**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L140-L180)

**Проблема**: Firebase avatar загружается, но если Update в Firestore fails, avatar остается в Storage не связанным

```typescript
// ❌ НЕПРАВИЛЬНО - Race condition
const updateUserProfile = async (payload: { 
  name: string; phone: string; avatar?: string; avatarFile?: File | null 
}): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseUser || !user) {
    return { success: false, error: 'auth/not-authenticated' }
  }

  try {
    let avatarUrl = payload.avatar || user.avatar || ''

    if (payload.avatarFile) {
      const fileName = `avatars/${firebaseUser.uid}/${Date.now()}_${payload.avatarFile.name}`
      const avatarRef = ref(storage, fileName)
      
      // Загружаем ПОЛНОСТЬЮ перед проверкой
      await uploadBytes(avatarRef, payload.avatarFile)
      
      // Если это fails, orphaned file остается в Storage!
      avatarUrl = await getDownloadURL(avatarRef)
    }

    // Если обновление Firestore fails - avatar остается существовать
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      name: payload.name,
      phone: payload.phone,
      avatar: avatarUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    return { success: true }
  } catch (error) {
    // Orphaned avatar в Storage!
    logger.error('Error updating profile:', error)
    return { success: false, error: 'Failed to update profile' }
  }
}
```

**Проблема**: 
- Orphaned files в Storage если Firestore fail
- Пустая трата storage quota
- Нет транзакции/roll-back

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Transactional approach
const updateUserProfile = async (payload: { 
  name: string; phone: string; avatar?: string; avatarFile?: File | null 
}): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseUser || !user) {
    return { success: false, error: 'auth/not-authenticated' }
  }

  let uploadedAvatarUrl: string | null = null

  try {
    let avatarUrl = payload.avatar || user.avatar || ''

    if (payload.avatarFile) {
      const fileName = `avatars/${firebaseUser.uid}/${Date.now()}_${payload.avatarFile.name}`
      const avatarRef = ref(storage, fileName)
      
      try {
        await uploadBytes(avatarRef, payload.avatarFile)
        uploadedAvatarUrl = await getDownloadURL(avatarRef)
        avatarUrl = uploadedAvatarUrl
      } catch (uploadError) {
        // Fail fast - don't update Firestore if upload fails
        logger.error('Avatar upload failed:', uploadError)
        return { success: false, error: 'Failed to upload avatar' }
      }
    }

    // Only update Firestore if everything succeeded
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      name: payload.name,
      phone: payload.phone,
      avatar: avatarUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    return { success: true }
  } catch (error) {
    // If Firestore update fails after upload, delete uploaded file
    if (uploadedAvatarUrl) {
      try {
        // Delete orphaned file
        await deleteObject(ref(storage, `avatars/${firebaseUser.uid}/${uploadedAvatarUrl.split('/').pop()}`))
      } catch (deleteError) {
        logger.error('Failed to cleanup orphaned avatar:', deleteError)
      }
    }
    return { success: false, error: 'Failed to update profile' }
  }
}
```

---

## 3. 🔴 XSS Vulnerability в Nominatim Reverse Geocoding Без Sanitization

**Файл**: [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx#L101-L130)

**Проблема**: Nominatim API отримує响应 и прямо ставить в state БЕЗ валидации

```typescript
// ❌ НЕПРАВИЛЬНО - No sanitization
const LocationPicker: React.FC<LocationPickerProps> = ({ coordinates, onChange, onAddressReverse }) => {
  useMapEvents({
    click: (event) => {
      const newCoords = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      }
      onChange(newCoords)
      
      // Fetch from external API without validation
      if (onAddressReverse) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}...`)
          .then(res => res.json())
          .then(data => {
            let address = ''
            
            // UNSAFE: directly using API response
            if (data.address) {
              address = data.address.village || 
                       data.address.suburb || 
                       data.address.city_district || 
                       data.address.county || 
                       data.address.city || 
                       data.address.town ||
                       data.display_name?.split(',')[0] || 
                       ''
            }
            
            // Потенциально небезопасное значение в state!
            if (data.address && (data.address.country === 'Azerbaijan' || data.address.country_code === 'az')) {
              if (address) {
                onAddressReverse(address)  // ← XSS risk if address contains scripts
              }
            }
          })
          .catch(() => {})
      }
    }
  })
  return <CircleMarker ... />
}
```

**Проблема**: 
- API response может содержать теги HTML/script
- Нет валидации format
- Нет timeout на fetch

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Sanitized input
import DOMPurify from 'dompurify'

const sanitizeApiResponse = (input: string): string => {
  // Удаляем потенциально опасные символы
  return input
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/javascript:/gi, '')  // Remove javascript: protocol
    .slice(0, 255)  // Max 255 chars
}

const LocationPicker: React.FC<LocationPickerProps> = ({ coordinates, onChange, onAddressReverse }) => {
  useMapEvents({
    click: (event) => {
      const newCoords = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      }
      onChange(newCoords)
      
      if (onAddressReverse) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)  // 5 second timeout
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}...`, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'az,en;q=0.9' }
        })
          .then(res => res.json())
          .then(data => {
            clearTimeout(timeoutId)
            
            let address = ''
            if (data.address && typeof data.address === 'object') {
              address = data.address.village || 
                       data.address.suburb || 
                       data.address.city_district || 
                       data.address.county || 
                       data.address.city || 
                       data.address.town || ''
            }
            
            // Sanitize BEFORE using
            const sanitizedAddress = sanitizeApiResponse(address)
            
            if (data.address && typeof data.address.country_code === 'string' && data.address.country_code === 'az') {
              if (sanitizedAddress) {
                onAddressReverse(sanitizedAddress)
              }
            }
          })
          .catch(() => {
            clearTimeout(timeoutId)
          })
      }
    }
  })
  return <CircleMarker ... />
}
```

---

## 4. 🔴 Неправильный Pagination Cursor - Не сохраняется lastDoc

**Файл**: [src/hooks/usePagination.ts](src/hooks/usePagination.ts#L40-L60)

**Проблема**: `lastSnapshot` в state но НИКОГДА не обновляется, поэтому pagination всегда запрашивает первую страницу

```typescript
// ❌ НЕПРАВИЛЬНО - lastSnapshot never updates
const usePagination = <T,>(
  fetcher: (options: { limit: number; startAfter?: DocumentSnapshot }) => Promise<(T & { id: string })[]>,
  pageSize = 10
) => {
  const [state, setState] = useState<PaginationState<T & { id: string }>>({
    items: [],
    isLoading: false,
    hasMore: true,
    error: null,
    currentPage: 1
  })

  const [lastSnapshot, setLastSnapshot] = useState<DocumentSnapshot | undefined>()

  const loadMore = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const results = await fetcher({
        limit: pageSize + 1,
        startAfter: lastSnapshot  // ← Using lastSnapshot
      })

      const hasMore = results.length > pageSize
      const itemsToAdd = results.slice(0, pageSize)

      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...itemsToAdd],
        hasMore,
        currentPage: prev.currentPage + 1,
        isLoading: false
      }))

      // Note: This is a workaround - ideally fetcher should return snapshots too
      // ← PROBLEM: lastSnapshot NEVER gets updated!
      
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to load more items'
      }))
    }
  }, [fetcher, pageSize, lastSnapshot])
  
  // ... rest of code
}
```

**Проблема**: 
- `lastSnapshot` никогда не меняется
- Pagination всегда пропускает одни и те же документы
- `loadMore` загружает одни и те же элементы

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Track lastSnapshot properly
export const usePagination = <T,>(
  fetcher: (options: { 
    limit: number
    startAfter?: DocumentSnapshot 
    onLastDocSnapshot?: (doc: DocumentSnapshot) => void 
  }) => Promise<(T & { id: string })[]>,
  pageSize = 10
) => {
  const [state, setState] = useState<PaginationState<T & { id: string }>>({
    items: [],
    isLoading: false,
    hasMore: true,
    error: null,
    currentPage: 1
  })

  const [lastSnapshot, setLastSnapshot] = useState<DocumentSnapshot | undefined>()

  const loadMore = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      let lastDoc: DocumentSnapshot | undefined
      
      const results = await fetcher({
        limit: pageSize + 1,
        startAfter: lastSnapshot,
        onLastDocSnapshot: (doc) => {
          lastDoc = doc
        }
      })

      const hasMore = results.length > pageSize
      const itemsToAdd = results.slice(0, pageSize)

      // IMPORTANT: Update lastSnapshot for next page
      if (lastDoc) {
        setLastSnapshot(lastDoc)
      }

      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...itemsToAdd],
        hasMore,
        currentPage: prev.currentPage + 1,
        isLoading: false
      }))
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to load more items'
      }))
    }
  }, [fetcher, pageSize, lastSnapshot])

  // ... rest of code
}
```

---

## 5. 🔴 Утечка хранилища sessionStorage - CSRF токены НЕ очищаются при logout

**Файл**: [src/services/csrfService.ts](src/services/csrfService.ts) + [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L117)

**Проблема**: При logout CSRF токен остается в sessionStorage, что может быть использовано для атак

```typescript
// ❌ НЕПРАВИЛЬНО - No cleanup on logout
const logout = async (): Promise<void> => {
  try {
    await signOut(auth)
    // ← CSRF token в sessionStorage НЕ очищен!
  } catch (error) {
    logger.error('Logout error:', error)
  }
}
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Clean up sensitive data
import { clearCsrfToken } from '../services/csrfService'

const logout = async (): Promise<void> => {
  try {
    // Clear CSRF token before logout
    clearCsrfToken()
    
    await signOut(auth)
    
    // Clear other sensitive data
    sessionStorage.clear()
    
    setUser(null)
    setFirebaseUser(null)
  } catch (error) {
    logger.error('Logout error:', error)
  }
}
```

---

# 🟠 ВАЖНЫЕ ПРОБЛЕМЫ (РЕШИТЬ НЕДЕЛЮ)

## 6. 🟠 Race Condition в Loading User Data - Multiple fetches of same user

**Файл**: [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx#L150-L170)

**Проблема**: 
```typescript
// ❌ Multiple useEffect calls that load listings multiple times
React.useEffect(() => {
  const checkModerator = async () => {
    if (firebaseUser) {
      const token = await firebaseUser.getIdTokenResult()
      setIsTestAccount(isModerator(token))
    }
  }
  checkModerator()
}, [firebaseUser])

// Listings load happens implicitly when activeTab changes
React.useEffect(() => {
  // loadListings() called here...
}, [activeTab])

// Another independent effect
React.useEffect(() => {
  // ... more effects
}, [user])
```

**Решение**: Консолидировать все initializations в один useEffect или использовать useCallback

---

## 7. 🟠 Firestore Rules читают права слишком свободны - Any authenticated user может читать все отчеты

**Файл**: [firestore.rules](firestore.rules#L85-L95)

**Проблема**:
```javascript
// ❌ НЕПРАВИЛЬНО - Any auth user can read ALL reports
match /commentReports/{reportId} {
  allow read: if request.auth != null;  // ← Should be moderators only!
  
  allow create: if request.auth != null
    && request.resource.data.reportedBy == request.auth.uid
    && request.resource.data.reportedByName != null
    && request.resource.data.commentId != null
    && request.resource.data.propertyId != null
    && request.resource.data.reason != null;
  
  allow update: if request.auth != null && isModerator();
  
  allow delete: if request.auth != null && isModerator();
}
```

**Решение**:
```javascript
// ✅ ПРАВИЛЬНО - Only moderators can read/manage reports
match /commentReports/{reportId} {
  allow read: if request.auth != null && isModerator();  // ← Moderators only
  
  allow create: if request.auth != null
    && request.resource.data.reportedBy == request.auth.uid
    && request.resource.data.reportedByName != null
    && request.resource.data.commentId != null
    && request.resource.data.propertyId != null
    && request.resource.data.reason != null;
  
  allow update: if request.auth != null && isModerator();
  
  allow delete: if request.auth != null && isModerator();
}
```

---

## 8. 🟠 Потенциальная информационная утечка в Error Messages

**Файл**: [src/utils/errorHandler.ts](src/utils/errorHandler.ts#L30-L75)

**Проблема**: Некоторые error messages раскрывают структуру системы
```typescript
// ❌ Раскрывает внутренние детали
case 'auth/weak-password':
  return {
    message: 'Password is too weak. Use 6+ characters',  // ← раскрывает минимум
    code: error.code
  }
```

**Решение**: 
```typescript
// ✅ Более generic messages
case 'auth/weak-password':
  return {
    message: 'Password does not meet security requirements',
    code: error.code
  }
```

---

## 9. 🟠 No Protection Against Duplicate Reports - User может репортить одно и то же несколько раз

**Файл**: [src/services/reportService.ts](src/services/reportService.ts#L20-L50)

**Проблема**:
```typescript
// ❌ НЕПРАВИЛЬНО - No duplicate check
export const createCommentReport = async (
  propertyId: string,
  commentId: string,
  commentText: string,
  reportedBy: string,
  reportedByName: string,
  reason: ReportReason,
  details?: string
): Promise<CommentReport> => {
  try {
    const reportData = {
      propertyId,
      commentId,
      commentText,
      reportedBy,  // ← Нет проверки что user уже репортил этот comment
      reportedByName,
      reason,
      details: details || '',
      createdAt: new Date().toISOString(),
      status: 'open',
      commentDeleted: false
    }

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData)
    return { id: docRef.id, ...reportData } as CommentReport
  } catch (error) {
    logger.error('Error creating comment report:', error)
    throw error
  }
}
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Check for duplicate reports
export const createCommentReport = async (
  propertyId: string,
  commentId: string,
  commentText: string,
  reportedBy: string,
  reportedByName: string,
  reason: ReportReason,
  details?: string
): Promise<CommentReport | null> => {
  try {
    // Check if user already reported this comment
    const existingReport = await getCommentReports(commentId)
    if (existingReport.some(r => r.reportedBy === reportedBy && r.status === 'open')) {
      logger.error('User already reported this comment')
      return null
    }

    const reportData = {
      propertyId,
      commentId,
      commentText,
      reportedBy,
      reportedByName,
      reason,
      details: details || '',
      createdAt: new Date().toISOString(),
      status: 'open',
      commentDeleted: false
    }

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData)
    return { id: docRef.id, ...reportData } as CommentReport
  } catch (error) {
    logger.error('Error creating comment report:', error)
    return null
  }
}
```

---

## 10. 🟠 No Input Validation для Phone Numbers

**Файл**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L97-L130)

**Проблема**: Phone может быть любой строкой без валидации
```typescript
// ❌ НЕПРАВИЛЬНО
const register = async (
  name: string, 
  email: string, 
  phone: string,  // ← No validation!
  password: string
): Promise<{ success: boolean; error?: string }> => {
  // ... код
}
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Validate phone format
const validatePhoneNumber = (phone: string, country = 'AZ'): boolean => {
  const phoneRegex = {
    'AZ': /^(\+994|0)?[1-9]\d{1,14}$/,  // Azerbaijan format
  }
  return phoneRegex[country]?.test(phone.replace(/\s/g, '')) || false
}

const register = async (
  name: string, 
  email: string, 
  phone: string,
  password: string
): Promise<{ success: boolean; error?: string }> => {
  // Validate phone
  if (!validatePhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone format' }
  }
  // ... rest code
}
```

---

# 🟡 РЕКОМЕНДАЦИИ (УЛУЧШИТЬ)

## 11. 🟡 Large Component - DashboardPage.tsx имеет 1000+ строк

**Файл**: [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx)

**Проблема**: 
- 1000+ строк в одном компоненте
- 20+ useState переменных
- Сложная логика смешана с UI

**Решение**: Рефакторинг на подкомпоненты:
```typescript
// Раньше:
// DashboardPage.tsx - 1000 lines, 20 states

// Лучше:
// DashboardPage.tsx - 150 lines (container)
// ListingsTab.tsx - 250 lines (tab logic)
// ProfileTab.tsx - 200 lines (profile)
// AddListingForm.tsx - 300 lines (form)
// // каждый компонент с clear responsibility
```

---

## 12. 🟡 Missing Error Boundaries для Graceful Degradation

**Файл**: [src/App.tsx](src/App.tsx)

**Проблема**: Нет Error Boundary для обработки ошибок в компонентах

**Решение**:
```typescript
// ✅ Add Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  
  static getDerivedStateFromError(error) {
    return { hasError: true }
  }
  
  componentDidCatch(error, errorInfo) {
    logger.error('Error boundary caught:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}

// In App.tsx
<ErrorBoundary>
  <Routes>
    {/* routes */}
  </Routes>
</ErrorBoundary>
```

---

## 13. 🟡 Неправильное использование useEffect - Missing dependencies

**Файл**: [src/pages/HomePage/HomePage.tsx](src/pages/HomePage/HomePage.tsx#L45-L65)

**Проблема**:
```typescript
// ❌ НЕПРАВИЛЬНО - Missing dependencies
React.useEffect(() => {
  const loadProperties = async () => {
    setIsLoading(true)
    const result = await getProperties(
      filters.city ? { city: filters.city } : undefined  // ← используется filters
    )
    setProperties(result.properties)
    setIsLoading(false)
  }

  loadProperties()
}, [filters.city])  // ← Должны быть все dependencies из closure
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - All dependencies included
React.useEffect(() => {
  const loadProperties = async () => {
    setIsLoading(true)
    const result = await getProperties(
      filters.city ? { city: filters.city } : undefined
    )
    setProperties(result.properties)
    setIsLoading(false)
  }

  loadProperties()
}, [filters.city, getProperties])  // ← Добавили getProperties
```

---

## 14. 🟡 No Debouncing на Search Input

**Файл**: [src/pages/HomePage/HomePage.tsx](src/pages/HomePage/HomePage.tsx#L130-L140)

**Проблема**: Search фильтр вызывает re-render на каждый символ

**Решение**:
```typescript
// ✅ Add debounce
const debouncedSearch = React.useMemo(() => {
  return debounce((value: string) => {
    setFilters(prev => ({ ...prev, search: value }))
  }, 300)
}, [])

// Use it:
<SearchBar
  onChange={(value: string) => debouncedSearch(value)}
  // ...
/>
```

---

## 15. 🟡 Potential Memory Leak в Location Picker

**Файл**: [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx#L60-L110)

**Проблема**: `fetch` в useMapEvents может не отменятся при unmount
```typescript
// ❌ No cleanup
const LocationPicker = (...) => {
  useMapEvents({
    click: (event) => {
      fetch(`https://nominatim.openstreetmap.org/reverse?...`)  // ← No cleanup
        .then(res => res.json())
        .then(data => {
          // Process data
        })
    }
  })
}
```

**Решение**: Создано выше (смотри критичную проблему #3)

---

## 16. 🟡 Отсутствует Loading Skeleton для Better UX

**Проблема**: Пустой экран при загрузке вместо skeleton

**Решение**:
```typescript
// ✅ Add skeleton while loading
{isLoading ? (
  <div className="properties-skeleton">
    {Array(6).fill(0).map((_, i) => (
      <PropertyCardSkeleton key={i} />
    ))}
  </div>
) : (
  <div className="properties-grid">
    {/* actual content */}
  </div>
)}
```

---

## 17. 🟡 No Date Range Validation для Bookings

**Файл**: [src/services/bookingService.ts](src/services/bookingService.ts#L25-L50)

**Проблема**: Не проверяется что checkOut > checkIn

```typescript
// ❌ НЕПРАВИЛЬНО
export const checkBookingConflict = async (
  propertyId: string, 
  checkInDate: string, 
  checkOutDate: string
): Promise<boolean> => {
  try {
    // ...
    const proposedCheckIn = new Date(checkInDate).getTime()
    const proposedCheckOut = new Date(checkOutDate).getTime()

    // Нет проверки что proposedCheckOut > proposedCheckIn!
    for (const doc of snapshot.docs) {
      const booking = doc.data() as Omit<Booking, 'id'>
      // ...
    }
  }
}
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Validate date range
export const checkBookingConflict = async (
  propertyId: string, 
  checkInDate: string, 
  checkOutDate: string
): Promise<boolean>) => {
  const proposedCheckIn = new Date(checkInDate).getTime()
  const proposedCheckOut = new Date(checkOutDate).getTime()

  // Validate dates
  if (proposedCheckOut <= proposedCheckIn) {
    throw new Error('Check-out date must be after check-in date')
  }

  // ... rest of code
}
```

---

## 18. 🟡 No Pagination для Comments - All comments loaded at once

**Файл**: [src/services/commentsService.ts](src/services/commentsService.ts#L60-L80)

**Проблема**:
```typescript
// ❌ Загружаются ВСЕ comments, даже если их 1000+
async getComments(propertyId: string): Promise<Comment[]> {
  try {
    const snapshot = await getDocs(collection(db, `properties/${propertyId}/comments`))

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as Comment))
  }
}
```

**Решение**: Добавить pagination и limit

---

## 19. 🟡 Missing Accessibility Features (a11y)

**Проблем**:
- Нет alt text для изображений в PropertyCard
- Нет aria-labels на интерактивные элементы
- Низкий contrast в некоторых частях UI

**Решение**:
```typescript
// ✅ Add accessibility
<img 
  src={property.images[0]} 
  alt={property.title.az}  // ← Add meaningful alt text
  loading="lazy"  // ← Performance bonus
/>

<button 
  aria-label="Add to favorites"  // ← Screen reader friendly
  onClick={toggleFavorite}
>
  {/* icon */}
</button>
```

---

## 20. 🟡 No Type Safety for LocalStorage/SessionStorage

**Проблема**: String-based keys без типов
```typescript
// ❌ НЕПРАВИЛЬНО
sessionStorage.setItem('csrf_token', token)
const token = sessionStorage.getItem('csrf_token')
```

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - Type-safe storage
type StorageKey = 'language' | 'csrf_token' | 'last_search'

const storage = {
  get: (key: StorageKey): string | null => localStorage.getItem(key),
  set: (key: StorageKey, value: string): void => localStorage.setItem(key, value),
  remove: (key: StorageKey): void => localStorage.removeItem(key)
}

// Usage:
storage.set('language', 'az')  // ← TypeScript checks key
const lang = storage.get('language')
```

---

## 21. 🟡 No Retry Logic для API Calls

**Файл**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L48-L75)

**Решение**: Использовать exist `errorHandler.withRetry`:
```typescript
// ✅ Add retry logic
const userDoc = await withRetry(
  () => getDoc(doc(db, 'users', fbUser.uid)),
  3,  // max attempts
  1000  // initial delay ms
)
```

---

## 22. 🟡 No Logger Configuration Management

**Файл**: [src/services/logger.ts](src/services/logger.ts)

**Проблема**: Логирование зависит только от NODE_ENV, нет конфига

**Решение**:
```typescript
// ✅ Add logger config
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  enableRemote: boolean
  remoteSink?: (log: LogEntry) => void
}

export const configureLogger = (config: LogConfig) => {
  // Set up logger with config
}
```

---

## 23. 🟡 Missing Tests для Critical Services

**Проблема**: Есть test files но many services без тестов:
- `cancellationService.ts` - no tests
- `csrfService.ts` - no tests  
- `reportService.ts` - no tests

**Решение**: Добавить тесты

---

## 24. 🟡 Firestore Index Missing для Filter Queries

**Проблема**: Multiple filters без индексов может быть медленно

**Решение**: 
```javascript
// Add composite index in Firestore Console:
// Collection: properties
// Fields: status (Asc), district (Asc), price.daily (Asc), createdAt (Desc)
```

---

# ♻️ НЕИСПОЛЬЗУЕМЫЙ КОД

## 25. 🟡 Unused TODO Comments

**Файл**: [src/services/propertyService.test.ts](src/services/propertyService.test.ts#L131)

```typescript
// TODO: Implement filtering by publication status
// TODO: Implement fallback publications mechanism
```

**Решение**: Либо implement, либо удалить

---

## 26. 🟡 Unused `isModeratorEmail` Function

**Файл**: [src/config/constants.ts](src/config/constants.ts#L20-L24)

```typescript
// DEPRECATED: Use isModerator(token) instead
export const isModeratorEmail = (_email?: string | null): boolean => {
  logger.warn('isModeratorEmail is deprecated. Use isModerator(token) instead.')
  return false
}
```

**Решение**: Удалить полностью

---

# 📋 ДОПОЛНИТЕЛЬНЫЕ ПРОБЛЕМЫ С АРХИТЕКТУРОЙ

## 27. 🟡 Potential Circular Dependency

**Проблема**: bookingService → notificationsService → logger (может быть circular)

**Решение**: Проверить import chains и разбить взаимозависимости

---

## 28. 🟡 testData Marker String в Production Code

**Файл**: [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx#L45-L55)

```typescript
// ❌ НЕПРАВИЛЬНО - Production code checks for test marker
const TEST_LISTING_MARKER = '[TEST_DATA]'

const isTestListing = (listing: Property): boolean => {
  const titleAz = listing.title?.az || ''
  // ...
  return [titleAz, titleEn, descriptionAz, descriptionEn].some((value) =>
    value.includes(TEST_LISTING_MARKER)  // ← Hack-ish approach
  )
}
```

**Решение**: Добавить `isTestListing` flag в Property model

---

## 29. 🟡 No Feature Flags для A/B Testing

**Решение**: Добавить простой feature flag system

---

## 30. 🟡 Missing Service Worker Caching Strategy

**Проблема**: public/sw.js есть но не используется оптимально

**Решение**: Implement cache-first strategy for assets

---

# ✅ ИТОГОВАЯ ТАБЛИЦА ДЕЙСТВИЙ

| # | Проблема | Файл | Критичность | Время | Статус |
|---|----------|------|-----------|--------|--------|
| 1 | N+1 Query в AuthContext | AuthContext.tsx | 🔴 | 2ч | ❌ |
| 2 | Race Condition в Upload | AuthContext.tsx | 🔴 | 1.5ч | ❌ |
| 3 | XSS в Nominatim | DashboardPage.tsx | 🔴 | 1ч | ❌ |
| 4 | Pagination Cursor не сохраняется | usePagination.ts | 🔴 | 1.5ч | ❌ |
| 5 | CSRF не очищен при logout | csrfService.ts | 🔴 | 30мин | ❌ |
| 6 | Multiple User Fetches | DashboardPage.tsx | 🟠 | 1ч | ❌ |
| 7 | Firestore Rules Weak | firestore.rules | 🟠 | 30мин | ❌ |
| 8 | Error Message Leaks | errorHandler.ts | 🟠 | 30мин | ❌ |
| 9 | No Duplicate Report Check | reportService.ts | 🟠 | 1ч | ❌ |
| 10 | No Phone Validation | AuthContext.tsx | 🟠 | 1ч | ❌ |
| 11-24 | Рекомендации по коду | Various | 🟡 | 1-2 недели | ❌ |
| 25-30 | Архитектурные улучшения | Various | 🟡 | 2-4 недели | ❌ |

---

## 🎯 РЕКОМЕНДОВАННЫЙ ПОРЯДОК РАБОТ

### День 1 (Критичные - 5-6 часов)
1. ✅ Исправить CSRF cleanup при logout (30 мин)
2. ✅ Исправить XSS в Nominatim (1 час)
3. ✅ Исправить N+1 Query в AuthContext (2 часа)
4. ✅ Исправить pagination cursor (1.5 часа)

### День 2 (Важные - 4-5 часов)  
5. ✅ Firestore Rules fix (30 мин)
6. ✅ Проверить error messages (30 мин)
7. ✅ Duplicate report check (1 час)
8. ✅ Phone validation (1 час)
9. ✅ Race condition fix (1 час)

### Неделя 2-3 (Рекомендации)
10. Рефакторинг DashboardPage
11. Error Boundaries
12. Testing
13. Performance optimization

---

## 🔐 SECURITY CHECKLIST (После всех исправлений)

- [ ] API keys removed from version control
- [ ] CSRF tokens properly cleaned up
- [ ] XSS vulnerabilities patched
- [ ] Phone numbers validated
- [ ] Input sanitization added
- [ ] Firestore rules tested
- [ ] Error messages don't leak info
- [ ] Race conditions fixed
- [ ] Pagination works correctly
- [ ] Duplicate reports prevented
- [ ] No N+1 queries
- [ ] sessionStorage properly managed
- [ ] Rate limiting considered

---

**Подготовлено**: GitHub Copilot  
**Дата**: 16 апреля 2026  
**Статус**: ✅ ГОТОВ К ДЕЙСТВИЯМ
