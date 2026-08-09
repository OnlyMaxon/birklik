'use client'

import {useCallback, useEffect, useState, type FormEvent} from 'react'
import {useAuth, useLanguage} from '@/components/providers'

export interface ProfileFormProps {
  name: string
  phone: string
  avatar: string
  message: string
  error: string
  isSaving: boolean
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onPhotoChange: (file: File | null) => void
  onPhotoRemove: () => void
  onSubmit: (event: FormEvent) => void
}

/**
 * Состояние формы профиля.
 *
 * Вызывается в dashboard-client, а не внутри ProfileTab: вкладки рендерятся
 * условно, поэтому состояние внутри вкладки обнулялось бы при каждом
 * переключении и введённое пропадало. Так же устроен useListingEditor.
 */
export function useProfileForm(): ProfileFormProps {
  const {t} = useLanguage()
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

  const onPhotoChange = useCallback((file: File | null) => {
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatar(reader.result)
    }
    reader.readAsDataURL(file)
  }, [])

  const onPhotoRemove = useCallback(() => {
    setAvatar('')
    setAvatarFile(null)
  }, [])

  const onSubmit = useCallback(async (event: FormEvent) => {
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
  }, [name, phone, avatar, avatarFile, updateUserProfile, t])

  return {
    name,
    phone,
    avatar,
    message,
    error,
    isSaving,
    onNameChange: setName,
    onPhoneChange: setPhone,
    onPhotoChange,
    onPhotoRemove,
    onSubmit
  }
}
