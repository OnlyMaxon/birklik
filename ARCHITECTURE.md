# Birklik.az - Architecture & Setup Guide

## Project Structure

```
src/
├── components/       # UI components (Header, Footer, Cards, etc.)
├── config/          # Firebase config, constants
├── context/         # React Context (Auth, Language)
├── hooks/           # Custom React hooks (usePagination, etc.)
├── pages/           # Page components (Home, Dashboard, Property, etc.)
├── services/        # Business logic services
│   ├── propertyService.ts    # Property CRUD
│   ├── listingService.ts     # Listing management with pagination
│   ├── commentsService.ts    # Comments & likes
│   └── fileValidation.ts     # File upload validation
├── styles/          # Global styles
├── types/           # TypeScript interfaces
├── utils/           # Utilities (error handling, state components)
├── i18n/            # Translations
└── layouts/         # Layout wrappers
```

## Key Services

### listingService
Handles property listing operations with pagination support.

```typescript
import { listingService } from '@/services'

// Get user's listings
const myListings = await listingService.getListingsByOwner(userId)

// Get all active listings (for browse)
const allListings = await listingService.getAllListings({ limit: 10 })

// Create listing
const id = await listingService.createListing(payloadData)

// Upload images
const urls = await listingService.batchUploadImages(propertyId, fileArray)
```

### commentsService
Handles comments and likes.

```typescript
import { commentsService } from '@/services'

// Add comment
const commentId = await commentsService.addComment(
  propertyId, userId, userName, text, avatarUrl
)

// Get comments
const comments = await commentsService.getComments(propertyId)

// Toggle like
await commentsService.toggleLike(propertyId, userId, isLiked)
```

### fileValidation
Client-side file validation before upload.

```typescript
import { validatePropertyImage, validateAvatar } from '@/services'

const result = validatePropertyImage(file)
if (!result.valid) {
  console.error(result.error)
}
```

## Error Handling

Use errorHandler utilities for consistent error handling:

```typescript
import { parseFirebaseError, withRetry, isNetworkError } from '@/utils'

try {
  // Retry failed operations automatically
  await withRetry(async () => {
    return await listingService.createListing(data)
  }, 3, 1000) // max 3 attempts, 1s initial delay
} catch (error) {
  const appError = parseFirebaseError(error)
  console.error(appError.message)
}
```

## Pagination Hook

Implement infinite scroll or "Load More" with usePagination:

```typescript
import { usePagination } from '@/hooks'

const pagination = usePagination(
  (options) => listingService.getAllListings(options),
  10 // page size
)

// Initial load
useEffect(() => {
  pagination.load()
}, [])

// Load more
const handleLoadMore = () => {
  pagination.loadMore()
}
```

## Firestore Rules Summary

### Security Features
- **Ownership validation**: Users can only modify their own listings
- **Role-based access**: Moderators (via custom claims) can manage any listing
- **Field protection**: `ownerId` and `createdAt` cannot be modified
- **Status validation**: Only allowed statuses can be set
- **Comments protection**: Users can only edit/delete own comments

### Storage Rules
- **File types**: Only JPEG, PNG, WebP allowed
- **Size limits**: 10MB for properties, 5MB for avatars
- **Filename validation**: Safe characters only
- **Path restrictions**: Only designated paths allowed

## Setup Requirements

### Firebase Custom Claims (Moderator Role)
1. Go to Firebase Console → Authentication
2. Select a user → Custom Claims (JSON)
3. Add: `{ "moderator": true }`
4. Update code to check claims:

```typescript
const token = await firebaseUser?.getIdTokenResult()
if (token?.claims?.moderator) {
  // User is moderator
}
```

### Environment Variables
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

All are **required** - no fallback values in production.

## Migration Notes

### Email-based to Token-based Moderation
Currently uses email check for backward compatibility:
```typescript
isModeratorEmail(user?.email)
```

Should migrate to Firebase custom claims:
```typescript
isModerator(firebaseUser.token)
```

To migrate:
1. Set custom claims for all moderators in Firebase Console
2. Update code to use token claims
3. Remove email hardcoding

## Testing Checklist

- [ ] File upload validation works (size, type, name)
- [ ] Comments can be added/edited/deleted
- [ ] Likes toggle correctly
- [ ] Pagination loads more items
- [ ] Error messages appear on failures
- [ ] Moderator actions work (requires custom claims set)
- [ ] Users cannot modify other's listings
- [ ] Empty states display correctly
- [ ] Loading states display correctly

## Performance Considerations

- Listings paginated with 10-item default limit
- Images compressed before upload (validate on client)
- Firebase rules prevent unauthorized updates (security first)
- Lazy loading for property images
- Comment subcollections organized per property

## Next Steps

1. Set moderator custom claims in Firebase Console
2. Test file upload with new validation
3. Implement pagination UI in listing pages
4. Add error handling UI to components
5. Add unit tests for services
6. Add integration tests for key flows
