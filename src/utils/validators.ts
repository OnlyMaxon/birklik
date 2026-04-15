/**
 * Input validation utilities
 */

/**
 * Validate phone number format for Azerbaijan
 * Supports: +994501234567, 05012345678, 501234567
 * @param phone Phone number string
 * @returns true if valid Azerbaijan phone number
 */
export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '')

  // Azerbaijan phone number patterns:
  // +994XXXXXXXXXX (with +994 prefix)
  // 0XXXXXXXXXX (with 0 prefix)
  // XXXXXXXXXX (10 digits)
  const azPhoneRegex = /^(\+994|0)?[1-9]\d{1,14}$/

  return azPhoneRegex.test(cleaned) && cleaned.length >= 9
}

/**
 * Validate email format
 * @param email Email string
 * @returns true if valid email format
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate password strength
 * Requires: at least 6 characters
 * @param password Password string
 * @returns true if password meets requirements
 */
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') return false
  return password.length >= 6
}

/**
 * Validate name format
 * @param name Name string
 * @returns true if valid name (2-100 chars, letters/spaces/hyphens only)
 */
export const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false

  const cleaned = name.trim()
  // Allow letters (any language), spaces, hyphens, apostrophes
  const nameRegex = /^[\p{L}\s\-']{2,100}$/u
  return nameRegex.test(cleaned)
}

/**
 * Sanitize user input to prevent XSS
 * @param input Raw user input
 * @returns Sanitized string safe for DOM
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 1000) // Max 1000 chars
}

/**
 * Validate file type and size
 * @param file File object
 * @param maxSizeInMB Max file size in MB
 * @param allowedTypes Array of allowed MIME types
 * @returns {valid: boolean; error?: string}
 */
export const validateFile = (
  file: File,
  maxSizeInMB: number = 10,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file selected' }
  }

  // Check file size
  const maxSizeBytes = maxSizeInMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size must be less than ${maxSizeInMB}MB` }
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' }
  }

  return { valid: true }
}
