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
    console.debug(`[DEBUG] ${message}`, data)
  }
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {any} data - Optional data to log
 */
export const info = (message: string, data?: any): void => {
  if (isDevelopment) {
    console.info(`[INFO] ${message}`, data)
  }
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {any} data - Optional data to log
 */
export const warn = (message: string, data?: any): void => {
  console.warn(`[WARN] ${message}`, data)
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {any} error - Error object or additional data
 */
export const error = (message: string, error?: any): void => {
  console.error(`[ERROR] ${message}`, error)
}
