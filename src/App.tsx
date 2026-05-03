import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loading } from './components'
import { useAuth } from './context'
import { isModerator } from './config/constants'
import * as logger from './services/logger'

const HomePage = React.lazy(() => import('./pages/HomePage').then((mod) => ({ default: mod.HomePage })))
const PropertyPage = React.lazy(() => import('./pages/PropertyPage').then((mod) => ({ default: mod.PropertyPage })))
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((mod) => ({ default: mod.LoginPage })))
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((mod) => ({ default: mod.RegisterPage })))
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then((mod) => ({ default: mod.ResetPasswordPage })))
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage').then((mod) => ({ default: mod.VerifyEmailPage })))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })))
const ModerationPage = React.lazy(() => import('./pages/ModerationPage').then((mod) => ({ default: mod.ModerationPage })))
const ModerationReviewPage = React.lazy(() => import('./pages/ModerationReviewPage').then((mod) => ({ default: mod.ModerationReviewPage })))
const TermsPage = React.lazy(() => import('./pages/TermsPage').then((mod) => ({ default: mod.TermsPage })))
const AboutPage = React.lazy(() => import('./pages/AboutPage').then((mod) => ({ default: mod.AboutPage })))
const ContactPage = React.lazy(() => import('./pages/ContactPage').then((mod) => ({ default: mod.ContactPage })))
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then((mod) => ({ default: mod.PrivacyPage })))

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, firebaseUser } = useAuth()
  const [emailVerified, setEmailVerified] = React.useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = React.useState(true)

  React.useEffect(() => {
    const checkEmailVerification = async () => {
      if (!firebaseUser) {
        setCheckingEmail(false)
        return
      }

      try {
        // Reload user to get latest emailVerified status
        await firebaseUser.reload()
        
        // Add small delay to ensure state is current
        await new Promise(resolve => setTimeout(resolve, 100))
        
        setEmailVerified(firebaseUser.emailVerified)
      } catch (error) {
        logger.error('Error checking email verification:', error)
        setEmailVerified(firebaseUser.emailVerified)
      } finally {
        setCheckingEmail(false)
      }
    }

    if (isAuthenticated && firebaseUser) {
      checkEmailVerification()
    } else {
      setCheckingEmail(false)
    }
  }, [firebaseUser, isAuthenticated])

  if (isLoading || checkingEmail) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check if email is verified
  if (emailVerified === false) {
    return <Navigate to="/verify-email" replace />
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

// Component for catch-all route
const CatchAllRoute: React.FC = () => {
  return <Navigate to="/" replace />
}

function App() {
  const { isLoading } = useAuth()

  // Show loading screen while checking auth state
  if (isLoading) {
    return <Loading fullScreen message="Birklik.az" brand />
  }

  return (
    <>
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/action" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/add" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/review" element={
            <ModeratorRoute>
              <ModerationPage />
            </ModeratorRoute>
          } />
          <Route path="/dashboard/review/:id" element={
            <ModeratorRoute>
              <ModerationReviewPage />
            </ModeratorRoute>
          } />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<CatchAllRoute />} />
        </Routes>
      </React.Suspense>
    </>
  )
}

export default App
