import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loading } from './components'
import { useAuth } from './context'
import { isModerator } from './config/constants'

const HomePage = React.lazy(() => import('./pages/HomePage').then((mod) => ({ default: mod.HomePage })))
const PropertyPage = React.lazy(() => import('./pages/PropertyPage').then((mod) => ({ default: mod.PropertyPage })))
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((mod) => ({ default: mod.LoginPage })))
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((mod) => ({ default: mod.RegisterPage })))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })))
const ModerationPage = React.lazy(() => import('./pages/ModerationPage').then((mod) => ({ default: mod.ModerationPage })))
const TermsPage = React.lazy(() => import('./pages/TermsPage').then((mod) => ({ default: mod.TermsPage })))
const AboutPage = React.lazy(() => import('./pages/AboutPage').then((mod) => ({ default: mod.AboutPage })))
const ContactPage = React.lazy(() => import('./pages/ContactPage').then((mod) => ({ default: mod.ContactPage })))
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then((mod) => ({ default: mod.PrivacyPage })))

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
  const { isAuthenticated, isLoading, firebaseUser } = useAuth()
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [tokenLoaded, setTokenLoaded] = React.useState(false)

  React.useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsModeratorUser(isModerator(token))
      }
      setTokenLoaded(true)
    }
    checkModerator()
  }, [firebaseUser])

  if (isLoading || !tokenLoaded) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isModeratorUser) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  const { isLoading } = useAuth()
  const location = useLocation()
  const [showRouteLoader, setShowRouteLoader] = React.useState(false)
  const isInitialMount = React.useRef(true)

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
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
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </>
  )
}

export default App
