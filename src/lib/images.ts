const IMAGE_API_PREFIX = '/api/images/'
const ALLOWED_STORAGE_PREFIXES = ['properties/', 'avatars/'] as const

function isAllowedStoragePath(path: string): boolean {
  const segments = path.split('/')
  return (
    ALLOWED_STORAGE_PREFIXES.some(prefix => path.startsWith(prefix)) &&
    segments.every(segment => segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\0'))
  )
}

function decodePath(path: string): string | null {
  try {
    return path
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/')
  } catch {
    return null
  }
}

/** Return the Firebase Storage object path represented by an app or legacy URL. */
export function storagePathFromImageSource(source: string): string | null {
  if (!source) return null

  if (source.startsWith(IMAGE_API_PREFIX)) {
    const encodedPath = source.slice(IMAGE_API_PREFIX.length).split(/[?#]/, 1)[0]
    const path = decodePath(encodedPath)
    return path && isAllowedStoragePath(path) ? path : null
  }

  if (source.startsWith('gs://')) {
    const firstSlash = source.indexOf('/', 'gs://'.length)
    const path = firstSlash === -1 ? '' : source.slice(firstSlash + 1)
    return isAllowedStoragePath(path) ? path : null
  }

  try {
    const url = new URL(source)

    if (url.hostname === 'firebasestorage.googleapis.com') {
      const objectMarker = '/o/'
      const markerIndex = url.pathname.indexOf(objectMarker)
      if (markerIndex === -1) return null
      const path = decodeURIComponent(url.pathname.slice(markerIndex + objectMarker.length))
      return isAllowedStoragePath(path) ? path : null
    }

    if (url.hostname === 'storage.googleapis.com') {
      const pathParts = url.pathname.split('/').filter(Boolean)
      const path = decodePath(pathParts.slice(1).join('/'))
      return path && isAllowedStoragePath(path) ? path : null
    }
  } catch {
    // A plain Storage object path is also accepted by deletion helpers.
    return isAllowedStoragePath(source) ? source : null
  }

  return null
}

export function imageUrlFromStoragePath(path: string): string {
  if (!isAllowedStoragePath(path)) {
    throw new Error('Unsupported image storage path')
  }

  return `${IMAGE_API_PREFIX}${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Hide legacy Firebase URLs behind the same-origin image API. */
export function toImageApiUrl(source: string | undefined): string | undefined {
  if (!source) return source
  const path = storagePathFromImageSource(source)
  return path ? imageUrlFromStoragePath(path) : source
}

type ImageComment = {userAvatar?: string; replies?: ImageComment[]}
type ImageProperty = {images?: string[]; comments?: ImageComment[]}

function normalizeComment(comment: ImageComment): ImageComment {
  return {
    ...comment,
    userAvatar: toImageApiUrl(comment.userAvatar),
    ...(comment.replies ? {replies: comment.replies.map(normalizeComment)} : {})
  }
}

/** Normalize images loaded from old Firestore records without mutating them. */
export function normalizePropertyImageUrls<T extends ImageProperty>(property: T): T {
  return {
    ...property,
    ...(property.images ? {images: property.images.map(url => toImageApiUrl(url) || url)} : {}),
    ...(property.comments ? {comments: property.comments.map(normalizeComment)} : {})
  }
}
