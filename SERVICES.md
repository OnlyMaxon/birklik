# Services Documentation

## Overview

Services handle all business logic and Firebase operations. They abstract complex operations into reusable functions.

## Available Services

### propertyService
Original property operations (for backward compatibility).

```typescript
import { 
  createProperty,
  deleteProperty, 
  getPropertiesByOwner,
  updateProperty,
  addCommentToProperty,
  toggleLikeProperty,
  deleteCommentFromProperty
} from '@/services'
```

### listingService
Modern listing management with pagination and image handling.

**Methods:**
- `getListingsByOwner(userId, options?)` - Get user's listings
- `getAllListings(options?)` - Get all active listings
- `createListing(payload)` - Create new listing
- `updateListing(propertyId, updates)` - Update listing
- `deleteListing(propertyId)` - Delete listing
- `uploadPropertyImage(propertyId, file)` - Upload single image
- `deletePropertyImage(imageUrl)` - Delete image
- `batchUploadImages(propertyId, files)` - Upload multiple images

**Example:**
```typescript
// Get listings with pagination
const { items, hasMore, loadMore } = usePagination(
  (opts) => listingService.getAllListings(opts),
  10
)

await loadMore()

// Create listing
const id = await listingService.createListing({
  type: 'villa',
  district: 'Baku',
  price: { daily: 100, weekly: 600, monthly: 2400, currency: 'AZN' },
  rooms: 3,
  // ... other fields
})

// Update listing
await listingService.updateListing(id, {
  status: 'active',
  title: { az: 'Başlık', en: 'Title', ru: 'Заголовок' }
})
```

### commentsService
Comments and likes management.

**Methods:**
- `addComment(propertyId, userId, userName, text, userAvatar?)` - Add comment
- `getComments(propertyId)` - Get all comments
- `updateComment(propertyId, commentId, text)` - Edit comment
- `deleteComment(propertyId, commentId)` - Delete comment
- `toggleLike(propertyId, userId, liked)` - Toggle like

**Example:**
```typescript
// Add comment
const commentId = await commentsService.addComment(
  propertyId,
  userId,
  'John Doe',
  'Great property!',
  'https://..../avatar.jpg'
)

// Get comments
const comments = await commentsService.getComments(propertyId)

// Toggle like
await commentsService.toggleLike(propertyId, userId, false) // like
```

### fileValidation
Client-side file validation before upload.

**Methods:**
- `validatePropertyImage(file)` - Validate property image (10MB, JPEG/PNG/WebP)
- `validateAvatar(file)` - Validate avatar (5MB, JPEG/PNG/WebP)
- `validateMultipleFiles(files, isAvatar?)` - Validate batch

**Returns:**
```typescript
interface FileValidationResult {
  valid: boolean
  error?: string
}
```

**Example:**
```typescript
import { validatePropertyImage } from '@/services'

const result = validatePropertyImage(file)
if (!result.valid) {
  showError(result.error) // "File too large..."
} else {
  await listingService.uploadPropertyImage(propertyId, file)
}
```

## Error Handling

All services throw errors that can be caught and handled:

```typescript
import { parseFirebaseError } from '@/utils'

try {
  await commentsService.addComment(...)
} catch (error) {
  const appError = parseFirebaseError(error)
  console.error(appError.message)
}
```

## Retry Logic

For unreliable operations (network, temporary failures):

```typescript
import { withRetry } from '@/utils'

await withRetry(
  () => listingService.batchUploadImages(propertyId, files),
  3,      // max 3 attempts
  1000    // 1s initial delay
)
```

## Best Practices

1. **Always validate files before upload**
   ```typescript
   const result = validatePropertyImage(file)
   if (!result.valid) return showError(result.error)
   ```

2. **Use services for all Firebase operations**
   ```typescript
   // ✅ Good
   await listingService.createListing(data)
   
   // ❌ Bad - don't create docs directly
   await addDoc(collection(db, 'properties'), data)
   ```

3. **Handle errors consistently**
   ```typescript
   try {
     await commentsService.addComment(...)
   } catch (error) {
     const appError = parseFirebaseError(error)
     showErrorUI(appError.message)
   }
   ```

4. **Use pagination for lists**
   ```typescript
   const { items, hasMore, loadMore } = usePagination(
     (opts) => listingService.getAllListings(opts),
     10
   )
   ```

## Migration Path

### PropertyService → ListingService

Old:
```typescript
const properties = await getPropertiesByOwner(userId)
const newId = await createProperty(payload)
```

New:
```typescript
const listings = await listingService.getListingsByOwner(userId)
const newId = await listingService.createListing(payload)
```

Both work currently. Migrate components to new service gradually.
