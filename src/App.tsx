import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loading } from './components'
import { useAuth } from './context'

const HomePage = React.lazy(() => import('./pages/HomePage').then((mod) => ({ default: mod.HomePage })))
const PropertyPage = React.lazy(() => import('./pages/PropertyPage').then((mod) => ({ default: mod.PropertyPage })))
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((mod) => ({ default: mod.LoginPage })))
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((mod) => ({ default: mod.RegisterPage })))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })))
const ModerationPage = React.lazy(() => import('./pages/ModerationPage').then((mod) => ({ default: mod.ModerationPage })))

const MODERATOR_EMAIL = 'calilorucli42@gmail.com'

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Auth route wrapper (redirect to dashboard if already logged in)
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.email !== MODERATOR_EMAIL) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  const { isLoading } = useAuth()
  const location = useLocation()
  const [showRouteLoader, setShowRouteLoader] = React.useState(true)

  React.useEffect(() => {
    setShowRouteLoader(true)
    const timeout = window.setTimeout(() => setShowRouteLoader(false), 420)
    return () => window.clearTimeout(timeout)
  }, [location.pathname])

  // Show loading screen while checking auth state
  if (isLoading) {
    return <Loading fullScreen message="Birklik.az" brand />
  }

  return (
    <>
      {showRouteLoader && <Loading fullScreen message="Birklik.az" brand />}
      <React.Suspense fallback={<Loading fullScreen message="Birklik.az" brand />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/property/:id" element={<PropertyPage />} />
          <Route path="/login" element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          } />
          <Route path="/register" element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/add" element={
            <ProtectedRoute>
              <DashboardPage initialTab="add" />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/review" element={
            <ModeratorRoute>
              <ModerationPage />
            </ModeratorRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </>
  )
}

export default App
