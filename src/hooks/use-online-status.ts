import React from 'react'

export type ToastType = 'offline' | 'restored' | null

export interface OnlineStatus {
  isOnline: boolean
  toastType: ToastType
  dismissToast: () => void
}

export function useOnlineStatus(): OnlineStatus {
  // Keep the server and first client render identical. The browser's actual
  // connection state is applied after hydration.
  const [isOnline, setIsOnline] = React.useState(true)
  const [toastType, setToastType] = React.useState<ToastType>(null)
  const restoreTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  React.useEffect(() => {
    setIsOnline(navigator.onLine)

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
