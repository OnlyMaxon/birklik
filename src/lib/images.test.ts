import {describe, expect, it} from 'vitest'
import {
  imageUrlFromStoragePath,
  normalizePropertyImageUrls,
  storagePathFromImageSource,
  toImageApiUrl
} from './images'

describe('image URL helpers', () => {
  it('builds an encoded same-origin API URL', () => {
    expect(imageUrlFromStoragePath('properties/user/a photo.webp')).toBe(
      '/api/images/properties/user/a%20photo.webp'
    )
  })

  it('converts a legacy Firebase download URL', () => {
    const legacy =
      'https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/properties%2Fuser%2Fphoto.webp?alt=media&token=secret'

    expect(storagePathFromImageSource(legacy)).toBe('properties/user/photo.webp')
    expect(toImageApiUrl(legacy)).toBe('/api/images/properties/user/photo.webp')
  })

  // Здесь раньше проверялось, что заглушка с ui-avatars.com проходит насквозь.
  // Поведение изменено НАМЕРЕННО: в её адресе ехало настоящее имя человека на
  // чужой сервер. Теперь такой адрес означает «аватара нет».
  it('keeps unrelated external images unchanged', () => {
    const external = 'https://example.com/photo.jpg'
    expect(toImageApiUrl(external)).toBe(external)
  })

  it('заглушка аватара считается отсутствием аватара', () => {
    expect(toImageApiUrl('https://ui-avatars.com/api/?name=User')).toBeUndefined()
  })

  it('normalizes property and nested comment images', () => {
    const firebase =
      'https://firebasestorage.googleapis.com/v0/b/demo/o/avatars%2Fu1%2Favatar.png?alt=media'
    const property = normalizePropertyImageUrls({
      images: ['/api/images/properties/u1/home.webp'],
      comments: [{userAvatar: firebase, replies: [{userAvatar: firebase}]}]
    })

    expect(property.comments?.[0].userAvatar).toBe('/api/images/avatars/u1/avatar.png')
    expect(property.comments?.[0].replies?.[0].userAvatar).toBe('/api/images/avatars/u1/avatar.png')
  })

  it('rejects objects outside the image folders', () => {
    expect(storagePathFromImageSource('/api/images/private/secret.txt')).toBeNull()
    expect(() => imageUrlFromStoragePath('../secret')).toThrow()
    expect(() => imageUrlFromStoragePath('properties/../secret')).toThrow()
  })
})
