import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import '../LoginPage/AuthPages.css'

export const RegisterPage: React.FC = () => {
  const { t, language } = useLanguage()
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return language === 'en'
          ? 'This email is already registered'
          : language === 'ru'
            ? 'Этот email уже зарегистрирован'
            : 'Bu email artıq qeydiyyatdan keçib'
      case 'auth/invalid-email':
        return language === 'en'
          ? 'Invalid email'
          : language === 'ru'
            ? 'Некорректный email'
            : 'Email düzgün deyil'
      case 'auth/weak-password':
        return language === 'en'
          ? 'Password must be at least 6 characters'
          : language === 'ru'
            ? 'Пароль должен содержать минимум 6 символов'
            : 'Şifrə ən azı 6 simvoldan ibarət olmalıdır'
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
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError(
        language === 'en'
          ? 'Passwords do not match'
          : language === 'ru'
            ? 'Пароли не совпадают'
            : 'Şifrələr uyğun gəlmir'
      )
      return
    }

    if (formData.password.length < 6) {
      setError(
        language === 'en'
          ? 'Password must be at least 6 characters'
          : language === 'ru'
            ? 'Пароль должен содержать минимум 6 символов'
            : 'Şifrə ən azı 6 simvoldan ibarət olmalıdır'
      )
      return
    }

    setLoading(true)

    const result = await register(
      formData.name,
      formData.email,
      formData.phone,
      formData.password
    )
    
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
              <h1>{t.auth.register}</h1>
              <p>{t.site.tagline}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label>{t.auth.fullName}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label>{t.auth.email}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label>{t.auth.phone}</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  autoComplete="tel"
                  placeholder="+994"
                />
              </div>

              <div className="form-group">
                <label>{t.auth.password}</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>{t.auth.confirmPassword}</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-accent btn-lg w-full"
                disabled={loading}
              >
                {loading ? t.messages.loading : t.auth.register}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {t.auth.hasAccount}{' '}
                <Link to="/login">{t.auth.login}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
