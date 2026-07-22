/**
 * Error handling utilities for Firebase and async operations
 */

export interface AppError {
  message: string
  code?: string
  details?: string
}

export const parseFirebaseError = (error: unknown): AppError => {
  const err = error as Record<string, unknown>
  const message = (err?.message as string) || 'An unknown error occurred'

  // Firebase-specific errors
  if (err?.code) {
    const code = err.code as string
    switch (code) {
      case 'permission-denied':
        return {
          message: 'You do not have permission to perform this action',
          code
        }
      case 'not-found':
        return {
          message: 'The requested resource was not found',
          code
        }
      case 'already-exists':
        return {
          message: 'This resource already exists',
          code
        }
      case 'resource-exhausted':
        return {
          message: 'Operation limit exceeded. Please try again later',
          code
        }
      case 'unauthenticated':
        return {
          message: 'You need to be logged in to perform this action',
          code
        }
      case 'invalid-argument':
        return {
          message: 'Invalid input provided',
          code
        }
      case 'failed-precondition':
        return {
          message: 'Operation cannot be completed in current state',
          code
        }
      case 'auth/user-not-found':
        return {
          message: 'Invalid email or password',
          code
        }
      case 'auth/wrong-password':
        return {
          message: 'Invalid email or password',
          code
        }
      case 'auth/email-already-in-use':
        return {
          message: 'This email is already registered. Try logging in instead',
          code
        }
      case 'auth/weak-password':
        return {
          message: 'Password does not meet security requirements',
          code
        }
      default:
        return {
          message,
          code
        }
    }
  }

  return { message }
}

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error
  }

  const err = error as Record<string, unknown>
  if (err?.message) {
    return err.message as string
  }

  return 'An unexpected error occurred. Please try again.'
}

export const isNetworkError = (error: unknown): boolean => {
  const err = error as Record<string, unknown>
  if (err?.code === 'NETWORK_ERROR' || err?.code === 'INTERNAL_ERROR') {
    return true
  }

  const msg = (err?.message as string)?.toLowerCase() || ''
  if (msg.includes('network') || msg.includes('offline')) {
    return true
  }

  return false
}

export const isAuthError = (error: unknown): boolean => {
  const err = error as Record<string, unknown>
  if (!err?.code) return false
  return (err.code as string).startsWith('auth/')
}

export const shouldRetry = (error: unknown): boolean => {
  const err = error as Record<string, unknown>
  const retryableErrors = ['NETWORK_ERROR', 'INTERNAL_ERROR', 'resource-exhausted', 'unavailable']
  return retryableErrors.includes(err?.code as string)
}

/**
 * Retry logic for failed operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> => {
  let lastError: unknown

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
