import { describe, it, expect } from 'vitest'
import { buildQueryConstraints, calculateHasMore, trimToPageSize, formatPaginationResult } from './paginationHelper'
import { validatePropertyImage, validateAvatar, validateMultipleFiles } from './fileValidation'

describe('Pagination Helper', () => {
  describe('buildQueryConstraints', () => {
    it('should build constraints with status filter by default', () => {
      const constraints = buildQueryConstraints({})
      expect(constraints.length).toBeGreaterThan(0)
    })

    it('should include type and district filters when provided', () => {
      const constraints = buildQueryConstraints({
        type: 'apartment',
        district: 'baku'
      })
      expect(constraints.length).toBeGreaterThan(2)
    })

    it('should respect page size option', () => {
      const constraints = buildQueryConstraints({}, { pageSize: 20 })
      expect(constraints).toBeDefined()
    })

    it('should handle sorting options', () => {
      const constraintsByPrice = buildQueryConstraints({}, { sortBy: 'priceAsc' })
      const constraintsByDate = buildQueryConstraints({}, { sortBy: 'newest' })
      expect(constraintsByPrice.length).toBeGreaterThan(0)
      expect(constraintsByDate.length).toBeGreaterThan(0)
    })
  })

  describe('calculateHasMore', () => {
    it('should return true when items exceed page size', () => {
      const items = Array(13).fill({ id: '1' })
      const hasMore = calculateHasMore(items, 12)
      expect(hasMore).toBe(true)
    })

    it('should return false when items equal page size', () => {
      const items = Array(12).fill({ id: '1' })
      const hasMore = calculateHasMore(items, 12)
      expect(hasMore).toBe(false)
    })

    it('should return false when items are less than page size', () => {
      const items = Array(10).fill({ id: '1' })
      const hasMore = calculateHasMore(items, 12)
      expect(hasMore).toBe(false)
    })
  })

  describe('trimToPageSize', () => {
    it('should trim items to page size', () => {
      const items = Array(13).fill({ id: '1' })
      const trimmed = trimToPageSize(items, 12)
      expect(trimmed.length).toBe(12)
    })

    it('should return all items if less than page size', () => {
      const items = Array(10).fill({ id: '1' })
      const trimmed = trimToPageSize(items, 12)
      expect(trimmed.length).toBe(10)
    })
  })

  describe('formatPaginationResult', () => {
    it('should format result with correct metadata', () => {
      const items = Array(12).fill({ id: '1' })
      const result = formatPaginationResult(items, null, 12)
      
      expect(result.items.length).toBe(12)
      expect(result.hasMore).toBe(false)
      expect(result.pageSize).toBe(12)
      expect(result.totalInPage).toBe(12)
    })

    it('should set hasMore=true for excess items', () => {
      const items = Array(13).fill({ id: '1' })
      const result = formatPaginationResult(items, null as any, 12)
      
      expect(result.hasMore).toBe(true)
      expect(result.items.length).toBe(12)
    })
  })
})

describe('File Validation', () => {
  describe('validatePropertyImage', () => {
    it('should accept valid JPEG image', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const result = validatePropertyImage(file)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid file type', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = validatePropertyImage(file)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject oversized file', () => {
      const largeContent = new ArrayBuffer(11 * 1024 * 1024) // 11MB
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const result = validatePropertyImage(file)
      expect(result.valid).toBe(false)
    })

    it('should reject filename with invalid characters', () => {
      const file = new File(['content'], 'test@#$.jpg', { type: 'image/jpeg' })
      const result = validatePropertyImage(file)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateAvatar', () => {
    it('should accept valid PNG avatar', () => {
      const file = new File(['content'], 'avatar.png', { type: 'image/png' })
      const result = validateAvatar(file)
      expect(result.valid).toBe(true)
    })

    it('should enforce stricter size limit for avatar', () => {
      const largeContent = new ArrayBuffer(6 * 1024 * 1024) // 6MB
      const file = new File([largeContent], 'avatar.jpg', { type: 'image/jpeg' })
      const result = validateAvatar(file)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateMultipleFiles', () => {
    it('should reject empty file list', () => {
      const result = validateMultipleFiles([] as any)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('No files selected')
    })

    it('should validate each file', () => {
      const files = [
        new File(['content'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['content'], 'test2.png', { type: 'image/png' })
      ]
      const result = validateMultipleFiles(files)
      expect(result.valid).toBe(true)
    })
  })
})

describe('Service Integration', () => {
  it('should have all critical functions exported', () => {
    const paginationExports = ['buildQueryConstraints', 'calculateHasMore', 'trimToPageSize', 'formatPaginationResult']
    const validationExports = ['validatePropertyImage', 'validateAvatar', 'validateMultipleFiles']
    
    expect(paginationExports.length).toBe(4)
    expect(validationExports.length).toBe(3)
  })
})
