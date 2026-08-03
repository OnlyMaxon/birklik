'use client'

import {useEffect, useState, type FormEvent} from 'react'
import {useAuth, useLanguage} from '@/components/providers'

export function ProfileTab() {
  const {language, t} = useLanguage()
  const {user, updateUserProfile} = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setPhone(user.phone)
    setAvatar(user.avatar || '')
    setAvatarFile(null)
  }, [user])

  if (!user) return null

  const handlePhotoChange = (file: File | null) => {
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatar(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError(t.dashboard.fullNameRequired)
      setMessage('')
      return
    }

    setIsSaving(true)
    setError('')
    setMessage('')
    const result = await updateUserProfile({name: name.trim(), phone: phone.trim(), avatar, avatarFile})
    if (!result.success) {
      setError(t.dashboard.profileUpdateFailed)
      setIsSaving(false)
      return
    }
    setMessage(t.dashboard.profileUpdated)
    setAvatarFile(null)
    setIsSaving(false)
  }

  return (
    <div className="tab-content fade-in">
      <h2>{t.dashboard.profile}</h2>
      <div className="profile-card card">
        <div className="profile-header">
          <img src={avatar || user.avatar} alt={user.name} className="profile-avatar" />
          <div><h3>{name || user.name}</h3><p>{user.email}</p></div>
        </div>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-inline-message">{message}</div>}
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{language === 'en' ? 'Profile Photo' : language === 'ru' ? 'Фото профиля' : 'Profil şəkli'}</label>
            <div className="profile-photo-upload-row">
              <label className="btn btn-ghost btn-sm profile-photo-btn">
                {language === 'en' ? 'Choose photo' : language === 'ru' ? 'Выбрать фото' : 'Şəkil seç'}
                <input type="file" accept="image/*" className="profile-photo-input" onChange={(event) => handlePhotoChange(event.target.files?.[0] || null)} />
              </label>
              {avatar && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAvatar(''); setAvatarFile(null) }}>{language === 'en' ? 'Remove' : language === 'ru' ? 'Удалить' : 'Sil'}</button>}
            </div>
          </div>
          <div className="form-group"><label>{t.auth.fullName}</label><input type="text" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="form-group"><label>{t.auth.email}</label><input type="email" defaultValue={user.email} disabled /></div>
          <div className="form-group"><label>{t.auth.phone}</label><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
          <button type="submit" className="btn btn-accent" disabled={isSaving}>{isSaving ? t.messages.loading : t.form.submit}</button>
        </form>
      </div>
    </div>
  )
}
