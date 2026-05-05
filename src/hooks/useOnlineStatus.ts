import React from 'react'

export type ToastType = 'offline' | 'restored' | null

export interface OnlineStatus {
  isOnline: boolean
  toastType: ToastType
  dismissToast: () => void
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = React.useState(() => navigator.onLine)
  const [toastType, setToastType] = React.useState<ToastType>(null)
  const restoreTimer = React.useRef<ReturnType<typeof setTimeout>>()

  React.useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false)
      clearTimeout(restoreTimer.current)
      setToastType('offline')
    }

    const handleOnline = () => {
      setIsOnline(true)
      setToastType('restored')
      restoreTimer.current = setTimeout(() => setToastType(null), 4000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearTimeout(restoreTimer.current)
    }
  }, [])

  const dismissToast = React.useCallback(() => {
    clearTimeout(restoreTimer.current)
    setToastType(null)
  }, [])

  return { isOnline, toastType, dismissToast }
}
