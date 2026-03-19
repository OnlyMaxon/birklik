import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { propertyTypes, districts, amenitiesList } from '../../data'
import { PropertyType, District, Amenity, Property, ListingTier } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner, updateProperty } from '../../services'
import './DashboardPage.css'

type TabType = 'listings' | 'add' | 'profile'

interface DashboardPageProps {
  initialTab?: TabType
}

const DEFAULT_COORDINATES = { lat: 40.4093, lng: 49.8671 }

interface LocationPickerProps {
  coordinates: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
}

const MapCenterUpdater: React.FC<{ coordinates: { lat: number; lng: number } }> = ({ coordinates }) => {
  const map = useMap()

  React.useEffect(() => {
    map.setView([coordinates.lat, coordinates.lng], map.getZoom(), { animate: true })
  }, [coordinates, map])

  return null
}

const LocationPicker: React.FC<LocationPickerProps> = ({ coordinates, onChange }) => {
  useMapEvents({
    click: (event) => {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      })
    }
  })

  return (
    <CircleMarker
      center={[coordinates.lat, coordinates.lng]}
      radius={10}
      pathOptions={{ color: '#1f62c7', fillColor: '#ffb703', fillOpacity: 0.95, weight: 3 }}
    />
  )
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ initialTab = 'listings' }) => {
  const { language, t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = React.useState<TabType>(initialTab)
  const [showAddSuccess, setShowAddSuccess] = React.useState(false)
  const [listings, setListings] = React.useState<Property[]>([])
  const [isLoadingListings, setIsLoadingListings] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [hasTestData, setHasTestData] = React.useState(false)
  const [isAddingTestData, setIsAddingTestData] = React.useState(false)
  const [editingListingId, setEditingListingId] = React.useState<string | null>(null)
  const [listingCoordinates, setListingCoordinates] = React.useState(DEFAULT_COORDINATES)

  const isTestAccount = user?.email === 'calilorucli42@gmail.com'
  const savedMessage = language === 'en'
    ? 'Listing saved successfully'
    : 'Elan ugurla yadda saxlanildi'

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const getLocalizedText = (text: Record<'az' | 'en', string>) => text[language]

  const loadListings = React.useCallback(async () => {
    if (!user) return

    setIsLoadingListings(true)
    setError('')
    const ownerListings = await getPropertiesByOwner(user.id)
    setListings(ownerListings)
    setIsLoadingListings(false)
  }, [user])

  React.useEffect(() => {
    if (activeTab === 'listings' && user) {
      loadListings()
    }
  }, [activeTab, user, loadListings])

  // Form state for adding listing
  const [newListing, setNewListing] = React.useState({
    title: '',
    description: '',
    listingTier: 'free' as ListingTier,
    type: '' as PropertyType | '',
    district: '' as District | '',
    address: '',
    price: '',
    rooms: '',
    area: '',
    amenities: [] as Amenity[],
    contactEmail: '',
    contactPhone: ''
  })

  const resetListingForm = React.useCallback(() => {
    setNewListing({
      title: '',
      description: '',
      listingTier: 'free',
      type: '',
      district: '',
      address: '',
      price: '',
      rooms: '',
      area: '',
      amenities: [],
      contactEmail: user?.email || '',
      contactPhone: user?.phone || ''
    })
    setSelectedFiles([])
    setEditingListingId(null)
    setListingCoordinates(DEFAULT_COORDINATES)
  }, [user])

  React.useEffect(() => {
    if (activeTab === 'add' && !editingListingId && user) {
      setNewListing(prev => ({
        ...prev,
        contactEmail: prev.contactEmail || user.email,
        contactPhone: prev.contactPhone || user.phone
      }))
    }
  }, [activeTab, editingListingId, user])

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !newListing.type || !newListing.district) {
      return
    }

    setIsSubmitting(true)
    setError('')

    // Validate contact information
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newListing.contactEmail.trim() || !emailRegex.test(newListing.contactEmail)) {
      setError('Etibarlı email ünvanı daxil edin')
      setIsSubmitting(false)
      return
    }

    if (!newListing.contactPhone.trim()) {
      setError('Telefon nömrəsi daxil edin')
      setIsSubmitting(false)
      return
    }

    if (newListing.listingTier === 'free' && selectedFiles.length > 4) {
      setError('Pulsuz paket ucun maksimum 4 foto yuklemek olar')
      setIsSubmitting(false)
      return
    }

    const descriptionWordCount = newListing.description.trim().split(/\s+/).filter(Boolean).length
    if (newListing.listingTier === 'free' && descriptionWordCount > 35) {
      setError('Pulsuz paketde tesvir maksimum 35 soz ola biler')
      setIsSubmitting(false)
      return
    }

    if (newListing.listingTier !== 'free' && !newListing.address.trim()) {
      setError('Standart ve Premium paketde unvan daxil edilmelidir')
      setIsSubmitting(false)
      return
    }

    const dailyPrice = Number(newListing.price)
    const rooms = Number(newListing.rooms)
    const area = Number(newListing.area || 0)
    const normalizedAddress = newListing.listingTier === 'free' ? 'Lokasiya gizlidir' : newListing.address
    const listingStatus = newListing.listingTier === 'free' ? 'active' : 'pending'

    const propertyPayload: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
      type: newListing.type,
      district: newListing.district,
      price: {
        daily: dailyPrice,
        weekly: dailyPrice * 6,
        monthly: dailyPrice * 24,
        currency: 'AZN'
      },
      rooms,
      area,
      amenities: newListing.amenities,
      images: [],
      coordinates: listingCoordinates,
      title: {
        az: newListing.title,
        en: newListing.title
      },
      description: {
        az: newListing.description,
        en: newListing.description
      },
      address: {
        az: normalizedAddress,
        en: normalizedAddress
      },
      owner: {
        name: user.name,
        phone: newListing.contactPhone || user.phone,
        email: newListing.contactEmail || user.email
      },
      ownerId: user.id,
      listingTier: newListing.listingTier,
      status: listingStatus,
      isFeatured: newListing.listingTier === 'premium',
      isActive: true,
      city: 'Baku'
    }

    if (editingListingId) {
      const updated = await updateProperty(editingListingId, propertyPayload, selectedFiles)
      if (!updated) {
        setError(t.messages.error)
        setIsSubmitting(false)
        return
      }
    } else {
      const created = await createProperty(propertyPayload, selectedFiles)
      if (!created) {
        setError(t.messages.error)
        setIsSubmitting(false)
        return
      }
    }

    setShowAddSuccess(true)
    setTimeout(() => {
      setShowAddSuccess(false)
      setActiveTab('listings')
      resetListingForm()
      loadListings()
    }, 1500)

    setIsSubmitting(false)
  }

  const handleAmenityToggle = (amenity: Amenity) => {
    setNewListing(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  const handlePoolSelection = (value: 'yes' | 'no') => {
    setNewListing(prev => {
      const hasPoolAmenity = prev.amenities.includes('pool')

      if (value === 'yes' && !hasPoolAmenity) {
        return { ...prev, amenities: [...prev.amenities, 'pool'] }
      }

      if (value === 'no' && hasPoolAmenity) {
        return { ...prev, amenities: prev.amenities.filter(a => a !== 'pool') }
      }

      return prev
    })
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const handleDeleteListing = async (id: string) => {
    const ok = window.confirm('Delete this listing?')
    if (!ok) return

    const deleted = await deleteProperty(id)
    if (!deleted) {
      setError(t.messages.error)
      return
    }

    await loadListings()
  }

  const handleEditListing = (property: Property) => {
    setEditingListingId(property.id)
    setError('')
    setShowAddSuccess(false)
    setSelectedFiles([])

    setNewListing({
      title: property.title.az || property.title.en,
      description: property.description.az || property.description.en,
      listingTier: property.listingTier || 'free',
      type: property.type,
      district: property.district,
      address: property.address.az || property.address.en,
      price: String(property.price.daily || ''),
      rooms: String(property.rooms || ''),
      area: String(property.area || ''),
      amenities: property.amenities || [],
      contactEmail: property.owner.email || user.email,
      contactPhone: property.owner.phone || user.phone
    })

    setListingCoordinates(property.coordinates || DEFAULT_COORDINATES)

    setActiveTab('add')
  }

  const testListings = [
    {
      title: { az: 'Lüks villa - Test məntəqəsi', en: 'Luxury Villa - Test' },
      description: { az: 'Bu test elanıdır. Həqiqət olmayan məlumatdır.', en: 'This is a test listing. Fictional data.' },
      type: 'villa' as PropertyType,
      district: 'baku' as District,
      address: { az: 'Bakı, Test küçəsi 1', en: 'Baku, Test street 1' },
      price: { daily: 250, weekly: 1500, monthly: 5000, currency: 'AZN' },
      rooms: 5,
      area: 350,
      amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'bbq'] as Amenity[],
      images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'],
      coordinates: { lat: 40.4093, lng: 49.8671 },
      listingTier: 'premium' as ListingTier,
      status: 'active' as const,
      isFeatured: true,
      isActive: true,
      city: 'Baku'
    },
    {
      title: { az: 'Dəniz mənzərəli mənzil - Test', en: 'Sea View Apartment - Test' },
      description: { az: 'Test elanı - üç otaqlı müasir mənzil', en: 'Test listing - 3-room modern apartment' },
      type: 'apartment' as PropertyType,
      district: 'bilgah' as District,
      address: { az: 'Bilgəh, Test Dənizkənarı', en: 'Bilgah, Test Beach' },
      price: { daily: 120, weekly: 700, monthly: 2500, currency: 'AZN' },
      rooms: 3,
      area: 95,
      amenities: ['wifi', 'ac', 'kitchen', 'tv', 'parking', 'beach'] as Amenity[],
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
      coordinates: { lat: 40.5644, lng: 50.0372 },
      listingTier: 'standard' as ListingTier,
      status: 'active' as const,
      isFeatured: false,
      isActive: true,
      city: 'Baku'
    }
  ]

  const handleAddTestData = async () => {
    if (!user) return

    setIsAddingTestData(true)
    setError('')

    try {
      for (const testListing of testListings) {
        const propertyPayload: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
          ...testListing,
          owner: {
            name: user.name,
            phone: user.phone,
            email: user.email
          },
          ownerId: user.id
        }

        await createProperty(propertyPayload, [])
      }

      setHasTestData(true)
      await loadListings()
    } catch (err) {
      setError(t.messages.error)
    } finally {
      setIsAddingTestData(false)
    }
  }

  const handleRemoveTestData = async () => {
    const ok = window.confirm('Bütün test məlumatlarını silmək istəyirsiniz?')
    if (!ok) return

    setIsAddingTestData(true)
    setError('')

    try {
      const listingsToDelete = listings.filter(l => l.title.az.includes('Test'))

      for (const listing of listingsToDelete) {
        await deleteProperty(listing.id)
      }

      setHasTestData(false)
      await loadListings()
    } catch (err) {
      setError(t.messages.error)
    } finally {
      setIsAddingTestData(false)
    }
  }

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="user-info">
              <img src={user.avatar} alt={user.name} className="user-avatar" />
              <div>
                <h1>{t.dashboard.welcome}, {user.name}!</h1>
                <p>{user.email}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="dashboard-sidebar">
              <nav className="dashboard-nav">
                <button
                  className={`nav-item ${activeTab === 'listings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('listings')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  {t.dashboard.myListings}
                </button>
                <button
                  className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
                  onClick={() => setActiveTab('add')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v8"/>
                    <path d="M8 12h8"/>
                  </svg>
                  {t.dashboard.addListing}
                </button>
                <button
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t.dashboard.profile}
                </button>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="dashboard-content">
              {/* My Listings Tab */}
              {activeTab === 'listings' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.myListings}</h2>
                  {error && <div className="error-message">{error}</div>}
                  
                  {isLoadingListings ? (
                    <div className="empty-state">
                      <p>{t.messages.loading}</p>
                    </div>
                  ) : listings.length > 0 ? (
                    <div className="listings-list">
                      {listings.map((property) => {
                        const statusBadgeClass = property.status === 'active' ? 'badge-success' : 'badge-warning'
                        const statusText = property.status === 'active' ? '✓ Aktiv' : '⏳ Teklifin Gözlənilməsi'
                        return (
                          <div key={property.id} className="listing-item card">
                            <img 
                              src={property.images[0]} 
                              alt={getLocalizedText(property.title)}
                              className="listing-image"
                            />
                            <div className="listing-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Link to={`/property/${property.id}`} className="listing-title">
                                  {getLocalizedText(property.title)}
                                </Link>
                                <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {statusText}
                                </span>
                              </div>
                              <p className="listing-location">
                                {t.districts[property.district]}
                              </p>
                              <p className="listing-price">
                                {property.price.daily} {property.price.currency} / {t.property.perNight}
                              </p>
                              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                <strong>Status:</strong> {property.status === 'active' ? 'Aktiv' : 'Gözləmədə'}
                              </p>
                            </div>
                            <div className="listing-actions">
                              <div className="action-buttons">
                                <button className="btn btn-ghost btn-sm" onClick={() => handleEditListing(property)}>{t.dashboard.edit}</button>
                                <button className="btn btn-ghost btn-sm text-error" onClick={() => handleDeleteListing(property.id)}>{t.dashboard.delete}</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      <p>{t.dashboard.noListings}</p>
                      <button 
                        className="btn btn-accent"
                        onClick={() => setActiveTab('add')}
                      >
                        {t.dashboard.addListing}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Add Listing Tab */}
              {activeTab === 'add' && (
                <div className="tab-content fade-in">
                  <h2>{editingListingId ? t.dashboard.edit : t.dashboard.addListing}</h2>
                  {error && <div className="error-message">{error}</div>}

                  {showAddSuccess ? (
                    <div className="success-state">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <p>{editingListingId ? savedMessage : t.dashboard.listingAdded}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleAddListing} className="add-listing-form card">
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label>Elan paketi *</label>
                          <select
                            value={newListing.listingTier}
                            onChange={(e) => setNewListing({ ...newListing, listingTier: e.target.value as ListingTier })}
                          >
                            <option value="free">Pulsuz (0 AZN, 3-4 foto, lokasiya yoxdur)</option>
                            <option value="standard">Standart (15 AZN/ay, 20 foto, lokasiya var)</option>
                            <option value="premium">Premium (30 AZN/ay, one cixarilir)</option>
                          </select>
                          <small>
                            {newListing.listingTier === 'premium'
                              ? 'Premium elan 3 hefte ana sehifede prioritetli gosterilir.'
                              : newListing.listingTier === 'standard'
                              ? 'Standart paket tam melumat ve lokasiya ucundur.'
                              : 'Pulsuz paketde qisa tesvir, maksimum 4 foto ve gizli lokasiya var.'}
                          </small>
                        </div>

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

                        <div className="form-group">
                          <label>{t.search.district} *</label>
                          <select
                            value={newListing.district}
                            onChange={(e) => setNewListing({...newListing, district: e.target.value as District})}
                            required
                          >
                            <option value="">{t.form.selectDistrict}</option>
                            {districts.map(district => (
                              <option key={district} value={district}>{t.districts[district]}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.address} {newListing.listingTier === 'free' ? '' : '*'}</label>
                          <input
                            type="text"
                            value={newListing.address}
                            onChange={(e) => setNewListing({...newListing, address: e.target.value})}
                            required={newListing.listingTier !== 'free'}
                            placeholder={newListing.listingTier === 'free' ? 'Pulsuz paketde lokasiya gizledilir' : ''}
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>Xəritədə nöqtə *</label>
                          <p className="location-hint">Xəritədə klik edin və ya koordinatları əl ilə daxil edin.</p>
                          <div className="listing-location-picker">
                            <MapContainer
                              center={[listingCoordinates.lat, listingCoordinates.lng]}
                              zoom={13}
                              scrollWheelZoom={false}
                              className="listing-location-map"
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <MapCenterUpdater coordinates={listingCoordinates} />
                              <LocationPicker
                                coordinates={listingCoordinates}
                                onChange={setListingCoordinates}
                              />
                            </MapContainer>
                          </div>
                          <div className="coords-grid">
                            <div className="form-group">
                              <label>Latitude</label>
                              <input
                                type="number"
                                step="0.000001"
                                value={listingCoordinates.lat}
                                onChange={(e) => {
                                  const value = Number(e.target.value)
                                  if (Number.isFinite(value)) {
                                    setListingCoordinates(prev => ({ ...prev, lat: value }))
                                  }
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label>Longitude</label>
                              <input
                                type="number"
                                step="0.000001"
                                value={listingCoordinates.lng}
                                onChange={(e) => {
                                  const value = Number(e.target.value)
                                  if (Number.isFinite(value)) {
                                    setListingCoordinates(prev => ({ ...prev, lng: value }))
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setListingCoordinates(DEFAULT_COORDINATES)}
                          >
                            Koordinatı sıfırla (Bakı mərkəzi)
                          </button>
                        </div>

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

                        <div className="form-group full-width">
                          <label>{t.form.description}</label>
                          <textarea
                            value={newListing.description}
                            onChange={(e) => setNewListing({...newListing, description: e.target.value})}
                            rows={4}
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.selectAmenities}</label>
                          <div className="amenities-checkboxes">
                            {amenitiesList.map(amenity => (
                              <label key={amenity} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={newListing.amenities.includes(amenity)}
                                  onChange={() => handleAmenityToggle(amenity)}
                                />
                                <span>{t.amenities[amenity]}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.photos}</label>
                          <div className="file-upload">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                            />
                            <p>{newListing.listingTier === 'free' ? 'Maksimum 4 foto (Pulsuz paket)' : 'Drag & drop or click to upload'}</p>
                            {selectedFiles.length > 0 && <p>{selectedFiles.length} file(s) selected</p>}
                          </div>
                        </div>

                        <div className="form-group full-width" style={{ backgroundColor: 'rgba(26, 76, 160, 0.08)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #1a4ca0' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#1a4ca0', lineHeight: '1.5' }}>
                            <strong>Qeyd:</strong> Elan gonderildikden sonra support sizinle elaqe saxlayacaq ve {newListing.listingTier === 'free' ? 'tesdiq verecek' : 'odeme telimatini gonderecek'}.
                          </p>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => {
                          setActiveTab('listings')
                          resetListingForm()
                        }}>
                          {t.form.cancel}
                        </button>
                        <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
                          {isSubmitting ? t.messages.loading : editingListingId ? t.dashboard.edit : t.form.submit}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.profile}</h2>
                  
                  <div className="profile-card card">
                    <div className="profile-header">
                      <img src={user.avatar} alt={user.name} className="profile-avatar" />
                      <div>
                        <h3>{user.name}</h3>
                        <p>{user.email}</p>
                      </div>
                    </div>

                    <form className="profile-form">
                      <div className="form-group">
                        <label>{t.auth.fullName}</label>
                        <input type="text" defaultValue={user.name} />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.email}</label>
                        <input type="email" defaultValue={user.email} />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.phone}</label>
                        <input type="tel" defaultValue={user.phone} />
                      </div>
                      <button type="button" className="btn btn-accent">
                        {t.form.submit}
                      </button>
                    </form>

                    {isTestAccount && (
                      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0e7ff' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#1a4ca0' }}>🧪 Test Məlumatları</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                          Platformu sınaqdan keçirmək üçün test elanları əlavə edin və ya silin.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            type="button"
                            className={`btn ${hasTestData ? 'btn-ghost' : 'btn-accent'}`}
                            onClick={handleAddTestData}
                            disabled={isAddingTestData || hasTestData}
                          >
                            {isAddingTestData ? t.messages.loading : t.testData.addTest}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleRemoveTestData}
                            disabled={isAddingTestData || !hasTestData}
                            style={{ color: hasTestData ? '#d32f2f' : '#999' }}
                          >
                            {isAddingTestData ? t.messages.loading : t.testData.removeTest}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </Layout>
  )
}
