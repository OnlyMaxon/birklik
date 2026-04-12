import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { sendEmailVerification } from 'firebase/auth'
import '../../styles/AuthPages.css'

export const VerifyEmailPage: React.FC = () => {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const { firebaseUser, logout } = useAuth()

  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [resendCooldown, setResendCooldown] = React.useState(0)

  // Check if email is already verified
  React.useEffect(() => {
    const checkVerified = async () => {
      if (!firebaseUser) {
        navigate('/login')
        return
      }

      // Reload user to get latest emailVerified status
      await firebaseUser.reload()
      if (firebaseUser.emailVerified) {
        navigate('/dashboard')
      }
    }

    checkVerified()
    // Check every 3 seconds if email was verified
    const interval = setInterval(checkVerified, 3000)
    return () => clearInterval(interval)
  }, [firebaseUser, navigate])

  const handleResendEmail = async () => {
    if (!firebaseUser || resendCooldown > 0) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      await sendEmailVerification(firebaseUser, {
        url: `${window.location.origin}/dashboard`,
        handleCodeInApp: true
      })
      
      setMessage(
        language === 'en'
          ? 'Verification email sent! Check your inbox.'
          : language === 'ru'
            ? 'Письмо подтверждения отправлено! Проверьте папку "Входящие".'
            : 'Doğrulama e-poçtu göndərildi! Gələn xanənizi yoxlayın.'
      )

      // Cooldown 60 seconds before next resend
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      let errorMsg = language === 'en' ? 'Error sending email' : language === 'ru' ? 'Ошибка отправки письма' : 'E-poçt göndərmə xətası'
      
      if (err.code === 'auth/too-many-requests') {
        errorMsg = language === 'en' 
          ? 'Too many requests. Try again later.' 
          : language === 'ru' 
            ? 'Слишком много попыток. Попробуйте позже.' 
            : 'Həddindən artıq sorğu. Daha sonra yenidən cəhd edin.'
      }
      
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Layout>
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card card">
            <div className="auth-header">
              <h1>
                {language === 'en'
                  ? 'Verify Your Email'
                  : language === 'ru'
                    ? 'Подтвердите вашу почту'
                    : 'E-poçtunuzu doğrulayın'}
              </h1>
              <p>
                {language === 'en'
                  ? `A verification email has been sent to ${firebaseUser?.email}`
                  : language === 'ru'
                    ? `Письмо подтверждения отправлено на ${firebaseUser?.email}`
                    : `Doğrulama e-poçtu ${firebaseUser?.email} adresine göndərildi`}
              </p>
            </div>

            <div style={{ padding: '2rem 0' }}>
              <div style={{
                backgroundColor: '#e3f2fd',
                border: '1px solid #90caf9',
                color: '#1565c0',
                padding: '1.5rem',
                borderRadius: '6px',
                textAlign: 'center',
                marginBottom: '1.5rem',
                fontSize: '0.95rem',
                lineHeight: '1.5'
              }}>
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  ✉️ {language === 'en'
                    ? 'Click the link in the email to verify your email address.'
                    : language === 'ru'
                      ? 'Нажмите на ссылку в письме, чтобы подтвердить адрес электронной почты.'
                      : 'E-poçt ünvanınızı doğrulamaq üçün e-poçtdəki bağlantıya tıklayın.'}
                </p>
                <p style={{ margin: '0.5rem 0 0 0' }}>
                  {language === 'en'
                    ? 'After confirmation, you can access your dashboard.'
                    : language === 'ru'
                      ? 'После подтверждения вы сможете получить доступ к вашему кабинету.'
                      : 'Doğrulama sonra panelə daxil ola biləcəksiniz.'}
                </p>
              </div>

              {message && (
                <div style={{
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #4caf50',
                  color: '#2e7d32',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}>
                  ✓ {message}
                </div>
              )}

              {error && (
                <div style={{
                  backgroundColor: '#ffebee',
                  border: '1px solid #f44336',
                  color: '#c62828',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}>
                  ✕ {error}
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {language === 'en'
                    ? "Didn't receive the email?"
                    : language === 'ru'
                      ? 'Не получили письмо?'
                      : 'E-poçtu almadınız mı?'}
                </p>
                <button
                  onClick={handleResendEmail}
                  disabled={loading || resendCooldown > 0}
                  style={{
                    backgroundColor: '#b7925d',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: (loading || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                    opacity: (loading || resendCooldown > 0) ? 0.6 : 1,
                    transition: 'all 0.3s'
                  }}
                >
                  {loading
                    ? (language === 'en' ? 'Sending...' : language === 'ru' ? 'Отправка...' : 'Göndərilir...')
                    : resendCooldown > 0
                      ? (language === 'en' ? `Resend in ${resendCooldown}s` : language === 'ru' ? `Отправить через ${resendCooldown}с` : `${resendCooldown}s sonra göndər`)
                      : (language === 'en' ? 'Resend Email' : language === 'ru' ? 'Отправить снова' : 'E-poçtu yenidən göndər')}
                </button>
              </div>
            </div>

            <div className="auth-footer" style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              <p>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#b7925d',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.9rem'
                  }}
                >
                  {language === 'en' ? 'Sign out' : language === 'ru' ? 'Выйти' : 'Çıxış'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
