import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import './AuthPages.css'

export const LoginPage: React.FC = () => {
  const { t } = useLanguage()
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Неверный email или пароль'
      case 'auth/too-many-requests':
        return 'Слишком много попыток. Попробуйте позже'
      case 'auth/network-request-failed':
        return 'Ошибка сети. Проверьте подключение'
      default:
        return t.messages.error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await login(email, password)
    
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(getErrorMessage(result.error || ''))
    }
    
    setLoading(false)
  }

  return (
    <Layout>
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card card">
            <div className="auth-header">
              <h1>{t.auth.login}</h1>
              <p>{t.site.tagline}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label>{t.auth.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label>{t.auth.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="form-row">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>{t.auth.rememberMe}</span>
                </label>
                <Link to="/" className="forgot-link">{t.auth.forgotPassword}</Link>
              </div>

              <button 
                type="submit" 
                className="btn btn-accent btn-lg w-full"
                disabled={loading}
              >
                {loading ? t.messages.loading : t.auth.login}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {t.auth.noAccount}{' '}
                <Link to="/register">{t.auth.register}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
