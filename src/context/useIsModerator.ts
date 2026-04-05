import { useAuth } from './AuthContext'

export const useIsModerator = (): boolean => {
  const { firebaseUser } = useAuth()

  if (!firebaseUser) return false

  // This will be populated after user logs in and token is refreshed
  const token = (firebaseUser as any)?.reloadUserInfo?.customAttributes
  if (token?.moderator) return true

  // Fallback: check if moderator claim exists in token
  return false
}
