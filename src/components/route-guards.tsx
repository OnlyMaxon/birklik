'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useAuth} from '@/components/providers'
import {isModerator} from '@/lib/auth/permissions'
import {Loading} from '@/components/loading'

export function ProtectedRoute({children}: {children: React.ReactNode}) {
  const {isAuthenticated, isLoading, firebaseUser} = useAuth()
  const router = useRouter()
  const [checkingEmail, setCheckingEmail] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !firebaseUser) {
      router.replace('/login')
      setCheckingEmail(false)
      return
    }
    void firebaseUser.reload().finally(() => {
      if (!firebaseUser.emailVerified) router.replace('/verify-email')
      setCheckingEmail(false)
    })
  }, [firebaseUser, isAuthenticated, isLoading, router])

  if (isLoading || checkingEmail || !isAuthenticated) return <Loading fullScreen message="Birklik.az" brand />
  return children
}

export function AuthRoute({children}: {children: React.ReactNode}) {
  const {isAuthenticated, isLoading} = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, isLoading, router])
  if (isLoading || isAuthenticated) return <Loading fullScreen message="Birklik.az" brand />
  return children
}

export function ModeratorRoute({children}: {children: React.ReactNode}) {
  const {firebaseUser, isAuthenticated, isLoading} = useAuth()
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !firebaseUser) {
      router.replace('/login')
      return
    }
    void firebaseUser.getIdTokenResult().then(token => {
      const moderator = isModerator(token)
      setAllowed(moderator)
      if (!moderator) router.replace('/dashboard')
    })
  }, [firebaseUser, isAuthenticated, isLoading, router])
  if (isLoading || allowed !== true) return <Loading fullScreen message="Birklik.az" brand />
  return children
}
