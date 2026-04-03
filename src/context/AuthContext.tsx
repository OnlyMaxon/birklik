import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../config/firebase'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateUserProfile: (payload: { name: string; phone: string; avatar?: string; avatarFile?: File | null }) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        
        // Try to get user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUser({
              id: fbUser.uid,
              name: userData.name || fbUser.displayName || 'User',
              email: fbUser.email || '',
              phone: userData.phone || '',
              avatar: userData.avatar || fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=1a365d&color=fff`
            })
          } else {
            // Fallback to Firebase user data
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName || 'User',
              email: fbUser.email || '',
              phone: '',
              avatar: fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(fbUser.displayName || 'User')}&background=1a365d&color=fff`
            })
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          setUser({
            id: fbUser.uid,
            name: fbUser.displayName || 'User',
            email: fbUser.email || '',
            phone: '',
            avatar: fbUser.photoURL || undefined
          })
        }
      } else {
        setFirebaseUser(null)
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { success: true }
    } catch (error) {
      const err = error as { code?: string; message?: string }
      console.error('Login error:', err)
      return { success: false, error: err.code || 'auth/unknown-error' }
    }
  }

  const register = async (name: string, email: string, phone: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const fbUser = userCredential.user

      // Update display name in Firebase Auth
      await updateProfile(fbUser, { displayName: name })

      // Save user data to Firestore
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a365d&color=fff`
      await setDoc(doc(db, 'users', fbUser.uid), {
        name,
        email,
        phone,
        avatar: avatarUrl,
        createdAt: new Date().toISOString()
      })

      // Immediately set user in state with correct name (don't wait for onAuthStateChanged)
      setUser({
        id: fbUser.uid,
        name: name,
        email: email,
        phone: phone,
        avatar: avatarUrl
      })

      return { success: true }
    } catch (error) {
      const err = error as { code?: string; message?: string }
      console.error('Registration error:', err)
      return { success: false, error: err.code || 'auth/unknown-error' }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const updateUserProfile = async (payload: { name: string; phone: string; avatar?: string; avatarFile?: File | null }): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser || !user) {
      return { success: false, error: 'auth/not-authenticated' }
    }

    try {
      let avatarUrl = payload.avatar || user.avatar || ''

      if (payload.avatarFile) {
        const fileName = `avatars/${firebaseUser.uid}/${Date.now()}_${payload.avatarFile.name}`
        const avatarRef = ref(storage, fileName)
        await uploadBytes(avatarRef, payload.avatarFile)
        avatarUrl = await getDownloadURL(avatarRef)
      }

      const updates = {
        name: payload.name,
        phone: payload.phone,
        avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || 'User')}&background=1a365d&color=fff`,
        updatedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), updates, { merge: true })

      await updateProfile(firebaseUser, {
        displayName: payload.name,
        photoURL: updates.avatar
      })

      setUser(prev => prev ? {
        ...prev,
        name: updates.name,
        phone: updates.phone,
        avatar: updates.avatar
      } : prev)

      return { success: true }
    } catch (error: any) {
      const err = error as { code?: string; message?: string }
      console.error('Update profile error:', err)
      return { success: false, error: error.code || 'auth/update-failed' }
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser,
      isAuthenticated: !!user, 
      isLoading,
      login, 
      register, 
      logout,
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
