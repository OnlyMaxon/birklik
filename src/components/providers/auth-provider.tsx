'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import {auth, db, storage, initializeFirebaseAppCheck} from '@/lib/firebase/client'
import type {User} from '@/types'
import * as logger from '@/services/logger'
import {compressAvatarImage} from '@/utils/image-compression'
import {clearCsrfToken} from '@/services/csrf-service'
import {logoutAction} from '@/lib/auth/actions'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
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
    initializeFirebaseAppCheck()
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
          logger.error('Error fetching user data:', error)
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

  const logout = async (): Promise<void> => {
    try {
      // Clear sensitive data from sessionStorage
      clearCsrfToken()
      sessionStorage.clear()

      await Promise.all([signOut(auth), logoutAction()])

      // Clear user state
      setUser(null)
      setFirebaseUser(null)
    } catch (error) {
      logger.error('Logout error:', error)
    }
  }

  const updateUserProfile = async (payload: { name: string; phone: string; avatar?: string; avatarFile?: File | null }): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser || !user) {
      return { success: false, error: 'auth/not-authenticated' }
    }

    let uploadedAvatarUrl: string | null = null
    let uploadedAvatarPath: string | null = null
    const oldAvatarUrl = user.avatar || null

    try {
      let avatarUrl = payload.avatar !== undefined ? payload.avatar : (user.avatar || '')

      // Upload file FIRST, fail fast if upload fails
      if (payload.avatarFile) {
        const compressed = await compressAvatarImage(payload.avatarFile)
        const fileName = `avatars/${firebaseUser.uid}/${Date.now()}_${compressed.name}`
        const avatarRef = ref(storage, fileName)

        try {
          await uploadBytes(avatarRef, compressed)
          uploadedAvatarUrl = await getDownloadURL(avatarRef)
          uploadedAvatarPath = fileName
          avatarUrl = uploadedAvatarUrl
        } catch (uploadError) {
          // Fail fast - don't update Firestore if upload fails
          logger.error('Avatar upload failed:', uploadError)
          return { success: false, error: 'Failed to upload avatar' }
        }
      }

      const updates = {
        name: payload.name,
        phone: payload.phone,
        avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || 'User')}&background=1a365d&color=fff`,
        updatedAt: new Date().toISOString()
      }

      // Only update Firestore if everything succeeded
      try {
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

        // Delete old avatar from Storage after successful save (best-effort)
        if (uploadedAvatarUrl && oldAvatarUrl && oldAvatarUrl.includes('firebasestorage')) {
          try {
            const oldPath = decodeURIComponent(oldAvatarUrl.split('/o/')[1]?.split('?')[0] || '')
            if (oldPath) await deleteObject(ref(storage, oldPath))
          } catch {
            // ignore — old file may already be gone
          }
        }

        return { success: true }
      } catch (firestoreError) {
        // If Firestore update fails after upload, delete uploaded file
        if (uploadedAvatarPath) {
          try {
            await deleteObject(ref(storage, uploadedAvatarPath))
            logger.info('Cleaned up orphaned avatar after Firestore error')
          } catch (deleteError) {
            logger.error('Failed to cleanup orphaned avatar:', deleteError)
          }
        }
        logger.error('Firestore update error:', firestoreError)
        return { success: false, error: 'Failed to update profile' }
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      logger.error('Update profile error:', err)
      return { success: false, error: err.code || 'auth/update-failed' }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      isAuthenticated: !!user,
      isLoading,
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
