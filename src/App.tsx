import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage, PropertyPage, LoginPage, RegisterPage, DashboardPage } from './pages'
import { Loading } from './components'
import { useAuth } from './context'

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="Loading..." />
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
    return <Loading fullScreen message="Loading..." />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  const { isLoading } = useAuth()

  // Show loading screen while checking auth state
  if (isLoading) {
    return <Loading fullScreen message="Birklik.az" />
  }

  return (
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
