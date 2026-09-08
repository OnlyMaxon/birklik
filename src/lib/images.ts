// Разбор адресов картинок переехал в общий пакет: приложению нужен тот же
// разбор, а копия неизбежно разошлась бы с этой. Здесь остаётся только то, что
// относится к форме документов сайта.
//
// Сайт вызывает без origin и получает прежний относительный путь: он живёт на
// одном домене с прокси. Приложение передаёт домен явно — см. комментарий в
// core/src/utils/images.ts.
export {
  storagePathFromImageSource,
  imageUrlFromStoragePath,
  toImageApiUrl
} from '@birklik/core/utils/images'

import {toImageApiUrl} from '@birklik/core/utils/images'

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
