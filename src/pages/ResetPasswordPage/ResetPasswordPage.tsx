import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../../config/firebase'
import '../../styles/AuthPages.css'

export const ResetPasswordPage: React.FC = () => {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const oobCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)
  const [validating, setValidating] = React.useState(true)
  const [isCodeValid, setIsCodeValid] = React.useState(false)
  const [email, setEmail] = React.useState('')

  // Validate reset code on mount
  React.useEffect(() => {
    const validateCode = async () => {
      if (!oobCode || mode !== 'resetPassword') {
        setError(
          language === 'en'
            ? 'Invalid reset link'
            : language === 'ru'
              ? 'Неверная ссылка восстановления'
              : 'Sıfırlama bağlantısı düzgün deyil'
        )
        setValidating(false)
        return
      }

      try {
        // Verify the code is valid
        const userEmail = await verifyPasswordResetCode(auth, oobCode)
        setEmail(userEmail)
        setIsCodeValid(true)
      } catch (err: any) {
        let errorMsg = language === 'en' ? 'Invalid or expired link' : language === 'ru' ? 'Недействительная или просроченная ссылка' : 'Sıfırlama bağlantısı ya da sürəsi bitib'
        
        if (err.code === 'auth/expired-action-code') {
          errorMsg = language === 'en' ? 'Reset link has expired' : language === 'ru' ? 'Ссылка восстановления истекла' : 'Sıfırlama bağlantısının müddəti bitib'
        } else if (err.code === 'auth/invalid-action-code') {
          errorMsg = language === 'en' ? 'Invalid reset link' : language === 'ru' ? 'Неверная ссылка восстановления' : 'Sıfırlama bağlantısı düzgün deyil'
        }
        
        setError(errorMsg)
      } finally {
        setValidating(false)
      }
    }

    validateCode()
  }, [oobCode, mode, language])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!password) {
      setError(language === 'en' ? 'Please enter a password' : language === 'ru' ? 'Пожалуйста, введите пароль' : 'Zəhmət olmasa şifrə daxil edin')
      return
    }

    if (password.length < 6) {
      setError(language === 'en' ? 'Password must be at least 6 characters' : language === 'ru' ? 'Пароль должен содержать минимум 6 символов' : 'Şifrə ən azı 6 simvoldan ibarət olmalıdır')
      return
    }

    if (password !== confirmPassword) {
      setError(language === 'en' ? 'Passwords do not match' : language === 'ru' ? 'Пароли не совпадают' : 'Şifrələr uyğun gəlmir')
      return
    }

    setLoading(true)

    try {
      await confirmPasswordReset(auth, oobCode!, password)
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: any) {
      let errorMsg = language === 'en' ? 'Error resetting password' : language === 'ru' ? 'Ошибка при восстановлении пароля' : 'Şifrəni sıfırlamakda xəta'
      
      if (err.code === 'auth/expired-action-code') {
        errorMsg = language === 'en' ? 'Reset link has expired' : language === 'ru' ? 'Ссылка восстановления истекла' : 'Sıfırlama bağlantısının müddəti bitib'
      } else if (err.code === 'auth/invalid-action-code') {
        errorMsg = language === 'en' ? 'Invalid reset link' : language === 'ru' ? 'Неверная ссылка восстановления' : 'Sıfırlama bağlantısı düzgün deyil'
      } else if (err.code === 'auth/weak-password') {
        errorMsg = language === 'en' ? 'Password is too weak' : language === 'ru' ? 'Пароль слишком слабый' : 'Şifrə çox zəif'
      }
      
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <Layout>
        <div className="auth-page">
          <div className="auth-container">
            <div className="auth-card card">
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>{language === 'en' ? 'Validating reset link...' : language === 'ru' ? 'Проверка ссылки восстановления...' : 'Sıfırlama bağlantısı yoxlanılır...'}</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isCodeValid) {
    return (
      <Layout>
        <div className="auth-page">
          <div className="auth-container">
            <div className="auth-card card">
              <div className="auth-header">
                <h1>{language === 'en' ? 'Reset Password' : language === 'ru' ? 'Восстановить пароль' : 'Şifrəni sıfırla'}</h1>
              </div>

              <div style={{
                backgroundColor: '#ffebee',
                border: '1px solid #f44336',
                color: '#c62828',
                padding: '1.5rem',
                borderRadius: '6px',
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                <p style={{ margin: 0, fontSize: '1rem' }}>✕ {error}</p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  {language === 'en' 
                    ? 'Please request a new password reset link'
                    : language === 'ru'
                      ? 'Пожалуйста, запросите новую ссылку восстановления'
                      : 'Zəhmət olmasa yeni sıfırlama bağlantısı istətməyin'}
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-accent btn-lg"
                  style={{
                    backgroundColor: '#b7925d',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {language === 'en' ? 'Back to Login' : language === 'ru' ? 'На страницу входа' : 'Giriş səhifəsinə qayıt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (success) {
    return (
      <Layout>
        <div className="auth-page">
          <div className="auth-container">
            <div className="auth-card card">
              <div className="auth-header">
                <h1>{language === 'en' ? 'Password Reset' : language === 'ru' ? 'Пароль восстановлен' : 'Şifrə sıfırlandı'}</h1>
              </div>

              <div style={{
                backgroundColor: '#e8f5e9',
                border: '1px solid #4caf50',
                color: '#2e7d32',
                padding: '1.5rem',
                borderRadius: '6px',
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                <p style={{ margin: 0, fontSize: '1.1rem' }}>
                  ✓ {language === 'en' 
                    ? 'Password has been successfully reset!'
                    : language === 'ru'
                      ? 'Пароль успешно восстановлен!'
                      : 'Şifrə uğurlu şəkildə sıfırlandı!'}
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  {language === 'en' 
                    ? 'Redirecting to login page...'
                    : language === 'ru'
                      ? 'Перенаправление на страницу входа...'
                      : 'Giriş səhifəsinə yönləndirmə edilir...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card card">
            <div className="auth-header">
              <h1>{language === 'en' ? 'Reset Password' : language === 'ru' ? 'Восстановить пароль' : 'Şifrəni sıfırla'}</h1>
              <p>{language === 'en' ? `Email: ${email}` : language === 'ru' ? `Email: ${email}` : `Email: ${email}`}</p>
            </div>

            <form onSubmit={handleResetPassword} className="auth-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label>{language === 'en' ? 'New Password' : language === 'ru' ? 'Новый пароль' : 'Yeni şifrə'}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'en' ? 'Enter new password' : language === 'ru' ? 'Введите новый пароль' : 'Yeni şifrənizi daxil edin'}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>{language === 'en' ? 'Confirm Password' : language === 'ru' ? 'Подтвердите пароль' : 'Şifrəni təsdiq edin'}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={language === 'en' ? 'Confirm new password' : language === 'ru' ? 'Подтвердите новый пароль' : 'Yeni şifrəni təsdiq edin'}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                {language === 'en' 
                  ? '✓ At least 6 characters'
                  : language === 'ru'
                    ? '✓ Минимум 6 символов'
                    : '✓ Ən azı 6 simvol'}
              </div>

              <button 
                type="submit" 
                className="btn btn-accent btn-lg w-full"
                disabled={loading}
              >
                {loading 
                  ? (language === 'en' ? 'Resetting...' : language === 'ru' ? 'Восстановление...' : 'Sıfırlanıyor...')
                  : (language === 'en' ? 'Reset Password' : language === 'ru' ? 'Восстановить пароль' : 'Şifrəni sıfırla')}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{ 
                    background: 'none',
                    border: 'none',
                    color: '#b7925d',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.95rem'
                  }}
                >
                  {language === 'en' ? 'Back to Login' : language === 'ru' ? 'На страницу входа' : 'Giriş səhifəsinə qayıt'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
