/**
 * CSRF Token Service
 * Generates and validates CSRF tokens to protect against cross-site request forgery attacks
 */

const TOKEN_STORAGE_KEY = 'csrf_token'
const TOKEN_TIMESTAMP_KEY = 'csrf_token_timestamp'
const TOKEN_EXPIRY_TIME = 3600000 // 1 hour in milliseconds

/**
 * Generate a new CSRF token
 * @returns {string} A new CSRF token
 */
export const generateCsrfToken = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  
  // Store token and timestamp in sessionStorage
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  sessionStorage.setItem(TOKEN_TIMESTAMP_KEY, Date.now().toString())
  
  return token
}

/**
 * Get existing CSRF token or generate a new one if expired or missing
 * @returns {string} Valid CSRF token
 */
export const getCsrfToken = (): string => {
  const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const storedTimestamp = sessionStorage.getItem(TOKEN_TIMESTAMP_KEY)
  
  // Check if token exists and hasn't expired
  if (storedToken && storedTimestamp) {
    const tokenAge = Date.now() - parseInt(storedTimestamp, 10)
    if (tokenAge < TOKEN_EXPIRY_TIME) {
      return storedToken
    }
  }
  
  // Generate new token if missing or expired
  return generateCsrfToken()
}

/**
 * Validate a CSRF token
 * @param {string} token - Token to validate
 * @returns {boolean} True if token is valid, false otherwise
 */
export const validateCsrfToken = (token: string): boolean => {
  const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const storedTimestamp = sessionStorage.getItem(TOKEN_TIMESTAMP_KEY)
  
  // Check if token exists and matches
  if (!storedToken || storedToken !== token) {
    return false
  }
  
  // Check if token hasn't expired
  if (storedTimestamp) {
    const tokenAge = Date.now() - parseInt(storedTimestamp, 10)
    if (tokenAge >= TOKEN_EXPIRY_TIME) {
      return false
    }
  }
  
  return true
}

/**
 * Clear the stored CSRF token
 */
export const clearCsrfToken = (): void => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(TOKEN_TIMESTAMP_KEY)
}
