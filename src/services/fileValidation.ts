// File validation service for secure uploads

export interface FileValidationResult {
  valid: boolean
  error?: string
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB

export const validatePropertyImage = (file: File): FileValidationResult => {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: JPEG, PNG, WebP. Got: ${file.type}`
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max: 10MB, Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  // Check filename for safety
  const filename = file.name
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(filename)) {
    return {
      valid: false,
      error: 'Filename contains invalid characters'
    }
  }

  return { valid: true }
}

export const validateAvatar = (file: File): FileValidationResult => {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Use JPEG, PNG, or WebP'
    }
  }

  // Check file size (stricter for avatars)
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      error: `Avatar too large. Max: 5MB, Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  return { valid: true }
}

export const validateMultipleFiles = (files: FileList | File[], isAvatar = false): FileValidationResult => {
  const fileArray = Array.from(files)

  // Check at least one file
  if (fileArray.length === 0) {
    return { valid: false, error: 'No files selected' }
  }

  // Check total size
  const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0)
  const maxTotalSize = isAvatar ? MAX_AVATAR_SIZE : MAX_FILE_SIZE * 5 // max 5 files for properties
  
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      error: `Total size exceeds limit. Max: ${(maxTotalSize / 1024 / 1024).toFixed(0)}MB`
    }
  }

  // Validate each file
  for (const file of fileArray) {
    const validator = isAvatar ? validateAvatar : validatePropertyImage
    const result = validator(file)
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}
