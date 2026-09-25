'use client'

import {Link} from '@/lib/navigation'
import {useAuth, useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import type {ProfileFormProps} from '../hooks/use-profile-form'

/**
 * Презентационная вкладка профиля. Состояние живёт в useProfileForm, который
 * вызывается в родителе — иначе введённое пропадало бы при переключении вкладок.
 */
export function ProfileTab({form}: {form: ProfileFormProps}) {
  const {language, t} = useLanguage()
  const {user} = useAuth()

  if (!user) return null

  return (
    <div className="tab-content fade-in">
      <h2>{t.dashboard.profile}</h2>
      <div className="profile-card card">
        <div className="profile-header">
          {form.avatar || user.avatar
            ? <img src={form.avatar || user.avatar} alt={user.name} className="profile-avatar" />
            : <div className="profile-avatar avatar-initials" aria-hidden="true">
                {(form.name || user.name)?.trim().charAt(0).toUpperCase() || 'U'}
              </div>}
          <div><h3>{form.name || user.name}</h3><p>{user.email}</p></div>
        </div>
        {form.error && <div className="error-message">{form.error}</div>}
        {form.message && <div className="success-inline-message">{form.message}</div>}
        <form className="profile-form" onSubmit={form.onSubmit}>
          <div className="form-group">
            <label>{language === 'en' ? 'Profile Photo' : language === 'ru' ? 'Фото профиля' : 'Profil şəkli'}</label>
            <div className="profile-photo-upload-row">
              <label className="btn btn-ghost btn-sm profile-photo-btn">
                {language === 'en' ? 'Choose photo' : language === 'ru' ? 'Выбрать фото' : 'Şəkil seç'}
                <input type="file" accept="image/*" className="profile-photo-input" onChange={(event) => form.onPhotoChange(event.target.files?.[0] || null)} />
              </label>
              {form.avatar && <button type="button" className="btn btn-ghost btn-sm" onClick={form.onPhotoRemove}>{language === 'en' ? 'Remove' : language === 'ru' ? 'Удалить' : 'Sil'}</button>}
            </div>
          </div>
          <div className="form-group"><label>{t.auth.fullName}</label><input type="text" value={form.name} onChange={(event) => form.onNameChange(event.target.value)} /></div>
          <div className="form-group"><label>{t.auth.email}</label><input type="email" defaultValue={user.email} disabled /></div>
          <div className="form-group"><label>{t.auth.phone}</label><input type="tel" value={form.phone} onChange={(event) => form.onPhoneChange(event.target.value)} /></div>
          <button type="submit" className="btn btn-accent" disabled={form.isSaving} aria-busy={form.isSaving}>{form.isSaving && <InlineSpinner label={t.messages.loading} />}{form.isSaving ? t.messages.loading : t.form.submit}</button>
        </form>
      </div>

      {/* Удаление аккаунта — ссылкой на отдельную страницу, а не кнопкой здесь.
          Страница всё равно обязана существовать и быть общедоступной: её адрес
          идёт в анкету «Безопасность данных» Play Console. Две реализации
          одного и того же разошлись бы при первой же правке.

          ⚠️ Подпись задана здесь, а НЕ взята из t.pages. Раздел pages целиком
          вырезается из словаря перед отправкой в браузер — см.
          withoutServerOnlyMessages в site-shell.tsx. Обращение к нему из
          клиентского компонента роняет весь кабинет, что и случилось. */}
      <p className="profile-danger-link">
        <Link to="/account-deletion">
          {language === 'en'
            ? 'Delete your account'
            : language === 'ru'
              ? 'Удаление аккаунта'
              : 'Hesabın silinməsi'}
        </Link>
      </p>
    </div>
  )
}
