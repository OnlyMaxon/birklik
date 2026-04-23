/**
 * Logger Service
 * Centralized logging service for development and debugging
 * Respects environment configuration for log levels
 */

const isDevelopment = process.env.NODE_ENV === 'development'

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
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {any} data - Optional data to log
 */
export const warn = (message: string, data?: any): void => {
  if (data !== undefined) {
    console.warn(`[WARN] ${message}`, data)
  } else {
    console.warn(`[WARN] ${message}`)
  }
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {any} error - Error object or additional data
 */
export const error = (message: string, error?: any): void => {
  if (error !== undefined) {
    console.error(`[ERROR] ${message}`, error)
  } else {
    console.error(`[ERROR] ${message}`)
  }
}
