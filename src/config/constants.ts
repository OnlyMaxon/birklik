// NOTE: Currently uses email-based moderation check for backward compatibility.
// Should be migrated to Firebase custom claims (moderator: true) in production.
// To set up custom claims:
// 1. Go to Firebase Console → Authentication
// 2. Select user → Custom Claims (JSON)
// 3. Add: { "moderator": true }

const MODERATOR_EMAILS = [
	'calilorucli42@gmail.com',
	'elgun.akhundov@gmail.com'
]

export const isModeratorEmail = (email?: string | null): boolean => {
	if (!email) return false
	const normalized = email.toLowerCase()
	return MODERATOR_EMAILS.includes(normalized)
}

export const isModerator = (token?: any): boolean => {
	if (!token) return false
	return token.moderator === true
}
