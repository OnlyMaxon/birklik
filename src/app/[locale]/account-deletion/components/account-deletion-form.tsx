'use client'

import React from 'react'
import {EmailAuthProvider, reauthenticateWithCredential, signOut} from 'firebase/auth'
import {FirebaseError} from 'firebase/app'
import {getFunctions, httpsCallable} from 'firebase/functions'
import {Link, useNavigate} from '@/lib/navigation'
import {useAuth, useLanguage} from '@/components/providers'
import {InlineSpinner, PasswordField} from '@/components'
import firebaseApp, {auth} from '@/lib/firebase/client'
import {logoutAction} from '@/lib/auth/actions'

/**
 * Подтверждение и вызов удаления.
 *
 * ⚠️ Повторный ввод пароля здесь не для красоты. Firebase отказывает в
 * «чувствительных» действиях, если вход старше пяти минут, а человек на эту
 * страницу приходит по ссылке из магазина или из письма — то есть почти всегда
 * со старым входом. `reauthenticateWithCredential` обновляет его и заодно
 * служит подтверждением намерения: удаление необратимо.
 *
 * Сама чистка происходит на сервере (`deleteAccount`): клиенту правила не дают
 * тронуть ни чужие брони на его объявлениях, ни снимки с другого устройства,
 * ни его следы на чужих объявлениях. Здесь только подтверждение и вызов.
 */
export const AccountDeletionForm: React.FC = () => {
  const {t} = useLanguage()
  const {isAuthenticated, firebaseUser, hasFirebaseResolved} = useAuth()
  const navigate = useNavigate()
  const content = t.pages.accountDeletion

  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [done, setDone] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const user = auth.currentUser
    if (!user?.email) return

    setBusy(true)
    setError('')

    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, password)
      )
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      setError(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? content.wrongPassword
          : content.failed
      )
      setBusy(false)
      return
    }

    try {
      const functions = getFunctions(firebaseApp, 'europe-west1')
      await httpsCallable<void, {ok: boolean}>(functions, 'deleteAccount')()
    } catch {
      setError(content.failed)
      setBusy(false)
      return
    }

    // Порядок важен: сессионная кука живёт 14 дней и переживает удаление входа.
    // Не погаси мы её здесь — серверные страницы кабинета продолжали бы считать
    // человека вошедшим, а клиент уже нет; ровно эта пара состояний однажды
    // загнала вход в карусель редиректов.
    //
    // `allSettled`, а не последовательность: пользователя в Firebase больше нет,
    // и `signOut` вполне может отказать. Отказ любого из двух шагов не повод
    // оставлять человека на странице с формой — удаление уже состоялось.
    await Promise.allSettled([signOut(auth), logoutAction()])

    setBusy(false)
    setDone(true)
  }

  if (done) {
    return (
      <section className="account-deletion__done" role="status">
        <h2>{content.doneTitle}</h2>
        <p>{content.doneText}</p>
        <button type="button" className="btn btn-accent btn-lg" onClick={() => navigate('/')}>
          {t.nav.home}
        </button>
      </section>
    )
  }

  // ⚠️ Ждём ответа Firebase, а не решаем по пустому `firebaseUser`. У
  // посетителя с серверной кукой `isAuthenticated` истинен сразу, а
  // `firebaseUser` ещё пуст: без этой проверки вошедшему показалось бы
  // «войдите», и он ушёл бы на /login, откуда его тут же вернуло бы обратно.
  if (isAuthenticated && !hasFirebaseResolved) {
    return (
      <section className="account-deletion__signin" aria-busy="true">
        <InlineSpinner label={t.messages.loading} />
      </section>
    )
  }

  if (!isAuthenticated || !firebaseUser?.email) {
    return (
      <section className="account-deletion__signin">
        <p>{content.notSignedIn}</p>
        <Link to="/login" className="btn btn-accent btn-lg">
          {content.goToLogin}
        </Link>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="account-deletion__form">
      <p className="account-deletion__who">
        {content.signedInAs} <strong>{firebaseUser.email}</strong>
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="account-deletion-password">{content.passwordLabel}</label>
        <PasswordField
          id="account-deletion-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          disabled={busy}
        />
      </div>

      <button
        type="submit"
        className="btn btn-lg account-deletion__submit"
        disabled={busy || password.length === 0}
        aria-busy={busy}
      >
        {busy && <InlineSpinner label={content.deleting} />}
        {busy ? content.deleting : content.deleteButton}
      </button>
    </form>
  )
}
