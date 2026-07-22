'use client'

import {useEffect, useState} from 'react'
import {initializeFirebaseAppCheck} from '@/lib/firebase/client'
import {Loading} from '@/components/loading'

export function FirebaseClientGate({children}: {children: React.ReactNode}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    initializeFirebaseAppCheck()
    setIsReady(true)
  }, [])

  if (!isReady) {
    return <Loading fullScreen message="Birklik.az" brand />
  }

  return children
}
