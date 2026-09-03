'use client'

import React from 'react'
import { Link, useNavigate } from '@/lib/navigation'
import { useLanguage, useAuth } from '@/components/providers'
import {InlineSpinner} from '@/components'
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase/client'
import { validateName, validatePhoneNumber } from '@birklik/core/utils/validators'
import { completeRegistrationAction } from '../actions'

export const RegistrationForm: React.FC = () => {
  const { t, language } = useLanguage()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [agreeToTerms, setAgreeToTerms] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    // Во время отправки формы не перехватываем навигацию: createUserWithEmailAndPassword
    // сразу делает пользователя авторизованным, но профиль и сессионная кука ещё
    // не созданы, а новичка нужно вести на /verify-email, а не в дашборд.
    if (loading) return
    if (isAuthenticated && auth.currentUser?.emailVerified) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate, loading])

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
      case 'auth/invalid-name':
        return language === 'en'
          ? 'Please enter a valid name'
          : language === 'ru'
            ? 'Укажите корректное имя'
            : 'Düzgün ad daxil edin'
      case 'auth/invalid-phone-number':
        return language === 'en'
          ? 'Please enter a valid phone number'
          : language === 'ru'
            ? 'Укажите корректный номер телефона'
            : 'Düzgün telefon nömrəsi daxil edin'
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

    if (!agreeToTerms) {
      setError(
        language === 'en'
          ? 'You must agree to the user agreement'
          : language === 'ru'
            ? 'Вы должны согласиться с условиями использования'
            : 'Siz istifadə şərtlərini qəbul etməlisiniz'
      )
      return
    }

    // Имя и телефон проверяем ДО создания учётки. Те же правила стоят на сервере,
    // но если дать ему отклонить их после createUserWithEmailAndPassword, учётка
    // уже существует — исправив телефон, пользователь упрётся в
    // auth/email-already-in-use и не сможет зарегистрироваться совсем.
    if (!validateName(formData.name)) {
      setError(getErrorMessage('auth/invalid-name'))
      return
    }

    if (!validatePhoneNumber(formData.phone)) {
      setError(getErrorMessage('auth/invalid-phone-number'))
      return
    }

    setLoading(true)

    try {
      // Учётку заводит браузер — App Check пропускает только его.
      const credential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      )

      await updateProfile(credential.user, { displayName: formData.name.trim() })
      await sendEmailVerification(credential.user)

      // Сервер выписывает сессионную куку и создаёт профиль в Firestore,
      // uid берёт из проверенного токена.
      const result = await completeRegistrationAction(
        await credential.user.getIdToken(),
        formData.name,
        formData.phone
      )

      if (!result.success) {
        // Куки нет, а SDK уже считает пользователя вошедшим. Разводим состояния,
        // иначе дашборд будет отбрасывать на /login. Учётка при этом создана —
        // войти обычным способом получится.
        await signOut(auth)
        setError(getErrorMessage(result.error || ''))
        setLoading(false)
        return
      }

      navigate('/verify-email')
    } catch (err) {
      setError(getErrorMessage(err instanceof FirebaseError ? err.code : ''))
    }

    setLoading(false)
  }

  return (
    <>
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

              <div className="form-group terms-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                  />
                  <span>
                    {language === 'en'
                      ? 'I agree to the '
                      : language === 'ru'
                        ? 'Я принимаю условия '
                        : 'Mən '}
                    <Link to="/user-agreement">
                      {language === 'en'
                        ? 'user agreement'
                        : language === 'ru'
                          ? 'пользовательского соглашения'
                          : 'istifadəçi razılaşmasını qəbul edirəm'}
                    </Link>
                  </span>
                </label>
              </div>

              <button 
                type="submit" 
                className="btn btn-accent btn-lg w-full"
                disabled={loading || !agreeToTerms}
                aria-busy={loading}
              >
                {loading && <InlineSpinner label={t.messages.loading} />}
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
    </>
  )
}
