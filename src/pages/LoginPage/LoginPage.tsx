import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../config/firebase'
import '../../styles/AuthPages.css'

export const LoginPage: React.FC = () => {
  const { t, language } = useLanguage()
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [showResetModal, setShowResetModal] = React.useState(false)
  const [resetEmail, setResetEmail] = React.useState('')
  const [resetLoading, setResetLoading] = React.useState(false)
  const [resetMessage, setResetMessage] = React.useState('')
  const [resetError, setResetError] = React.useState('')

  React.useEffect(() => {
    if (isAuthenticated) {
      const fbUser = auth.currentUser
      // Only redirect if authenticated AND email is verified
      if (fbUser?.emailVerified) {
        navigate('/dashboard')
      }
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
      // Check if email is verified
      const fbUser = auth.currentUser
      if (fbUser && !fbUser.emailVerified) {
        navigate('/verify-email')
      } else {
        navigate('/dashboard')
      }
    } else {
      setError(getErrorMessage(result.error || ''))
    }
    
    setLoading(false)
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      setResetError(language === 'en' ? 'Please enter your email' : language === 'ru' ? 'Пожалуйста, введите email' : 'Zəhmət olmasa email-nizi daxil edin')
      return
    }

    setResetLoading(true)
    setResetError('')
    setResetMessage('')

    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetMessage(
        language === 'en'
          ? 'Password reset email has been sent. Check your inbox.'
          : language === 'ru'
            ? 'Письмо для восстановления пароля отправлено. Проверьте свой почтовый ящик.'
            : 'Şifrəni sıfırlama e-poçtu göndərildi. Gələn xanənizi yoxlayın.'
      )
      setResetEmail('')
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        setShowResetModal(false)
        setResetMessage('')
      }, 3000)
    } catch (err: any) {
      let errorMsg = language === 'en' ? 'Error sending reset email' : language === 'ru' ? 'Ошибка отправки письма' : 'E-poçt göndərmə xətası'
      
      if (err.code === 'auth/user-not-found') {
        errorMsg = language === 'en' ? 'No account found with this email' : language === 'ru' ? 'Аккаунт не найден' : 'Bu e-poçt ilə hesab tapılmadı'
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = language === 'en' ? 'Invalid email address' : language === 'ru' ? 'Неверный email' : 'Hər hansı bir e-poçt ünvanı'
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = language === 'en' ? 'Too many attempts. Try again later.' : language === 'ru' ? 'Слишком много попыток. Попробуйте позже.' : 'Həddindən artıq cəhd. Daha sonra yenidən cəhd edin.'
      }
      
      setResetError(errorMsg)
    } finally {
      setResetLoading(false)
    }
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
                <button 
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="forgot-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {t.auth.forgotPassword}
                </button>
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

      {/* Password Reset Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }} className="card">
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                {language === 'en' ? 'Reset Password' : language === 'ru' ? 'Восстановить пароль' : 'Şifrəni sıfırla'}
              </h2>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                {language === 'en' 
                  ? 'Enter your email address and we\'ll send you instructions to reset your password.'
                  : language === 'ru'
                    ? 'Введите адрес электронной почты и мы отправим вам инструкции по восстановлению пароля.'
                    : 'E-poçt ünvanınızı daxil edin və biz sizə şifrəni sıfırlamaq üçün təlimatlar göndərəcəyik.'}
              </p>
            </div>

            {resetMessage && (
              <div style={{
                backgroundColor: '#e8f5e9',
                border: '1px solid #4caf50',
                color: '#2e7d32',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                ✓ {resetMessage}
              </div>
            )}

            {resetError && (
              <div style={{
                backgroundColor: '#ffebee',
                border: '1px solid #f44336',
                color: '#c62828',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                ✕ {resetError}
              </div>
            )}

            <form onSubmit={handlePasswordReset} style={{ display: resetMessage ? 'none' : 'block' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  {t.auth.email}
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={language === 'en' ? 'your@email.com' : language === 'ru' ? 'ваш@email.com' : 'sizin@email.com'}
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn btn-accent btn-lg"
                  style={{
                    flex: 1,
                    backgroundColor: '#b7925d',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    opacity: resetLoading ? 0.6 : 1
                  }}
                >
                  {resetLoading 
                    ? (language === 'en' ? 'Sending...' : language === 'ru' ? 'Отправка...' : 'Göndərilir...')
                    : (language === 'en' ? 'Send' : language === 'ru' ? 'Отправить' : 'Göndər')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false)
                    setResetEmail('')
                    setResetError('')
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
