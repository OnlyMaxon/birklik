import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { propertyTypes, districts, amenitiesList, moreFilterOptions, nearFilterOptions, cityLocationOptions } from '../../data'
import { PropertyType, District, Amenity, Property, ListingTier, LocationCategory } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner, updateProperty } from '../../services'
import './DashboardPage.css'

type TabType = 'listings' | 'add' | 'profile'

interface DashboardPageProps {
  initialTab?: TabType
}

interface GeocodeResult {
  lat: string
  lon: string
}

const DEFAULT_COORDINATES = { lat: 40.4093, lng: 49.8671 }
const getTodayISO = (): string => new Date().toISOString().split('T')[0]

const isOccupationExpired = (property: Property): boolean => {
  if (!property.unavailableTo) return false
  return property.unavailableTo < getTodayISO()
}

const locationTabs: { key: LocationCategory; az: string; en: string }[] = [
  { key: 'rayon', az: 'Rayon', en: 'District' },
  { key: 'metro', az: 'Metro', en: 'Metro' },
  { key: 'landmark', az: 'Nisangah', en: 'Landmark' }
]

const quickMorePopular = ['pool', 'ac', 'wifi', 'bbq']
const quickNearPopular = ['sea', 'forest', 'park']

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
  const [locationSearch, setLocationSearch] = React.useState('')
  const [locationTagsSearch, setLocationTagsSearch] = React.useState('')
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false)
  const [locationSearchError, setLocationSearchError] = React.useState('')
  const [busyListingId, setBusyListingId] = React.useState<string | null>(null)
  const [busyFrom, setBusyFrom] = React.useState('')
  const [busyTo, setBusyTo] = React.useState('')
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false)

  const isTestAccount = user?.email === 'calilorucli42@gmail.com'
  const savedMessage = language === 'en'
    ? 'Listing saved successfully'
    : 'Elan ugurla yadda saxlanildi'

  const listingPlans = [
    {
      id: 'free' as ListingTier,
      title: t.pricing.free,
      price: '0 AZN',
      period: t.pricing.perMonth,
      perks: [t.pricing_info.free_features],
      emphasis: t.pricing.freeDesc
    },
    {
      id: 'standard' as ListingTier,
      title: t.pricing.standard,
      price: '15 AZN',
      period: t.pricing.perMonth,
      perks: [t.pricing_info.standard_features],
      emphasis: t.pricing.standardDesc
    },
    {
      id: 'premium' as ListingTier,
      title: t.pricing.premium,
      price: '30 AZN',
      period: t.pricing.perMonth,
      perks: [t.pricing_info.premium_features, t.pricing_info.premium_highlight],
      emphasis: t.pricing.premiumDesc,
      highlighted: true
    }
  ]

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

    const expiredInactive = ownerListings.filter(
      listing => listing.isActive === false && isOccupationExpired(listing)
    )

    if (expiredInactive.length > 0) {
      await Promise.all(
        expiredInactive.map((listing) =>
          updateProperty(listing.id, {
            isActive: true,
            unavailableFrom: '',
            unavailableTo: ''
          })
        )
      )
    }

    const normalizedListings = ownerListings.map(listing => {
      if (listing.isActive === false && isOccupationExpired(listing)) {
        return {
          ...listing,
          isActive: true,
          unavailableFrom: '',
          unavailableTo: ''
        }
      }

      return listing
    })

    setListings(normalizedListings)
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
    extraFeatures: [] as string[],
    nearbyPlaces: [] as string[],
    locationCategory: 'rayon' as LocationCategory,
    locationTags: [] as string[],
    city: 'Baku',
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
      extraFeatures: [],
      nearbyPlaces: [],
      locationCategory: 'rayon',
      locationTags: [],
      city: 'Baku',
      contactEmail: user?.email || '',
      contactPhone: user?.phone || ''
    })
    setSelectedFiles([])
    setEditingListingId(null)
    setListingCoordinates(DEFAULT_COORDINATES)
    setLocationSearch('')
    setLocationTagsSearch('')
    setLocationSearchError('')
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

  const handleSearchLocation = async () => {
    const query = locationSearch.trim() || newListing.address.trim()
    if (!query) {
      setLocationSearchError(language === 'en' ? 'Enter address for search.' : 'Axtarış üçün ünvan daxil edin.')
      return
    }

    setIsSearchingLocation(true)
    setLocationSearchError('')

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, Azerbaijan`)}`
      const response = await fetch(url, {
        headers: {
          'Accept-Language': language === 'en' ? 'en' : 'az'
        }
      })

      if (!response.ok) {
        throw new Error('Geocoding request failed')
      }

      const results = (await response.json()) as GeocodeResult[]

      if (!results.length) {
        setLocationSearchError(language === 'en' ? 'Address not found. Try a more specific address.' : 'Ünvan tapılmadı. Daha dəqiq ünvan yazın.')
        return
      }

      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchError(language === 'en' ? 'Invalid coordinates received.' : 'Koordinatlar düzgün alınmadı.')
        return
      }

      setListingCoordinates({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      })
    } catch (searchError) {
      setLocationSearchError(language === 'en' ? 'Location search failed. Try again.' : 'Ünvan axtarışı uğursuz oldu. Yenidən cəhd edin.')
    } finally {
      setIsSearchingLocation(false)
    }
  }

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
      extraFeatures: newListing.extraFeatures,
      nearbyPlaces: newListing.nearbyPlaces,
      locationCategory: newListing.locationCategory,
      locationTags: newListing.locationTags,
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
      city: newListing.city || 'Baku'
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

  const toggleStringField = (field: 'extraFeatures' | 'nearbyPlaces' | 'locationTags', value: string) => {
    setNewListing(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }))
  }

  const handleLocationCategoryChange = (category: LocationCategory) => {
    setNewListing(prev => ({
      ...prev,
      locationCategory: category,
      locationTags: []
    }))
    setLocationTagsSearch('')
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

  const filteredLocationTagOptions = cityLocationOptions[newListing.locationCategory].filter((option) => {
    const query = locationTagsSearch.trim().toLowerCase()
    if (!query) return true
    return option.az.toLowerCase().includes(query) || option.en.toLowerCase().includes(query)
  })

  const getLocalizedOptionLabel = React.useCallback((option: { az: string; en: string }) => {
    return language === 'en' ? option.en : option.az
  }, [language])

  const sortByOptionLabel = React.useCallback((a: { az: string; en: string }, b: { az: string; en: string }) => {
    return getLocalizedOptionLabel(a).localeCompare(getLocalizedOptionLabel(b), language === 'en' ? 'en' : 'az')
  }, [getLocalizedOptionLabel, language])

  const sortedMoreOptions = React.useMemo(() => [...moreFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const sortedNearOptions = React.useMemo(() => [...nearFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const sortedLocationTagOptions = React.useMemo(() => [...filteredLocationTagOptions].sort(sortByOptionLabel), [filteredLocationTagOptions, sortByOptionLabel])
  const popularMoreOptions = sortedMoreOptions.filter((option) => quickMorePopular.includes(option.key))
  const popularNearOptions = sortedNearOptions.filter((option) => quickNearPopular.includes(option.key))

  const clearListingSection = (field: 'extraFeatures' | 'nearbyPlaces' | 'locationTags') => {
    setNewListing(prev => ({ ...prev, [field]: [] }))
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

  const handleOpenBusyModal = (property: Property) => {
    setBusyListingId(property.id)
    setBusyFrom(property.unavailableFrom || '')
    setBusyTo(property.unavailableTo || '')
  }

  const handleCloseBusyModal = () => {
    setBusyListingId(null)
    setBusyFrom('')
    setBusyTo('')
  }

  const handleSetInactiveWithDates = async () => {
    if (!busyListingId) return

    if (!busyFrom || !busyTo) {
      setError(language === 'en' ? 'Select both start and end dates.' : 'Baslama ve bitme tarixini secin.')
      return
    }

    if (busyFrom > busyTo) {
      setError(language === 'en' ? 'Start date must be before end date.' : 'Baslama tarixi bitme tarixinden boyuk ola bilmez.')
      return
    }

    setIsSavingAvailability(true)
    setError('')

    const updated = await updateProperty(busyListingId, {
      isActive: false,
      unavailableFrom: busyFrom,
      unavailableTo: busyTo
    })

    if (!updated) {
      setError(t.messages.error)
      setIsSavingAvailability(false)
      return
    }

    setIsSavingAvailability(false)
    handleCloseBusyModal()
    await loadListings()
  }

  const handleSetActive = async (id: string) => {
    setError('')
    const updated = await updateProperty(id, {
      isActive: true,
      unavailableFrom: '',
      unavailableTo: ''
    })

    if (!updated) {
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
      extraFeatures: property.extraFeatures || [],
      nearbyPlaces: property.nearbyPlaces || [],
      locationCategory: property.locationCategory || 'rayon',
      locationTags: property.locationTags || [],
      city: property.city || 'Baku',
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
                        const isCurrentlyActive = property.isActive !== false || isOccupationExpired(property)
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
                                <span className={`badge ${isCurrentlyActive ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {isCurrentlyActive ? '✓ Aktiv' : '📅 Məşğul'}
                                </span>
                              </div>
                              <p className="listing-location">
                                {t.districts[property.district]}
                              </p>
                              <p className="listing-price">
                                {property.price.daily} {property.price.currency} / {t.property.perNight}
                              </p>
                              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                <strong>Status:</strong> {isCurrentlyActive ? 'Aktiv' : 'Məşğul / göstərilmir'}
                              </p>
                              {!isCurrentlyActive && property.unavailableFrom && property.unavailableTo && (
                                <p style={{ fontSize: '0.84rem', color: '#8b5a10', marginTop: '0.15rem' }}>
                                  <strong>Tarix:</strong> {property.unavailableFrom} - {property.unavailableTo}
                                </p>
                              )}
                              {!isCurrentlyActive && property.unavailableTo && (
                                <p style={{ fontSize: '0.82rem', color: '#4a6288', marginTop: '0.12rem' }}>
                                  Yenidən aktiv etmək üçün Active düyməsini sıxın.
                                </p>
                              )}
                            </div>
                            <div className="listing-actions">
                              <div className="action-buttons">
                                {isCurrentlyActive ? (
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleOpenBusyModal(property)}>
                                    Non active et
                                  </button>
                                ) : (
                                  <button className="btn btn-accent btn-sm" onClick={() => handleSetActive(property.id)}>
                                    Active et
                                  </button>
                                )}
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
                      <div className="listing-plans-header">
                        <h3>{t.home.plansTitle}</h3>
                        <p>{t.home.plansSubtitle}</p>
                      </div>

                      <div className="listing-plans-grid">
                        {listingPlans.map((plan) => (
                          <button
                            type="button"
                            key={plan.id}
                            className={`listing-plan-card ${newListing.listingTier === plan.id ? 'selected' : ''} ${plan.highlighted ? 'highlighted' : ''}`}
                            onClick={() => setNewListing({ ...newListing, listingTier: plan.id })}
                          >
                            <div className="listing-plan-head">
                              <h4>{plan.title}</h4>
                              <div className="listing-plan-price">
                                <strong>{plan.price}</strong>
                                <span>{plan.period}</span>
                              </div>
                            </div>
                            <p className="listing-plan-emphasis">{plan.emphasis}</p>
                            <ul>
                              {plan.perks.map((perk) => (
                                <li key={perk}>{perk}</li>
                              ))}
                            </ul>
                          </button>
                        ))}
                      </div>

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
                          <div className="location-search-row">
                            <input
                              type="text"
                              value={locationSearch}
                              onChange={(e) => setLocationSearch(e.target.value)}
                              placeholder={language === 'en' ? 'Search address (e.g. Mardakan, Baku)' : 'Ünvan axtarın (məs: Mərdəkan, Bakı)'}
                            />
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={handleSearchLocation}
                              disabled={isSearchingLocation}
                            >
                              {isSearchingLocation ? t.messages.loading : (language === 'en' ? 'Find on map' : 'Xəritədə tap')}
                            </button>
                          </div>
                          {locationSearchError && <p className="location-search-error">{locationSearchError}</p>}
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
                          <div className="dashboard-section-head">
                            <label>{language === 'en' ? 'More' : 'Elave'} <span className="dashboard-count-pill">{newListing.extraFeatures.length}</span></label>
                            {newListing.extraFeatures.length > 0 && (
                              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('extraFeatures')}>
                                {language === 'en' ? 'Clear' : 'Temizle'}
                              </button>
                            )}
                          </div>
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

                        <div className="form-group full-width">
                          <div className="dashboard-section-head">
                            <label>{language === 'en' ? 'Near' : 'Yaxinda'} <span className="dashboard-count-pill">{newListing.nearbyPlaces.length}</span></label>
                            {newListing.nearbyPlaces.length > 0 && (
                              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('nearbyPlaces')}>
                                {language === 'en' ? 'Clear' : 'Temizle'}
                              </button>
                            )}
                          </div>
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

                        <div className="form-group full-width location-tags-section">
                          <div className="dashboard-section-head">
                            <label>{language === 'en' ? 'City locations' : 'Seher daxili lokasiya secimi'} <span className="dashboard-count-pill">{newListing.locationTags.length}</span></label>
                            {newListing.locationTags.length > 0 && (
                              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('locationTags')}>
                                {language === 'en' ? 'Clear' : 'Temizle'}
                              </button>
                            )}
                          </div>
                          <div className="city-picker-form-header">
                            <select
                              value={newListing.city}
                              onChange={(e) => setNewListing({ ...newListing, city: e.target.value })}
                            >
                              <option value="Baku">Baku</option>
                              <option value="Sumqayit">Sumqayit</option>
                              <option value="Gabala">Gabala</option>
                              <option value="Quba">Quba</option>
                            </select>
                            <input
                              type="search"
                              placeholder={language === 'en' ? 'Search district, metro, landmark' : 'Rayon, metro, nisangah axtar'}
                              value={locationTagsSearch}
                              onChange={(e) => setLocationTagsSearch(e.target.value)}
                            />
                          </div>

                          <div className="city-tabs form-city-tabs">
                            {locationTabs.map((tab) => (
                              <button
                                type="button"
                                key={tab.key}
                                className={`city-tab ${newListing.locationCategory === tab.key ? 'active' : ''}`}
                                onClick={() => handleLocationCategoryChange(tab.key)}
                              >
                                {language === 'en' ? tab.en : tab.az}
                              </button>
                            ))}
                          </div>

                          <div className="city-option-list form-city-option-list">
                            {sortedLocationTagOptions.length > 0 ? sortedLocationTagOptions.map((option) => (
                              <label key={option.key} className="city-option-item">
                                <input
                                  type="checkbox"
                                  checked={newListing.locationTags.includes(option.key)}
                                  onChange={() => toggleStringField('locationTags', option.key)}
                                />
                                <span>{getLocalizedOptionLabel(option)}</span>
                              </label>
                            )) : (
                              <p className="dashboard-empty-options">{language === 'en' ? 'No locations found.' : 'Lokasiya tapilmadi.'}</p>
                            )}
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

      {busyListingId && (
        <div className="availability-modal-overlay" onClick={handleCloseBusyModal}>
          <div className="availability-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{language === 'en' ? 'Mark as occupied' : 'Məşğul tarixlərini seçin'}</h3>
            <p>
              {language === 'en'
                ? 'This listing will be hidden from homepage until selected end date.'
                : 'Bu elan seçdiyiniz bitmə tarixinə qədər ana səhifədə göstərilməyəcək.'}
            </p>

            <div className="availability-grid">
              <div className="form-group">
                <label>{language === 'en' ? 'From' : 'Başlama tarixi'}</label>
                <input type="date" value={busyFrom} onChange={(e) => setBusyFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{language === 'en' ? 'To' : 'Bitmə tarixi'}</label>
                <input type="date" value={busyTo} min={busyFrom || undefined} onChange={(e) => setBusyTo(e.target.value)} />
              </div>
            </div>

            <div className="availability-actions">
              <button type="button" className="btn btn-ghost" onClick={handleCloseBusyModal}>
                {t.form.cancel}
              </button>
              <button type="button" className="btn btn-accent" onClick={handleSetInactiveWithDates} disabled={isSavingAvailability}>
                {isSavingAvailability ? t.messages.loading : (language === 'en' ? 'Set non active' : 'Non active et')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
