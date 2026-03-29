import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import './AuthPages.css'

export const LoginPage: React.FC = () => {
  const { t, language } = useLanguage()
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
        return language === 'en'
          ? 'Incorrect email or password'
          : language === 'ru'
            ? 'Неверный email или пароль'
            : 'Email və ya şifrə yanlışdır'
      case 'auth/too-many-requests':
        return language === 'en'
          ? 'Too many attempts. Please try again later'
          : language === 'ru'
            ? 'Слишком много попыток. Попробуйте позже'
            : 'Həddindən artıq cəhd edildi. Zəhmət olmasa bir az sonra yenidən yoxlayın'
      case 'auth/network-request-failed':
        return language === 'en'
          ? 'Network error. Check your connection'
          : language === 'ru'
            ? 'Ошибка сети. Проверьте подключение'
            : 'Şəbəkə xətası. İnternet bağlantınızı yoxlayın'
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
