/**
 * Logger Service
 * Centralized logging service for development and debugging
 * Respects environment configuration for log levels
 * SECURITY: In production, sensitive data is sanitized
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

/**
 * Sanitize sensitive data from strings for production
 * Removes Firebase project IDs, API keys, emails, paths, etc.
 */
function sanitizeForProduction(data: any): any {
  if (isProduction) {
    if (typeof data === 'string') {
      // Remove Firebase project IDs (birklik-65289, etc.)
      let sanitized = data.replace(/birklik-\w+/g, '[REDACTED]')
      // Remove file paths
      sanitized = sanitized.replace(/([A-Z]:\\|\/[\w.-]+)+/g, '[PATH]')
      // Remove email addresses
      sanitized = sanitized.replace(/[\w.-]+@[\w.-]+/g, '[EMAIL]')
      // Remove API keys/tokens (long alphanumeric strings)
      sanitized = sanitized.replace(/([A-Za-z0-9]{32,})/g, '[TOKEN]')
      // Remove URLs
      sanitized = sanitized.replace(/https?:\/\/[\w.-]+/g, '[URL]')
      return sanitized
    }
    
    if (typeof data === 'object' && data !== null) {
      // For objects, sanitize recursively but only log non-sensitive keys
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive keys
        if (
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('auth')
        ) {
          sanitized[key] = '[REDACTED]'
        } else if (typeof value === 'string') {
          sanitized[key] = sanitizeForProduction(value)
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeForProduction(value)
        } else {
          sanitized[key] = value
        }
      }
      return sanitized
    }
  }
  return data
}

/**
 * Log debug message
 * @param {string} message - Debug message
 * @param {any} data - Optional data to log
 */
export const debug = (message: string, data?: any): void => {
  if (isDevelopment) {
    if (data !== undefined) {
      console.debug(`[DEBUG] ${message}`, data)
    } else {
      console.debug(`[DEBUG] ${message}`)
    }
  }
  // In production: debug logs are suppressed
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {any} data - Optional data to log
 */
export const info = (message: string, data?: any): void => {
  if (isDevelopment) {
    if (data !== undefined) {
      console.info(`[INFO] ${message}`, data)
    } else {
      console.info(`[INFO] ${message}`)
    }
  }
  // In production: info logs are suppressed
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {any} data - Optional data to log
 */
export const warn = (message: string, data?: any): void => {
  // Warnings shown in both dev and production, but sanitized
  const sanitizedData = isProduction ? sanitizeForProduction(data) : data
  
  if (sanitizedData !== undefined) {
    console.warn(`[WARN] ${message}`, sanitizedData)
  } else {
    console.warn(`[WARN] ${message}`)
  }
}

/**
 * Log error message
 * In production: errors are sanitized to prevent information disclosure
 * @param {string} message - Error message
 * @param {any} error - Error object or additional data
 */
export const error = (message: string, error?: any): void => {
  const sanitizedData = isProduction ? sanitizeForProduction(error) : error
  
  if (sanitizedData !== undefined) {
    console.error(`[ERROR] ${message}`, sanitizedData)
  } else {
    console.error(`[ERROR] ${message}`)
  }
  
  // TODO: In production, also send to error tracking service (Sentry, etc.)
  // if (isProduction) {
  //   sendToErrorTracking(message, error)
  // }
}
