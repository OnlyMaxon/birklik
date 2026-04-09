import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { Loading } from '../../components'

export const ProfileTab: React.FC = () => {
  const { language, t } = useLanguage()
  const { user, updateUserProfile } = useAuth()
  const [profileName, setProfileName] = React.useState('')
  const [profilePhone, setProfilePhone] = React.useState('')
  const [profileAvatar, setProfileAvatar] = React.useState('')
  const [profileAvatarFile, setProfileAvatarFile] = React.useState<File | null>(null)
  const [profileMessage, setProfileMessage] = React.useState('')
  const [profileError, setProfileError] = React.useState('')
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name)
      setProfilePhone(user.phone)
      setProfileAvatar(user.avatar || '')
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage('')
    setProfileError('')

    if (!profileName.trim()) {
      setProfileError(language === 'en' ? 'Name is required' : language === 'ru' ? 'Имя обязательно' : 'Ad tələb olunur')
      return
    }

    setIsSavingProfile(true)
    const result = await updateUserProfile({
      name: profileName,
      phone: profilePhone,
      avatar: profileAvatar,
      avatarFile: profileAvatarFile
    })

    if (result.success) {
      setProfileMessage(
        language === 'en'
          ? 'Profile updated successfully'
          : language === 'ru'
            ? 'Профиль обновлён'
            : 'Profil yeniləndi'
      )
      setProfileAvatarFile(null)
    } else {
      setProfileError(result.error || 'Failed to update profile')
    }
    setIsSavingProfile(false)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfileAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!user) {
    return <Loading message="Loading..." />
  }

  return (
    <div className="profile-tab">
      <h2>{t.dashboard.profile}</h2>

      <div className="profile-card card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="profile-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <img
            src={profileAvatar || user.avatar}
            alt={user.name}
            className="profile-avatar"
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <h3>{profileName || user.name}</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>{language === 'en' ? 'Name' : language === 'ru' ? 'Имя' : 'Ad'}:</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={user.name}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>{language === 'en' ? 'Phone' : language === 'ru' ? 'Телефон' : 'Telefon'}:</label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder={user.phone}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>{language === 'en' ? 'Avatar' : language === 'ru' ? 'Аватар' : 'Avatar'}:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ width: '100%' }}
            />
            {profileAvatarFile && <p style={{ fontSize: '0.85rem', color: '#28a745' }}>✓ New avatar selected</p>}
          </div>

          {profileError && <div style={{ color: '#d32f2f', marginBottom: '1rem' }}>{profileError}</div>}
          {profileMessage && <div style={{ color: '#28a745', marginBottom: '1rem' }}>{profileMessage}</div>}

          <button
            type="submit"
            disabled={isSavingProfile}
            className="btn btn-accent"
            style={{ width: '100%' }}
          >
            {isSavingProfile ? 'Saving...' : language === 'en' ? 'Save Profile' : language === 'ru' ? 'Сохранить' : 'Saxla'}
          </button>
        </form>
      </div>

      <style>{`
        .profile-tab {
          padding: 1rem;
        }

        .profile-card {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: #333;
        }

        .form-group input {
          font-size: 1rem;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #d6b17d;
          box-shadow: 0 0 0 3px rgba(214, 177, 125, 0.1);
        }

        .btn {
          background: #d6b17d;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
          font-weight: 500;
          font-size: 1rem;
          transition: background 0.3s;
        }

        .btn:hover:not(:disabled) {
          background: #c9a156;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
