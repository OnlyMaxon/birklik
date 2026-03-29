export const MODERATOR_EMAILS = [
	'calilorucli42@gmail.com',
	'elgun.akhundov@gmail.com'
]

export const isModeratorEmail = (email?: string | null): boolean => {
	if (!email) return false
	const normalized = email.toLowerCase()
	return MODERATOR_EMAILS.includes(normalized)
}