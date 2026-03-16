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
import { auth, db } from '../config/firebase'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
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
    } catch (error: any) {
      console.error('Login error:', error)
      return { success: false, error: error.code || 'auth/unknown-error' }
    }
  }

  const register = async (name: string, email: string, phone: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const fbUser = userCredential.user

      // Update display name
      await updateProfile(fbUser, { displayName: name })

      // Save additional user data to Firestore
      await setDoc(doc(db, 'users', fbUser.uid), {
        name,
        email,
        phone,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a365d&color=fff`,
        createdAt: new Date().toISOString()
      })

      return { success: true }
    } catch (error: any) {
      console.error('Registration error:', error)
      return { success: false, error: error.code || 'auth/unknown-error' }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
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
      logout 
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
