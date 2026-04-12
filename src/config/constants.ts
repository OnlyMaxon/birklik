// Moderator role is now determined via Firebase custom claims
// To set up custom claims:
// 1. Go to Firebase Console → Authentication
// 2. Select user → Custom Claims (JSON)
// 3. Add: { "moderator": true }
//
// Usage: const token = await firebaseUser.getIdTokenResult()
//        isModerator(token)

import { IdTokenResult } from 'firebase/auth'
import * as logger from '../services/logger'

/**
 * Check if user is a moderator via Firebase custom claims
 * @param token Firebase ID token result containing claims
 * @returns true if user has moderator: true in custom claims
 */
export const isModerator = (token?: IdTokenResult | null): boolean => {
	if (!token) return false
	return token?.claims?.moderator === true
}

// DEPRECATED: Use isModerator(token) instead
export const isModeratorEmail = (_email?: string | null): boolean => {
	logger.warn('isModeratorEmail is deprecated. Use isModerator(token) instead.')
	return false
}
