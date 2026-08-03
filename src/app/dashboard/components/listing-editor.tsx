'use client'

import React, {type Dispatch, type FormEvent, type SetStateAction} from 'react'
import dynamic from 'next/dynamic'
import {CityLocationPicker} from '@/components'
import {useLanguage} from '@/components/providers'
import {amenitiesList, moreFilterOptions, nearFilterOptions, propertyTypes} from '@/data'
import type {Amenity, ListingTier, PropertyType} from '@/types'
import {DEFAULT_COORDINATES, type ListingFormState} from './dashboard-types'

const LocationMap = dynamic(
  () => import('./location-map').then(module => module.LocationMap),
  {ssr: false, loading: () => <div className="listing-location-map" aria-busy="true" />}
)

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

interface ListingEditorProps {
  editingListingId: string | null
  newListing: ListingFormState
  setNewListing: Dispatch<SetStateAction<ListingFormState>>
  error: string
  showAddSuccess: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  selectedFiles: File[]
  setSelectedFiles: Dispatch<SetStateAction<File[]>>
  existingImages: string[]
  setExistingImages: Dispatch<SetStateAction<string[]>>
  selectedFilePreviews: Array<{name: string; url: string}>
  listingCoordinates: {lat: number; lng: number}
  setListingCoordinates: Dispatch<SetStateAction<{lat: number; lng: number}>>
  isSearchingLocation: boolean
  locationSearchError: string
  onSearchLocation: () => void
  onGeocodeCity: (city: string) => void
  onDeletePhoto: (index: number) => void
  onMovePhotoUp: (index: number) => void
  onMovePhotoDown: (index: number) => void
  onMoveExistingUp: (index: number) => void
  onMoveExistingDown: (index: number) => void
  isSubmitting: boolean
}

export function ListingEditor({
  editingListingId,
  newListing,
  setNewListing,
  error,
  showAddSuccess,
  onSubmit: handleAddListing,
  onCancel,
  selectedFiles,
  setSelectedFiles,
  existingImages,
  setExistingImages,
  selectedFilePreviews,
  listingCoordinates,
  setListingCoordinates,
  isSearchingLocation,
  locationSearchError,
  onSearchLocation: handleSearchLocation,
  onGeocodeCity: geocodeCity,
  onDeletePhoto: handleDeletePhoto,
  onMovePhotoUp: handleMovePhotoUp,
  onMovePhotoDown: handleMovePhotoDown,
  onMoveExistingUp: handleMoveExistingUp,
  onMoveExistingDown: handleMoveExistingDown,
  isSubmitting
}: ListingEditorProps) {
  const {language, t} = useLanguage()
  const isEnglish = language === 'en'
  const isRussian = language === 'ru'
  const savedMessage = isEnglish ? 'Listing saved successfully' : isRussian ? 'Объявление успешно сохранено' : 'Elan uğurla yadda saxlanıldı'

  const planFeatures = React.useMemo(() => ({
    standard: isEnglish
      ? ['20 photos', 'Full description', 'Open location']
      : isRussian ? ['20 фото', 'Полное описание', 'Открытая локация'] : ['20 foto', 'Tam təsvir', 'Açıq lokasiya'],
    vip: isEnglish
      ? ['VIP badge on listing', 'Up to 20 photos', 'Open location', 'The ad will be randomly displayed at the top of the VIP section and search results in your area']
      : isRussian
        ? ['VIP значок на объявлении', 'До 20 фото', 'Открытая локация', 'Объявление будет отображаться в случайном порядке в топ-позициях в разделе VIP и результатах поиска по вашему региону']
        : ['Elana VIP nişanı', '20 fotoya qədər', 'Açıq lokasiya', 'Elan VIP bölməsində və sizin ərazi üzrə axtarış nəticələrində təsadüfi qaydada ön sıralarda göstəriləcək'],
    premium: isEnglish
      ? ['Full description', 'Up to 30 photos', 'Open location', 'Priority Ad will be shown on the home page (recommendations)', 'The ad will be randomly displayed at the top of the search results in your area']
      : isRussian
        ? ['Полное описание', 'До 30 фото', 'Открытая локация', 'Приоритетное объявление будет отображаться на главной странице (в рекомендациях)', 'Объявление будет отображаться в случайном порядке в топ-позициях результатов поиска по вашему региону']
        : ['Tam təsvir', '30 fotoya qədər', 'Açıq lokasiya', 'Prioritetli Elan əsas səhifədə (rekomendasiyalarda) göstəriləcək', 'Sizin ərazi üzrə axtarış nəticələrində təsadüfi qaydada ön sıralarda göstəriləcək']
  }), [isEnglish, isRussian])

  const listingPlans = React.useMemo(() => [
    {id: 'standard' as ListingTier, title: t.pricing.standard, isFree: true, price: t.pricing.free, features: planFeatures.standard, emphasis: t.pricing.standardDesc, ribbon: '🎁 ' + t.pricing.free},
    {id: 'vip' as ListingTier, title: t.pricing.vip, isFree: false, features: planFeatures.vip, emphasis: t.pricing.vipDesc, pricingOptions: [{duration: '14days', label: t.pricing.days14, price: '20 AZN'}, {duration: '30days', label: t.pricing.days30, price: '30 AZN'}], showPricingDropdown: true},
    {id: 'premium' as ListingTier, title: t.pricing.premium, isFree: false, features: planFeatures.premium, emphasis: t.pricing.premiumDesc, pricingOptions: [{duration: '14days', label: t.pricing.days14, price: '30 AZN'}, {duration: '30days', label: t.pricing.days30, price: '55 AZN'}], showPricingDropdown: true, highlighted: true}
  ], [planFeatures, t])

  const handleAmenityToggle = (amenity: Amenity) => setNewListing(previous => ({...previous, amenities: previous.amenities.includes(amenity) ? previous.amenities.filter(item => item !== amenity) : [...previous.amenities, amenity]}))
  const toggleStringField = (field: 'extraFeatures' | 'nearbyPlaces' | 'locationTags', value: string) => setNewListing(previous => ({...previous, [field]: previous[field].includes(value) ? previous[field].filter(item => item !== value) : [...previous[field], value]}))
  const handlePoolSelection = (value: 'yes' | 'no') => setNewListing(previous => ({...previous, amenities: value === 'yes' ? Array.from(new Set([...previous.amenities, 'pool' as Amenity])) : previous.amenities.filter(item => item !== 'pool')}))
  const getLocalizedOptionLabel = React.useCallback((option: {key: string} | string) => typeof option === 'string' ? option : (t.amenities as Record<string, string>)[option.key] || option.key, [t])
  const sortByOptionLabel = React.useCallback((a: {key: string} | string, b: {key: string} | string) => getLocalizedOptionLabel(a).localeCompare(getLocalizedOptionLabel(b), isEnglish ? 'en' : 'az'), [getLocalizedOptionLabel, isEnglish])
  const sortedMoreOptions = React.useMemo(() => [...moreFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const sortedNearOptions = React.useMemo(() => [...nearFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const selectableAmenities = React.useMemo(() => amenitiesList.filter(amenity => amenity !== 'beach'), [])
  const popularMoreOptions = sortedMoreOptions.filter(option => quickMorePopular.includes(option.key))
  const popularNearOptions = sortedNearOptions.filter(option => quickNearPopular.includes(option.key))
  const clearListingSection = (field: 'extraFeatures' | 'nearbyPlaces') => setNewListing(previous => ({...previous, [field]: []}))
  const handleMinGuestsChange = (value: string) => setNewListing(previous => Number(value) > (previous.maxGuests === '10+' ? 999 : Number(previous.maxGuests || 10)) ? {...previous, minGuests: value, maxGuests: value} : {...previous, minGuests: value})
  const handleMaxGuestsChange = (value: string) => setNewListing(previous => (value === '10+' ? 999 : Number(value)) < Number(previous.minGuests || 1) ? {...previous, maxGuests: value, minGuests: value === '10+' ? '10' : value} : {...previous, maxGuests: value})

  return (
  <div className="tab-content fade-in">
    <h2>{editingListingId ? t.dashboard.edit : t.dashboard.addListing}</h2>
    {!newListing.listingTier && !error && (
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#fff3cd',
        color: '#856404',
        border: '1px solid #ffeeba',
        borderRadius: '6px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <span style={{ fontWeight: '500' }}>
          {t.dashboard.selectListingPlan}
        </span>
      </div>
    )}
     {showAddSuccess ? (
      <div className="success-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>{editingListingId ? savedMessage : t.dashboard.listingAdded}</p>
      </div>
    ) : (
      <form onSubmit={handleAddListing} className="add-listing-form">
         {/* Plan Selection */}
        <div className="form-section">
          <div className="form-section-header">
            <div className="form-section-icon form-section-icon--accent">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div className="form-section-header-text">
              <div className="form-section-title">
                {isEnglish ? 'Select Plan' : isRussian ? 'Выберите тариф' : 'Paket seçin'}
                {newListing.listingTier ? (
                  <span className="form-section-title-badge form-section-title-badge--ok">
                    {newListing.listingTier === 'standard' ? t.pricing.standard : newListing.listingTier === 'vip' ? t.pricing.vip : t.pricing.premium}
                  </span>
                ) : (
                  <span className="form-section-title-badge form-section-title-badge--req">
                    {t.form.required}
                  </span>
                )}
              </div>
              <div className="form-section-subtitle">{t.home.plansSubtitle}</div>
            </div>
          </div>
          <div className="form-section-body">
            <div className="listing-plans-grid">
              {listingPlans.map((plan) => {
                const isSelected = newListing.listingTier === plan.id
                const durActive = (dur: string) => isSelected && newListing.tierPlanDuration === dur
                return (
                  <div
                    key={plan.id}
                    className={['plan-card', isSelected ? 'plan-card--selected' : '', plan.id === 'vip' ? 'plan-card--vip' : '', plan.highlighted ? 'plan-card--premium' : ''].filter(Boolean).join(' ')}
                  >
                    {isSelected && <div className="plan-card__check">✓</div>}
                    {plan.isFree && <div className="plan-card__ribbon">{t.pricing.free}</div>}
                    <button
                      type="button"
                      className="plan-card__btn"
                      onClick={() => { setNewListing({ ...newListing, listingTier: plan.id }) }}
                    >
                      <div className="plan-card__icon">
                        {plan.id === 'standard' ? '🎁' : plan.id === 'vip' ? '⭐' : '👑'}
                      </div>
                      <div className="plan-card__name">{plan.title}</div>
                      <div className="plan-card__desc">{plan.emphasis}</div>
                      {plan.isFree && <div className="plan-card__price">{plan.price}</div>}
                    </button>
                    {!plan.isFree && plan.pricingOptions && (
                      <div className="plan-card__duration">
                        {plan.pricingOptions.map((option) => (
                          <button
                            key={option.duration}
                            type="button"
                            className={'plan-duration-btn' + (durActive(option.duration) ? ' active' : '')}
                            onClick={() => setNewListing({ ...newListing, listingTier: plan.id, tierPlanDuration: option.duration as '14days' | '30days' })}
                          >
                            <span className="plan-duration-label">{option.label}</span>
                            <span className="plan-duration-price">{option.price}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {plan.features && plan.features.length > 0 && (
                      <ul className="plan-card__features">
                        {plan.features.map((feature, idx) => <li key={idx}>{feature}</li>)}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
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
                  value={newListing.contactEmail}
                  onChange={(e) => setNewListing({...newListing, contactEmail: e.target.value})}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Telefon *</label>
                <input
                  type="tel"
                  value={newListing.contactPhone}
                  onChange={(e) => setNewListing({...newListing, contactPhone: e.target.value})}
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
                  value={newListing.title}
                  onChange={(e) => setNewListing({...newListing, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t.search.propertyType} *</label>
                <select
                  value={newListing.type}
                  onChange={(e) => setNewListing({...newListing, type: e.target.value as PropertyType})}
                  required
                >
                  <option value="">{t.form.selectType}</option>
                  {propertyTypes.map(type => (
                    <option key={type} value={type}>{t.propertyTypes[type]}</option>
                  ))}
                </select>
              </div>
              <CityLocationPicker
                city={newListing.city}
                locationTags={newListing.locationTags}
                locationCategory={newListing.locationCategory}
                onCityChange={(city) => { setNewListing(prev => ({...prev, city, locationTags: []})); if (city) geocodeCity(city) }}
                onLocationTagsChange={(tags) => setNewListing(prev => ({...prev, locationTags: tags}))}
                onLocationCategoryChange={(category) => setNewListing(prev => ({...prev, locationCategory: category}))}
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
                    value={newListing.address}
                    onChange={(e) => setNewListing({...newListing, address: e.target.value})}
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
                  <LocationMap
                    coordinates={listingCoordinates}
                    onChange={setListingCoordinates}
                    onAddressReverse={(address) => setNewListing({...newListing, address})}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setListingCoordinates(DEFAULT_COORDINATES)}
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
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
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
                  value={newListing.price}
                  onChange={(e) => setNewListing({...newListing, price: e.target.value})}
                  required
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>{t.form.rooms} *</label>
                <input
                  type="number"
                  value={newListing.rooms}
                  onChange={(e) => setNewListing({...newListing, rooms: e.target.value})}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>{t.form.minGuests} *</label>
                <select
                  value={newListing.minGuests}
                  onChange={(e) => handleMinGuestsChange(e.target.value)}
                  required
                >
                  <option value="">Select min</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t.form.maxGuests} *</label>
                <select
                  value={newListing.maxGuests}
                  onChange={(e) => handleMaxGuestsChange(e.target.value)}
                  required
                >
                  <option value="">Select max</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10+</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t.form.area}</label>
                <input
                  type="number"
                  value={newListing.area}
                  onChange={(e) => setNewListing({...newListing, area: e.target.value})}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>{t.search.pool}</label>
                <select
                  value={newListing.amenities.includes('pool') ? 'yes' : 'no'}
                  onChange={(e) => handlePoolSelection(e.target.value as 'yes' | 'no')}
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
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
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
                  value={newListing.description}
                  onChange={(e) => setNewListing({...newListing, description: e.target.value})}
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
                    checked={newListing.amenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
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
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div className="form-section-header-text">
              <div className="form-section-title">
                {isEnglish ? 'More Features' : isRussian ? 'Дополнительно' : 'Əlavə xüsusiyyətlər'}
                {newListing.extraFeatures.length > 0 && (
                  <span className="form-section-count">{newListing.extraFeatures.length}</span>
                )}
              </div>
            </div>
            {newListing.extraFeatures.length > 0 && (
              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('extraFeatures')}>
                {isEnglish ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
              </button>
            )}
          </div>
          <div className="form-section-body">
            <div className="dashboard-quick-chip-row">
              {popularMoreOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={`dashboard-quick-chip ${newListing.extraFeatures.includes(option.key) ? 'active' : ''}`}
                  onClick={() => toggleStringField('extraFeatures', option.key)}
                >
                  {getLocalizedOptionLabel(option)}
                </button>
              ))}
            </div>
            <div className="advanced-checkboxes">
              {sortedMoreOptions.map((option) => (
                <label key={option.key} className="checkbox-label advanced-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newListing.extraFeatures.includes(option.key)}
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
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="form-section-header-text">
              <div className="form-section-title">
                {isEnglish ? 'Nearby Places' : isRussian ? 'Рядом' : 'Yaxın yerlər'}
                {newListing.nearbyPlaces.length > 0 && (
                  <span className="form-section-count">{newListing.nearbyPlaces.length}</span>
                )}
              </div>
            </div>
            {newListing.nearbyPlaces.length > 0 && (
              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('nearbyPlaces')}>
                {isEnglish ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
              </button>
            )}
          </div>
          <div className="form-section-body">
            <div className="dashboard-quick-chip-row">
              {popularNearOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={`dashboard-quick-chip ${newListing.nearbyPlaces.includes(option.key) ? 'active' : ''}`}
                  onClick={() => toggleStringField('nearbyPlaces', option.key)}
                >
                  {getLocalizedOptionLabel(option)}
                </button>
              ))}
            </div>
            <div className="advanced-checkboxes near-checkboxes">
              {sortedNearOptions.map((option) => (
                <label key={option.key} className="checkbox-label advanced-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newListing.nearbyPlaces.includes(option.key)}
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
                {newListing.listingTier === 'standard' || newListing.listingTier === 'vip'
                  ? (isEnglish ? 'Max 20 photos' : isRussian ? 'Макс. 20 фото' : 'Maks. 20 şəkil')
                  : newListing.listingTier === 'premium'
                  ? (isEnglish ? 'Max 30 photos' : isRussian ? 'Макс. 30 фото' : 'Maks. 30 şəkil')
                  : (isEnglish ? 'Select a plan first' : isRussian ? 'Сначала выберите тариф' : 'Əvvəlcə paket seçin')}
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
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveExistingUp(index)}
                            className="control-btn move-up-btn"
                            title={t.buttons.moveUp}
                            aria-label={t.buttons.moveUp}
                          >
                            ↑
                          </button>
                        )}
                        {index < existingImages.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveExistingDown(index)}
                            className="control-btn move-down-btn"
                            title={t.buttons.moveDown}
                            aria-label={t.buttons.moveDown}
                          >
                            ↓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== index))}
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
                onChange={(e) => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
              />
              {selectedFiles.length > 0 && (
                <p>{selectedFiles.length} {isEnglish ? 'new file(s) selected' : isRussian ? 'новых файл(ов) выбрано' : 'yeni fayl seçildi'}</p>
              )}
            </div>
            {selectedFilePreviews.length > 0 && (
              <div className="upload-preview-grid">
                {selectedFilePreviews.map((preview, index) => (
                  <div key={preview.url} className="upload-preview-item">
                    <div className="preview-photo-wrapper">
                      <img src={preview.url} alt={preview.name} />
                      <div className="preview-controls">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMovePhotoUp(index)}
                            className="control-btn move-up-btn"
                            title={t.buttons.moveUp}
                            aria-label={t.buttons.moveUp}
                          >
                            ↑
                          </button>
                        )}
                        {index < selectedFilePreviews.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMovePhotoDown(index)}
                            className="control-btn move-down-btn"
                            title={t.buttons.moveDown}
                            aria-label={t.buttons.moveDown}
                          >
                            ↓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(index)}
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
         <div className="form-note">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ margin: 0 }}>
            <strong>{isEnglish ? 'Note:' : isRussian ? 'Примечание:' : 'Qeyd:'}</strong>{' '}
            {isEnglish
              ? 'All listings, including Free plan, are sent to moderation and published after approval.'
              : isRussian
                ? 'Все объявления, включая бесплатный тариф, отправляются на модерацию и публикуются после одобрения.'
                : 'Bütün elanlar, o cümlədən pulsuz paket, moderasiyaya göndərilir və təsdiqdən sonra yayımlanır.'}
          </p>
        </div>
         {error && <div className="error-message">{error}</div>}
         <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t.form.cancel}
          </button>
          <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
            {isSubmitting ? t.messages.loading : editingListingId ? t.dashboard.edit : t.form.submit}
          </button>
        </div>
      </form>
    )}
  </div>
  )
}
