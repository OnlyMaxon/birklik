import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { Loading, CityLocationPicker } from '../../components'
import { LocationPicker, MapCenterUpdater, DEFAULT_COORDINATES } from '../DashboardPage/LocationPicker'
import { propertyTypes, amenitiesList, moreFilterOptions, nearFilterOptions } from '../../data'
import { resolveCity } from '../../data/cityAliases'
import { Language, PropertyType, District, Amenity, Property, ListingTier, LocationCategory, ListingStatus } from '../../types'
import { getPropertyById, updateProperty } from '../../services'
import './ModeratorPropertyEditPage.css'

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

function isoToLocalDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const ModeratorPropertyEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { language, t } = useLanguage()

  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)

  const [form, setForm] = React.useState({
    title: '',
    description: '',
    type: '' as PropertyType | '',
    address: '',
    price: '',
    rooms: '',
    minGuests: '',
    maxGuests: '',
    area: '',
    amenities: [] as Amenity[],
    extraFeatures: [] as string[],
    nearbyPlaces: [] as string[],
    locationCategory: 'rayon' as LocationCategory,
    locationTags: [] as string[],
    city: '',
    contactEmail: '',
    contactPhone: '',
    status: 'pending' as 'active' | 'pending' | 'inactive',
    isActive: true,
    listingTier: 'standard' as ListingTier,
    tierPlanDuration: '30days' as '14days' | '30days',
    premiumExpiresAt: '',
    vipExpiresAt: '',
  })

  const [coords, setCoords] = React.useState(DEFAULT_COORDINATES)
  const [existingImages, setExistingImages] = React.useState<string[]>([])
  const [newFiles, setNewFiles] = React.useState<File[]>([])
  const [newFilePreviews, setNewFilePreviews] = React.useState<{ name: string; url: string }[]>([])
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false)
  const [locationSearchError, setLocationSearchError] = React.useState('')

  React.useEffect(() => {
    if (!id) return
    const load = async () => {
      setIsLoading(true)
      const prop = await getPropertyById(id)
      if (!prop) {
        setError('Property not found')
        setIsLoading(false)
        return
      }
      setProperty(prop)
      setForm({
        title: prop.title.az || prop.title.en || '',
        description: prop.description.az || prop.description.en || '',
        type: prop.type,
        address: prop.address.az || prop.address.en || '',
        price: String(prop.price.daily || ''),
        rooms: String(prop.rooms || ''),
        minGuests: String(prop.minGuests || ''),
        maxGuests: String(prop.maxGuests || ''),
        area: String(prop.area || ''),
        amenities: prop.amenities || [],
        extraFeatures: prop.extraFeatures || [],
        nearbyPlaces: prop.nearbyPlaces || [],
        locationCategory: prop.locationCategory || 'rayon',
        locationTags: prop.locationTags || [],
        city: prop.city || 'Baku',
        contactEmail: prop.owner.email || '',
        contactPhone: prop.owner.phone || '',
        status: (prop.status as 'active' | 'pending' | 'inactive') || 'pending',
        isActive: prop.isActive !== false,
        listingTier: prop.listingTier || 'standard',
        tierPlanDuration: prop.tierPlanDuration || '30days',
        premiumExpiresAt: prop.premiumExpiresAt ? isoToLocalDate(prop.premiumExpiresAt) : '',
        vipExpiresAt: prop.vipExpiresAt ? isoToLocalDate(prop.vipExpiresAt) : '',
      })
      setCoords(prop.coordinates || DEFAULT_COORDINATES)
      setExistingImages(prop.images || [])
      setIsLoading(false)
    }
    load()
  }, [id])

  React.useEffect(() => {
    return () => {
      newFilePreviews.forEach(p => URL.revokeObjectURL(p.url))
    }
  }, [newFilePreviews])

  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

  const getLocalizedText = (text: Partial<Record<Language, string>>) =>
    text[language] || text.az || text.en || ''

  const getLocalizedOptionLabel = React.useCallback(
    (option: { key: string } | string): string => {
      const key = typeof option === 'string' ? option : option.key
      return (t as any)?.moreFeatures?.[key] || (t as any)?.near?.[key] || key
    },
    [t]
  )

  const sortByOptionLabel = React.useCallback(
    (a: { key: string } | string, b: { key: string } | string) => {
      return getLocalizedOptionLabel(a).localeCompare(getLocalizedOptionLabel(b))
    },
    [getLocalizedOptionLabel, language] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const sortedMoreOptions = React.useMemo(() => [...moreFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const sortedNearOptions = React.useMemo(() => [...nearFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const selectableAmenities = React.useMemo(() => amenitiesList.filter(a => a !== 'beach'), [])
  const popularMoreOptions = sortedMoreOptions.filter(o => quickMorePopular.includes(o.key))
  const popularNearOptions = sortedNearOptions.filter(o => quickNearPopular.includes(o.key))

  const geocodeCity = async (cityName: string) => {
    if (!cityName) return
    try {
      const resolvedQuery = resolveCity(cityName)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=az&q=${encodeURIComponent(resolvedQuery)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'az' } })
      if (!res.ok) return
      const results = await res.json() as { lat: string; lon: string }[]
      if (!results.length) return
      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })
      }
    } catch { /* ignore */ }
  }

  const handleRenewTier = (days: number) => {
    const field = form.listingTier === 'vip' ? 'vipExpiresAt' : 'premiumExpiresAt'
    const today = new Date()
    const newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
    const y = newDate.getFullYear()
    const m = String(newDate.getMonth() + 1).padStart(2, '0')
    const d = String(newDate.getDate()).padStart(2, '0')
    setForm(prev => ({ ...prev, [field]: `${y}-${m}-${d}`, status: 'active' }))
  }

  const handleSearchLocation = async () => {
    const query = form.address.trim()
    if (!query) {
      setLocationSearchError(t.dashboard.enterAddressForSearch)
      return
    }
    setIsSearchingLocation(true)
    setLocationSearchError('')
    try {
      const resolvedQuery = resolveCity(query)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=az&q=${encodeURIComponent(resolvedQuery)}`
      const response = await fetch(url, {
        headers: { 'Accept-Language': language === 'en' ? 'en' : language === 'ru' ? 'ru' : 'az' }
      })
      if (!response.ok) throw new Error('Geocoding request failed')
      const results = await response.json() as { lat: string; lon: string }[]
      if (!results.length) {
        setLocationSearchError(t.dashboard.addressNotFound)
        return
      }
      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchError(t.errors.invalidCoordinates)
        return
      }
      setCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })
    } catch {
      setLocationSearchError(t.dashboard.locationSearchFailed)
    } finally {
      setIsSearchingLocation(false)
    }
  }

  const handleNewFilesAdd = (files: FileList | null) => {
    if (!files) return
    const fileArr = Array.from(files)
    const previews = fileArr.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))
    setNewFiles(prev => [...prev, ...fileArr])
    setNewFilePreviews(prev => [...prev, ...previews])
  }

  const handleRemoveNewFile = (index: number) => {
    URL.revokeObjectURL(newFilePreviews[index].url)
    setNewFiles(prev => prev.filter((_, i) => i !== index))
    setNewFilePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveExisting = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index))
  }

  const toggleAmenity = (amenity: Amenity) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  const toggleStringField = (field: 'extraFeatures' | 'nearbyPlaces', value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }))
  }

  const clearField = (field: 'extraFeatures' | 'nearbyPlaces') => {
    setForm(prev => ({ ...prev, [field]: [] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !property) return

    setIsSubmitting(true)
    setError('')

    if (!form.title.trim()) { setError(t.listing.createTitle); setIsSubmitting(false); return }
    if (!form.type) { setError(t.listing.selectType); setIsSubmitting(false); return }
    if (!form.city) { setError(t.listing.selectCity); setIsSubmitting(false); return }
    if (!form.price || Number(form.price) <= 0) { setError(t.listing.enterPrice); setIsSubmitting(false); return }
    if (!form.rooms || Number(form.rooms) <= 0) { setError(t.listing.enterRooms); setIsSubmitting(false); return }
    if (!form.address.trim()) {
      setError(isEnglish ? 'Address is required' : isRussian ? 'Введите адрес' : 'Ünvan daxil edilməlidir')
      setIsSubmitting(false)
      return
    }

    const daily = Number(form.price)
    const selectedDistrict = (form.locationTags.length > 0 ? form.locationTags[0] : 'baku') as District

    const updates: Partial<Property> = {
      title: { az: form.title, en: form.title },
      description: { az: form.description, en: form.description },
      type: form.type as PropertyType,
      district: selectedDistrict,
      address: { az: form.address, en: form.address },
      price: { daily, weekly: daily * 6, monthly: daily * 24, currency: 'AZN' },
      rooms: Number(form.rooms),
      minGuests: Number(form.minGuests) || 1,
      maxGuests: Number(form.maxGuests) || 2,
      area: Number(form.area) || 0,
      amenities: form.amenities,
      extraFeatures: form.extraFeatures,
      nearbyPlaces: form.nearbyPlaces,
      locationCategory: form.locationCategory,
      locationTags: form.locationTags,
      city: form.city,
      coordinates: coords,
      owner: { name: property.owner.name, phone: form.contactPhone, email: form.contactEmail },
      status: form.status as ListingStatus,
      isActive: form.isActive,
      listingTier: form.listingTier,
      tierPlanDuration: form.tierPlanDuration,
      isFeatured: form.listingTier === 'premium',
      images: existingImages,
    }

    if (form.listingTier === 'premium' && form.premiumExpiresAt) {
      const [ey, em, ed] = form.premiumExpiresAt.split('-').map(Number)
      updates.premiumExpiresAt = new Date(ey, em - 1, ed, 23, 59, 59).toISOString()
    }
    if (form.listingTier === 'vip' && form.vipExpiresAt) {
      const [ey, em, ed] = form.vipExpiresAt.split('-').map(Number)
      updates.vipExpiresAt = new Date(ey, em - 1, ed, 23, 59, 59).toISOString()
    }

    const ok = await updateProperty(id, updates, newFiles.length > 0 ? newFiles : undefined)
    if (!ok) {
      setError(t.listing.updateFailed)
      setIsSubmitting(false)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/dashboard/review?tab=allListings'), 1200)
  }

  if (isLoading) return <Loading fullScreen message={t.messages.loading} brand />

  if (!property) {
    return (
      <Layout>
        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p>{error || (isEnglish ? 'Property not found' : isRussian ? 'Объявление не найдено' : 'Elan tapılmadı')}</p>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard/review?tab=allListings')}>
            ← {isEnglish ? 'All Listings' : isRussian ? 'Все объявления' : 'Bütün Elanlar'}
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <section className="mpe-page">
        <div className="container">
          <div className="mpe-header">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/dashboard/review?tab=allListings')}
            >
              ← {isEnglish ? 'All Listings' : isRussian ? 'Все объявления' : 'Bütün Elanlar'}
            </button>
            <h1 className="mpe-title">
              {isEnglish ? 'Edit Listing' : isRussian ? 'Редактировать объявление' : 'Elanı Redaktə Et'}
            </h1>
            <p className="mpe-subtitle">{getLocalizedText(property.title)}</p>
          </div>

          {success ? (
            <div className="mpe-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p>{isEnglish ? 'Listing updated successfully' : isRussian ? 'Объявление успешно обновлено' : 'Elan uğurla yeniləndi'}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="add-listing-form mpe-form">

              {/* Moderation Controls */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--accent">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Moderation Controls' : isRussian ? 'Управление модерацией' : 'Moderasiya idarəetməsi'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{isEnglish ? 'Status' : isRussian ? 'Статус' : 'Status'}</label>
                      <select
                        value={form.status}
                        onChange={e => setForm(prev => ({ ...prev, status: e.target.value as 'active' | 'pending' | 'inactive' }))}
                      >
                        <option value="pending">{isEnglish ? 'Pending (moderation)' : isRussian ? 'На проверке' : 'Gözləmədə'}</option>
                        <option value="active">{isEnglish ? 'Active (approved)' : isRussian ? 'Активен (одобрен)' : 'Aktiv (təsdiqləndi)'}</option>
                        <option value="inactive">{isEnglish ? 'Inactive (premium expired)' : isRussian ? 'Неактивен (истёк премиум)' : 'Deaktiv (premium bitdi)'}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{isEnglish ? 'Visibility' : isRussian ? 'Видимость' : 'Görünürlük'}</label>
                      <select
                        value={form.isActive ? 'active' : 'archived'}
                        onChange={e => setForm(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                      >
                        <option value="active">{isEnglish ? 'Published' : isRussian ? 'Опубликовано' : 'Dərc olunub'}</option>
                        <option value="archived">{isEnglish ? 'Archived (hidden)' : isRussian ? 'Архивировано (скрыто)' : 'Arxiv (gizli)'}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{isEnglish ? 'Listing Tier' : isRussian ? 'Тариф' : 'Paket'}</label>
                      <select
                        value={form.listingTier}
                        onChange={e => setForm(prev => ({ ...prev, listingTier: e.target.value as ListingTier }))}
                      >
                        <option value="standard">{t.pricing.standard}</option>
                        <option value="vip">{t.pricing.vip}</option>
                        <option value="premium">{t.pricing.premium}</option>
                      </select>
                    </div>
                    {(form.listingTier === 'vip' || form.listingTier === 'premium') && (
                      <div className="form-group">
                        <label>{isEnglish ? 'Plan Duration' : isRussian ? 'Срок тарифа' : 'Paket müddəti'}</label>
                        <select
                          value={form.tierPlanDuration}
                          onChange={e => setForm(prev => ({ ...prev, tierPlanDuration: e.target.value as '14days' | '30days' }))}
                        >
                          <option value="14days">{t.pricing.days14}</option>
                          <option value="30days">{t.pricing.days30}</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {(form.listingTier === 'premium' || form.listingTier === 'vip') && (
                    <div className="tier-renewal-block">
                      <label className="tier-renewal-label">
                        {form.listingTier === 'premium'
                          ? (isEnglish ? 'Premium Expires' : isRussian ? 'Истечение премиума' : 'Premium bitmə tarixi')
                          : (isEnglish ? 'VIP Expires' : isRussian ? 'Истечение VIP' : 'VIP bitmə tarixi')}
                      </label>
                      <div className="tier-renewal-row">
                        <input
                          type="date"
                          className="tier-date-input"
                          value={form.listingTier === 'vip' ? form.vipExpiresAt : form.premiumExpiresAt}
                          onChange={e => {
                            const field = form.listingTier === 'vip' ? 'vipExpiresAt' : 'premiumExpiresAt'
                            setForm(prev => ({ ...prev, [field]: e.target.value }))
                          }}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleRenewTier(14)}>
                          +14 {isEnglish ? 'days' : isRussian ? 'дней' : 'gün'}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleRenewTier(30)}>
                          +30 {isEnglish ? 'days' : isRussian ? 'дней' : 'gün'}
                        </button>
                      </div>
                      <p className="tier-renewal-hint">
                        {isEnglish
                          ? '* Renew buttons count from today and auto-set status to Active'
                          : isRussian
                          ? '* Кнопки считают от сегодня и автоматически ставят статус «Активен»'
                          : '* Düymələr bu gündən hesablanır və statusu «Aktiv» edir'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Contact Details' : isRussian ? 'Контактные данные' : 'Əlaqə məlumatları'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={form.contactEmail}
                        onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Telefon *</label>
                      <input
                        type="tel"
                        value={form.contactPhone}
                        onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                        placeholder="+994 XX XXX XX XX"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Listing Info */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Listing Info' : isRussian ? 'Информация об объявлении' : 'Elan məlumatları'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t.form.title} *</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>{t.search.propertyType} *</label>
                      <select
                        value={form.type}
                        onChange={e => setForm(prev => ({ ...prev, type: e.target.value as PropertyType }))}
                        required
                      >
                        <option value="">{t.form.selectType}</option>
                        {propertyTypes.map(type => (
                          <option key={type} value={type}>{t.propertyTypes[type]}</option>
                        ))}
                      </select>
                    </div>
                    <CityLocationPicker
                      city={form.city}
                      locationTags={form.locationTags}
                      locationCategory={form.locationCategory}
                      onCityChange={city => { setForm(prev => ({ ...prev, city, locationTags: [] })); if (city) geocodeCity(city) }}
                      onLocationTagsChange={tags => setForm(prev => ({ ...prev, locationTags: tags }))}
                      onLocationCategoryChange={category => setForm(prev => ({ ...prev, locationCategory: category }))}
                    />
                  </div>
                </div>
              </div>

              {/* Address & Map */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Address & Map' : isRussian ? 'Адрес и карта' : 'Ünvan və xəritə'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t.form.address} *</label>
                      <div className="location-search-row">
                        <input
                          type="text"
                          value={form.address}
                          onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                          placeholder={t.dashboard.searchAddressPlaceholder}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleSearchLocation}
                          disabled={isSearchingLocation}
                        >
                          {isSearchingLocation ? t.messages.loading : t.buttons.findOnMap}
                        </button>
                      </div>
                      {locationSearchError && <p className="location-search-error">{locationSearchError}</p>}
                      <p className="location-hint">Xəritədə klik edin və ya ünvanla axtarın.</p>
                      <div className="listing-location-picker">
                        <MapContainer
                          center={[coords.lat, coords.lng]}
                          zoom={13}
                          scrollWheelZoom={true}
                          className="listing-location-map"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapCenterUpdater coordinates={coords} />
                          <LocationPicker
                            coordinates={coords}
                            onChange={setCoords}
                            onAddressReverse={address => setForm(prev => ({ ...prev, address }))}
                          />
                        </MapContainer>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCoords(DEFAULT_COORDINATES)}
                      >
                        Koordinatı sıfırla (Bakı mərkəzi)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Details' : isRussian ? 'Детали' : 'Detallar'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t.form.price} (AZN) *</label>
                      <input
                        type="number"
                        value={form.price}
                        onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                        required
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t.form.rooms} *</label>
                      <input
                        type="number"
                        value={form.rooms}
                        onChange={e => setForm(prev => ({ ...prev, rooms: e.target.value }))}
                        required
                        min="1"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t.form.minGuests} *</label>
                      <select
                        value={form.minGuests}
                        onChange={e => setForm(prev => ({ ...prev, minGuests: e.target.value }))}
                        required
                      >
                        <option value="">Select min</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <option key={n} value={String(n)}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t.form.maxGuests} *</label>
                      <select
                        value={form.maxGuests}
                        onChange={e => setForm(prev => ({ ...prev, maxGuests: e.target.value }))}
                        required
                      >
                        <option value="">Select max</option>
                        {[2,3,4,5,6,7,8,9].map(n => (
                          <option key={n} value={String(n)}>{n}</option>
                        ))}
                        <option value="10">10+</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t.form.area}</label>
                      <input
                        type="number"
                        value={form.area}
                        onChange={e => setForm(prev => ({ ...prev, area: e.target.value }))}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t.search.pool}</label>
                      <select
                        value={form.amenities.includes('pool') ? 'yes' : 'no'}
                        onChange={e => {
                          const hasPool = e.target.value === 'yes'
                          setForm(prev => ({
                            ...prev,
                            amenities: hasPool
                              ? prev.amenities.includes('pool') ? prev.amenities : [...prev.amenities, 'pool' as Amenity]
                              : prev.amenities.filter(a => a !== 'pool')
                          }))
                        }}
                      >
                        <option value="yes">{t.search.yes}</option>
                        <option value="no">{t.search.no}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Description' : isRussian ? 'Описание' : 'Təsvir'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>{t.form.description}</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  </div>
                  <div className="form-section-title">
                    {isEnglish ? 'Amenities' : isRussian ? 'Удобства' : 'Şərait'}
                  </div>
                </div>
                <div className="form-section-body">
                  <div className="amenities-checkboxes">
                    {selectableAmenities.map(amenity => (
                      <label key={amenity} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.amenities.includes(amenity)}
                          onChange={() => toggleAmenity(amenity)}
                        />
                        <span>{t?.amenities?.[amenity] || amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* More Features */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <div className="form-section-header-text">
                    <div className="form-section-title">
                      {isEnglish ? 'More Features' : isRussian ? 'Дополнительно' : 'Əlavə xüsusiyyətlər'}
                      {form.extraFeatures.length > 0 && (
                        <span className="form-section-count">{form.extraFeatures.length}</span>
                      )}
                    </div>
                  </div>
                  {form.extraFeatures.length > 0 && (
                    <button type="button" className="dashboard-section-clear" onClick={() => clearField('extraFeatures')}>
                      {isEnglish ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
                    </button>
                  )}
                </div>
                <div className="form-section-body">
                  <div className="dashboard-quick-chip-row">
                    {popularMoreOptions.map(option => (
                      <button
                        type="button"
                        key={option.key}
                        className={`dashboard-quick-chip ${form.extraFeatures.includes(option.key) ? 'active' : ''}`}
                        onClick={() => toggleStringField('extraFeatures', option.key)}
                      >
                        {getLocalizedOptionLabel(option)}
                      </button>
                    ))}
                  </div>
                  <div className="advanced-checkboxes">
                    {sortedMoreOptions.map(option => (
                      <label key={option.key} className="checkbox-label advanced-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.extraFeatures.includes(option.key)}
                          onChange={() => toggleStringField('extraFeatures', option.key)}
                        />
                        <span>{getLocalizedOptionLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nearby Places */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <div className="form-section-header-text">
                    <div className="form-section-title">
                      {isEnglish ? 'Nearby Places' : isRussian ? 'Рядом' : 'Yaxın yerlər'}
                      {form.nearbyPlaces.length > 0 && (
                        <span className="form-section-count">{form.nearbyPlaces.length}</span>
                      )}
                    </div>
                  </div>
                  {form.nearbyPlaces.length > 0 && (
                    <button type="button" className="dashboard-section-clear" onClick={() => clearField('nearbyPlaces')}>
                      {isEnglish ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
                    </button>
                  )}
                </div>
                <div className="form-section-body">
                  <div className="dashboard-quick-chip-row">
                    {popularNearOptions.map(option => (
                      <button
                        type="button"
                        key={option.key}
                        className={`dashboard-quick-chip ${form.nearbyPlaces.includes(option.key) ? 'active' : ''}`}
                        onClick={() => toggleStringField('nearbyPlaces', option.key)}
                      >
                        {getLocalizedOptionLabel(option)}
                      </button>
                    ))}
                  </div>
                  <div className="advanced-checkboxes near-checkboxes">
                    {sortedNearOptions.map(option => (
                      <label key={option.key} className="checkbox-label advanced-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.nearbyPlaces.includes(option.key)}
                          onChange={() => toggleStringField('nearbyPlaces', option.key)}
                        />
                        <span>{getLocalizedOptionLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="form-section">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon--rose">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div className="form-section-header-text">
                    <div className="form-section-title">{t.form.photos}</div>
                    <div className="form-section-subtitle">
                      {existingImages.length + newFiles.length}{' '}
                      {isEnglish ? 'photo(s)' : isRussian ? 'фото' : 'şəkil'}
                    </div>
                  </div>
                </div>
                <div className="form-section-body">
                  {existingImages.length > 0 && (
                    <div className="upload-preview-grid" style={{ marginBottom: '1rem' }}>
                      {existingImages.map((url, index) => (
                        <div key={url} className="upload-preview-item">
                          <div className="preview-photo-wrapper">
                            <img src={url} alt={`Photo ${index + 1}`} />
                            <div className="preview-controls">
                              <button
                                type="button"
                                onClick={() => handleRemoveExisting(index)}
                                className="control-btn delete-btn"
                                title={t.buttons.delete}
                                aria-label={t.buttons.delete}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <span className="filename">
                            {index === 0
                              ? (isEnglish ? 'Cover' : isRussian ? 'Обложка' : 'Örtük')
                              : `#${index + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="file-upload">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={e => handleNewFilesAdd(e.target.files)}
                    />
                    {newFiles.length > 0 && (
                      <p>
                        {newFiles.length}{' '}
                        {isEnglish ? 'new file(s) selected' : isRussian ? 'новых файл(ов) выбрано' : 'yeni fayl seçildi'}
                      </p>
                    )}
                  </div>
                  {newFilePreviews.length > 0 && (
                    <div className="upload-preview-grid">
                      {newFilePreviews.map((preview, index) => (
                        <div key={preview.url} className="upload-preview-item">
                          <div className="preview-photo-wrapper">
                            <img src={preview.url} alt={preview.name} />
                            <div className="preview-controls">
                              <button
                                type="button"
                                onClick={() => handleRemoveNewFile(index)}
                                className="control-btn delete-btn"
                                title={t.buttons.delete}
                                aria-label={t.buttons.delete}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <span className="filename">{preview.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate('/dashboard/review?tab=allListings')}
                  disabled={isSubmitting}
                >
                  {t.form.cancel}
                </button>
                <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
                  {isSubmitting
                    ? t.messages.loading
                    : (isEnglish ? 'Save Changes' : isRussian ? 'Сохранить изменения' : 'Dəyişiklikləri Saxla')}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </Layout>
  )
}
