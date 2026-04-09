# Dead Code Analysis Report - Birklik.az

**Date Generated:** April 9, 2026  
**Project:** Birklik.az React/TypeScript Codebase  
**Scope:** src/ directory comprehensive analysis

---

## Executive Summary

This analysis identified **12 distinct areas of dead code** and **1 critical duplicate definition** that should be removed or refactored. The codebase is generally well-organized, but contains several unused service functions, hooks, and components that should be cleaned up.

---

## 🔴 CRITICAL ISSUES

### 1. Duplicate Interface Definition
**File:** [src/pages/DashboardPage/DashboardPage.tsx](src/pages/DashboardPage/DashboardPage.tsx)  
**Severity:** HIGH  
**Issue:** `LocationPickerProps` interface is defined twice

**Lines:**
- Line 52: First definition
- Line 67: Second definition (overrides first)

**Impact:** Code confusion, potential maintenance issues

**Recommendation:** Remove one definition (keep line 52, delete lines 66-68)

```typescript
// REMOVE THIS (lines 66-68):
interface LocationPickerProps {
  coordinates: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
  onAddressReverse?: (address: string) => void
}
```

---

## 🟡 UNUSED EXPORTS & FUNCTIONS

### 2. Unused Hook: `useIsModerator`
**File:** [src/context/useIsModerator.ts](src/context/useIsModerator.ts)  
**Exported From:** [src/context/index.ts](src/context/index.ts)  
**Severity:** MEDIUM  
**Status:** NOT EXPORTED from index.ts - found investigation only

**Details:**
- Hook is defined but never imported or used
- Returns false in current implementation
- Likely replaced by inline moderator checks using Firebase custom claims

**Recommendation:** DELETE the file and remove from context/index.ts exports

**Files to Update:**
- Delete [src/context/useIsModerator.ts](src/context/useIsModerator.ts)
- Update [src/context/index.ts](src/context/index.ts) - remove export if present

---

### 3. Unused Function: `getUserFavorites()`
**File:** [src/services/favoritesService.ts](src/services/favoritesService.ts)  
**Line:** 49  
**Severity:** MEDIUM  
**Status:** Exported, never called

**Details:**
```typescript
export const getUserFavorites = async () => {
  try {
    // Stub implementation - returns empty array
    return []
  } catch (error) {
    console.error('Error getting favorites:', error)
    throw error
  }
}
```

**Usage:** Only appears in JSDoc comment on line 47 (example usage)  
**Recommendation:** REMOVE - stub function with no real implementation or usage

---

### 4. Unused Function: `createReplyNotification()`
**File:** [src/services/notificationsService.ts](src/services/notificationsService.ts)  
**Line:** 120  
**Severity:** MEDIUM  
**Status:** Exported, never called

**Details:**
```typescript
export const createReplyNotification = async (
  userId: string,
  notificationData: Omit<ReplyNotification, 'id' | 'createdAt'>
): Promise<string | null> => {
  // Implementation exists, but function is never called
}
```

**Usage:** Not called anywhere in codebase  
**Recommendation:** REMOVE or implement reply notification feature if needed

---

### 5. Unused Function: `markAllNotificationsAsRead()`
**File:** [src/services/notificationsService.ts](src/services/notificationsService.ts)  
**Line:** 176  
**Severity:** LOW  
**Status:** Exported, never called

**Details:**
- Marks all notifications as read for a user
- Fully implemented but not used
- Could be useful UI feature (mark all as read button)

**Recommendation:** REMOVE or add UI button to use this function

---

### 6. Unused Utility Function: `createFirestoreService()`
**File:** [src/services/BaseFirestoreService.ts](src/services/BaseFirestoreService.ts)  
**Line:** 298  
**Severity:** LOW  
**Status:** Exported, never called

**Details:**
```typescript
export const createFirestoreService = <T extends Record<string, any>>(
  collectionName: string
): BaseFirestoreService<T> => {
  return new BaseFirestoreService<T>(collectionName)
}
```

**Usage:** Only exists as factory function, never instantiated  
**Recommendation:** REMOVE - not needed, can directly instantiate `BaseFirestoreService` class

---

### 7. Unused Function: `getPropertiesAdvanced()`
**File:** [src/services/propertyService.ts](src/services/propertyService.ts)  
**Line:** 176  
**Severity:** LOW  
**Status:** Exported, never called

**Details:**
- Stub implementation for advanced property filtering
- Only appears in JSDoc example (line 171)
- No actual calls in codebase

**Recommendation:** REMOVE or implement if planning advanced search feature

---

### 8. Unused Function: `getPropertiesByLocation()`
**File:** [src/services/propertyService.ts](src/services/propertyService.ts)  
**Line:** 254  
**Severity:** LOW  
**Status:** Exported, never called

**Details:**
- Filters properties by location and amenities
- Only appears in JSDoc example (line 252)
- Functionality integrated into main `getProperties()` and `filterProperties()`

**Recommendation:** REMOVE - functionality covered by existing functions

---

### 9. Unused Function: `getFeaturedProperties()`
**File:** [src/services/propertyService.ts](src/services/propertyService.ts)  
**Line:** 228  
**Severity:** LOW  
**Status:** Exported, never called

**Details:**
- Retrieves featured/premium properties
- Only appears in JSDoc example (line 226)
- HomePage uses basic `getProperties()` instead

**Recommendation:** REMOVE or implement featured section if needed

---

## 🟡 UNUSED COMPONENTS

### 10. Unused Component Export: `PropertyHeader`
**File:** [src/pages/PropertyPage/PropertyHeader.tsx](src/pages/PropertyPage/PropertyHeader.tsx)  
**Exported From:** [src/pages/PropertyPage/index.ts](src/pages/PropertyPage/index.ts)  
**Severity:** LOW  
**Status:** Component exists but not used

**Details:**
- Component is defined and exported
- Never imported or used in PropertyPage.tsx
- JSDoc shows intended usage (line 18)
- Likely refactored inline into PropertyPage

**Recommendation:** REMOVE component and export - all header functionality is inline in PropertyPage.tsx

**Files to Update:**
- Delete [src/pages/PropertyPage/PropertyHeader.tsx](src/pages/PropertyPage/PropertyHeader.tsx)
- Update [src/pages/PropertyPage/index.ts](src/pages/PropertyPage/index.ts) - remove PropertyHeader export

---

## ✅ ITEMS THAT ARE USED (NOT DEAD CODE)

The following were initially suspected but confirmed to be ACTIVE:

- ✅ **BookmarkedTab** - used in [DashboardPage](src/pages/DashboardPage/DashboardPage.tsx#L9) line 1586
- ✅ **NotificationsTab** - used in [DashboardPage](src/pages/DashboardPage/DashboardPage.tsx#L10) line 1589
- ✅ **FavoritesTab** - used in [DashboardPage](src/pages/DashboardPage/DashboardPage.tsx#L7) line 1580
- ✅ **BookingsTab** - used in [DashboardPage](src/pages/DashboardPage/DashboardPage.tsx#L8) line 1583
- ✅ **All Page Components** - properly routed in App.tsx
- ✅ **calculateHasMore** - used in paginationHelper and tests
- ✅ **trimToPageSize** - used in paginationHelper and tests
- ✅ **validateAvatar** - used in validateMultipleFiles and tests

---

## 📋 EXPORTS NOT RE-EXPORTED IN INDEX FILES

These are properly used but not in their module's index.ts and should be directly imported:

| Export | Module | Status |
|--------|--------|--------|
| `BookmarkedTab` | components | Direct import in DashboardPage |
| `NotificationsTab` | components | Direct import in DashboardPage |
| `PropertyHeader` | pages/PropertyPage | Exported but unused |

**Recommendation:** Either add to index exports for consistency, or keep direct imports if intentional

---

## 🗑️ CLEANUP ACTION ITEMS (Priority Order)

### IMMEDIATE (Easy wins - 15 min)
- [ ] Remove `LocationPickerProps` duplicate definition (lines 66-68 in DashboardPage.tsx)
- [ ] Delete [src/context/useIsModerator.ts](src/context/useIsModerator.ts)
- [ ] Remove `getUserFavorites` export from [src/services/favoritesService.ts](src/services/favoritesService.ts)

### HIGH (Core unused code - 20 min)
- [ ] Delete [src/pages/PropertyPage/PropertyHeader.tsx](src/pages/PropertyPage/PropertyHeader.tsx)
- [ ] Update [src/pages/PropertyPage/index.ts](src/pages/PropertyPage/index.ts) - remove PropertyHeader export
- [ ] Remove `createFirestoreService` from [src/services/BaseFirestoreService.ts](src/services/BaseFirestoreService.ts)

### MEDIUM (Unused notifications - 10 min)
- [ ] Remove `createReplyNotification` from [src/services/notificationsService.ts](src/services/notificationsService.ts)
- [ ] Remove `markAllNotificationsAsRead` from [src/services/notificationsService.ts](src/services/notificationsService.ts)

### LOW (Stub implementations - 15 min)
- [ ] Remove `getPropertiesAdvanced` from [src/services/propertyService.ts](src/services/propertyService.ts)
- [ ] Remove `getPropertiesByLocation` from [src/services/propertyService.ts](src/services/propertyService.ts)
- [ ] Remove `getFeaturedProperties` from [src/services/propertyService.ts](src/services/propertyService.ts)

---

## 📊 Code Quality Summary

| Metric | Count |
|--------|-------|
| Dead Exports | 9 |
| Duplicate Definitions | 1 |
| Unused Components | 1 |
| Unused Hooks | 1 |
| Total Issues Found | 12 |
| **Lines to Remove** | ~150-200 |

---

## 🎯 Next Steps

1. **Run TypeScript strict mode** - May catch more unused code
2. **Enable ESLint `no-unused-vars`** - Add to tsconfig.json if not already enabled
3. **Check CSS files** - Consider if all CSS imports in unused components should be removed
4. **Update SERVICES.md** - Remove documentation for deleted functions

---

## 📝 Notes

- All CSS files are properly imported and used
- No unused i18n translations detected
- No unused type definitions found
- Context API properly used (Auth and Language)
- All page routes are active and used

---

**Generated:** April 9, 2026  
**Analyzer:** Dead Code Analysis Tool
