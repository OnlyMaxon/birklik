/**
 * Error handling utilities for Firebase and async operations
 */

export interface AppError {
  message: string
  code?: string
  details?: string
}

export const parseFirebaseError = (error: any): AppError => {
  const message = error?.message || 'An unknown error occurred'

  // Firebase-specific errors
  if (error?.code) {
    switch (error.code) {
      case 'permission-denied':
        return {
          message: 'You do not have permission to perform this action',
          code: error.code
        }
      case 'not-found':
        return {
          message: 'The requested resource was not found',
          code: error.code
        }
      case 'already-exists':
        return {
          message: 'This resource already exists',
          code: error.code
        }
      case 'resource-exhausted':
        return {
          message: 'Operation limit exceeded. Please try again later',
          code: error.code
        }
      case 'unauthenticated':
        return {
          message: 'You need to be logged in to perform this action',
          code: error.code
        }
      case 'invalid-argument':
        return {
          message: 'Invalid input provided',
          code: error.code
        }
      case 'failed-precondition':
        return {
          message: 'Operation cannot be completed in current state',
          code: error.code
        }
      case 'auth/user-not-found':
        return {
          message: 'Invalid email or password',
          code: error.code
        }
      case 'auth/wrong-password':
        return {
          message: 'Invalid email or password',
          code: error.code
        }
      case 'auth/email-already-in-use':
        return {
          message: 'This email is already registered. Try logging in instead',
          code: error.code
        }
      case 'auth/weak-password':
        return {
          message: 'Password does not meet security requirements',
          code: error.code
        }
      default:
        return {
          message,
          code: error.code,
          details: error.message
        }
    }
  }

  return { message }
}

export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error
  }

  if (error?.message) {
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}

export const isNetworkError = (error: any): boolean => {
  if (error?.code === 'NETWORK_ERROR' || error?.code === 'INTERNAL_ERROR') {
    return true
  }

  if (error?.message?.toLowerCase().includes('network') || error?.message?.toLowerCase().includes('offline')) {
    return true
  }

  return false
}

export const isAuthError = (error: any): boolean => {
  if (!error?.code) return false
  return error.code.startsWith('auth/')
}

export const shouldRetry = (error: any): boolean => {
  const retryableErrors = ['NETWORK_ERROR', 'INTERNAL_ERROR', 'resource-exhausted', 'unavailable']
  return retryableErrors.includes(error?.code)
}

/**
 * Retry logic for failed operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> => {
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!shouldRetry(error) || attempt === maxAttempts) {
        throw error
      }

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
