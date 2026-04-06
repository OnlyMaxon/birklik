import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { FavoritesTab } from './FavoritesTab'
import { CityLocationPicker } from '../../components'
import { propertyTypes, amenitiesList, moreFilterOptions, nearFilterOptions } from '../../data'
import { isModeratorEmail } from '../../config/constants'
import { Language, PropertyType, District, Amenity, Property, ListingTier, LocationCategory } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner, updateProperty } from '../../services'
import './DashboardPage.css'

type TabType = 'listings' | 'add' | 'favorites' | 'profile'

interface DashboardPageProps {
  initialTab?: TabType
}

interface GeocodeResult {
  lat: string
  lon: string
}

const DEFAULT_COORDINATES = { lat: 40.4093, lng: 49.8671 }
const TEST_LISTING_MARKER = '[TEST_DATA]'
const getTodayISO = (): string => new Date().toISOString().split('T')[0]

const isOccupationExpired = (property: Property): boolean => {
  if (!property.unavailableTo) return false
  return property.unavailableTo < getTodayISO()
}

const isTestListing = (listing: Property): boolean => {
  const titleAz = listing.title?.az || ''
  const titleEn = listing.title?.en || ''
  const descriptionAz = listing.description?.az || ''
  const descriptionEn = listing.description?.en || ''

  return [titleAz, titleEn, descriptionAz, descriptionEn].some((value) =>
    value.includes(TEST_LISTING_MARKER)
  )
}

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

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

interface LocationPickerProps {
  coordinates: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
  onAddressReverse?: (address: string) => void
}

const LocationPicker: React.FC<LocationPickerProps> = ({ coordinates, onChange, onAddressReverse }) => {
  useMapEvents({
    click: (event) => {
      const newCoords = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      }
      onChange(newCoords)
      
      // Reverse geocode to get address
      if (onAddressReverse) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}&zoom=18&addressdetails=1`, {
          headers: {
            'Accept-Language': 'az,en;q=0.9'
          }
        })
          .then(res => res.json())
          .then(data => {
            let address = ''
            
            // Try multiple ways to extract address
            if (data.address) {
              // Prioritize: village -> suburb -> city_district -> county -> city
              address = data.address.village || 
                       data.address.suburb || 
                       data.address.city_district || 
                       data.address.county || 
                       data.address.city || 
                       data.address.town ||
                       data.display_name?.split(',')[0] || 
                       ''
            }
            
            // Only fill if it's in Azerbaijan
            if (data.address && (data.address.country === 'Azerbaijan' || data.address.country_code === 'az')) {
              if (address) {
                onAddressReverse(address)
              }
            }
          })
          .catch(() => {
            // Silently fail if reverse geocoding fails
          })
      }
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
  const { user, isAuthenticated, updateUserProfile } = useAuth()
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
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false)
  const [locationSearchError, setLocationSearchError] = React.useState('')
  const [busyListingId, setBusyListingId] = React.useState<string | null>(null)
  const [busyFrom, setBusyFrom] = React.useState('')
  const [busyTo, setBusyTo] = React.useState('')
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false)
  const [profileName, setProfileName] = React.useState('')
  const [profilePhone, setProfilePhone] = React.useState('')
  const [profileAvatar, setProfileAvatar] = React.useState('')
  const [profileAvatarFile, setProfileAvatarFile] = React.useState<File | null>(null)
  const [profileMessage, setProfileMessage] = React.useState('')
  const [profileError, setProfileError] = React.useState('')
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)

  const isTestAccount = isModeratorEmail(user?.email)
  const isEnglish = language === 'en'
  const isRussian = language === 'ru'
  const savedMessage = language === 'en'
    ? 'Listing saved successfully'
    : language === 'ru'
      ? 'Объявление успешно сохранено'
    : 'Elan uğurla yadda saxlanıldı'

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
      perks: [t.pricing_info.premium_features],
      emphasis: t.pricing.premiumDesc,
      highlighted: true
    }
  ]

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

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
    setHasTestData(normalizedListings.some(isTestListing))
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
    minGuests: '',
    maxGuests: '',
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

  const selectedFilePreviews = React.useMemo(
    () => selectedFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file)
    })),
    [selectedFiles]
  )

  React.useEffect(() => {
    return () => {
      selectedFilePreviews.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [selectedFilePreviews])

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
      minGuests: '',
      maxGuests: '',
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
      setLocationSearchError(language === 'en' ? 'Enter address for search.' : language === 'ru' ? 'Введите адрес для поиска.' : 'Axtarış üçün ünvan daxil edin.')
      return
    }

    setIsSearchingLocation(true)
    setLocationSearchError('')

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, Azerbaijan`)}`
      const response = await fetch(url, {
        headers: {
          'Accept-Language': language === 'en' ? 'en' : language === 'ru' ? 'ru' : 'az'
        }
      })

      if (!response.ok) {
        throw new Error('Geocoding request failed')
      }

      const results = (await response.json()) as GeocodeResult[]

      if (!results.length) {
        setLocationSearchError(language === 'en' ? 'Address not found. Try a more specific address.' : language === 'ru' ? 'Адрес не найден. Укажите более точный адрес.' : 'Ünvan tapılmadı. Daha dəqiq ünvan yazın.')
        return
      }

      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchError(language === 'en' ? 'Invalid coordinates received.' : language === 'ru' ? 'Получены некорректные координаты.' : 'Koordinatlar düzgün alınmadı.')
        return
      }

      setListingCoordinates({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      })
    } catch (searchError) {
      setLocationSearchError(language === 'en' ? 'Location search failed. Try again.' : language === 'ru' ? 'Поиск локации не удался. Попробуйте снова.' : 'Ünvan axtarışı uğursuz oldu. Yenidən cəhd edin.')
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
      setError(language === 'en' ? 'Maximum 4 images for Standard plan' : language === 'ru' ? 'Максимум 4 фото для тарифа Стандарт' : 'Standart paket üçün maksimum 4 şəkil yükləmək olar')
      setIsSubmitting(false)
      return
    }

    const descriptionWordCount = newListing.description.trim().split(/\s+/).filter(Boolean).length
    if (newListing.listingTier === 'free' && descriptionWordCount > 35) {
      setError(language === 'en' ? 'Maximum 35 words for Standard plan' : language === 'ru' ? 'Максимум 35 слов для тарифа Стандарт' : 'Standart paketdə təsvir maksimum 35 söz ola bilər')
      setIsSubmitting(false)
      return
    }

    if (newListing.listingTier !== 'free' && !newListing.address.trim()) {
      setError('Standart və Premium paketdə ünvan daxil edilməlidir')
      setIsSubmitting(false)
      return
    }

    const dailyPrice = Number(newListing.price)
    const rooms = Number(newListing.rooms)
    const minGuests = Number(newListing.minGuests)
    const maxGuests = Number(newListing.maxGuests)
    const area = Number(newListing.area || 0)
    const normalizedAddress = newListing.listingTier === 'free' ? 'Lokasiya gizlidir' : newListing.address
    const listingStatus = 'pending'

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
      minGuests,
      maxGuests,
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



  const getLocalizedOptionLabel = React.useCallback((option: { az: string; en: string } | string) => {
    if (typeof option === 'string') return option
    return language === 'en' ? option.en : option.az
  }, [language])

  const sortByOptionLabel = React.useCallback((a: { az: string; en: string } | string, b: { az: string; en: string } | string) => {
    const aLabel = typeof a === 'string' ? a : getLocalizedOptionLabel(a)
    const bLabel = typeof b === 'string' ? b : getLocalizedOptionLabel(b)
    return aLabel.localeCompare(bLabel, language === 'en' ? 'en' : 'az')
  }, [getLocalizedOptionLabel, language])

  const sortedMoreOptions = React.useMemo(() => [...moreFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const sortedNearOptions = React.useMemo(() => [...nearFilterOptions].sort(sortByOptionLabel), [sortByOptionLabel])
  const selectableAmenities = React.useMemo(() => amenitiesList.filter((amenity) => amenity !== 'beach'), [])
  const popularMoreOptions = sortedMoreOptions.filter((option) => quickMorePopular.includes(option.key))
  const popularNearOptions = sortedNearOptions.filter((option) => quickNearPopular.includes(option.key))

  const clearListingSection = (field: 'extraFeatures' | 'nearbyPlaces') => {
    setNewListing(prev => ({ ...prev, [field]: [] }))
  }

  const handleMinGuestsChange = (value: string) => {
    const newMin = Number(value)
    setNewListing(prev => {
      const currentMax = prev.maxGuests === '10+' ? 999 : Number(prev.maxGuests || 10)
      
      // If min is greater than max, update max to be equal to min
      if (newMin > currentMax) {
        return { ...prev, minGuests: value, maxGuests: value }
      }
      return { ...prev, minGuests: value }
    })
  }

  const handleMaxGuestsChange = (value: string) => {
    const newMax = value === '10+' ? 999 : Number(value)
    setNewListing(prev => {
      const currentMin = Number(prev.minGuests || 1)
      
      // If max is less than min, update min to be equal to max
      if (newMax < currentMin) {
        return { ...prev, maxGuests: value, minGuests: value === '10+' ? '10' : value }
      }
      return { ...prev, maxGuests: value }
    })
  }

  React.useEffect(() => {
    if (!user) return
    setProfileName(user.name)
    setProfilePhone(user.phone)
    setProfileAvatar(user.avatar || '')
    setProfileAvatarFile(null)
  }, [user])

  const handleProfilePhotoChange = (file: File | null) => {
    if (!file) return
    setProfileAvatarFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileAvatar(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!profileName.trim()) {
      setProfileError(language === 'en' ? 'Full name is required.' : language === 'ru' ? 'Требуются имя и фамилия.' : 'Ad və soyad tələb olunur.')
      setProfileMessage('')
      return
    }

    setIsSavingProfile(true)
    setProfileError('')
    setProfileMessage('')

    const result = await updateUserProfile({
      name: profileName.trim(),
      phone: profilePhone.trim(),
      avatar: profileAvatar || undefined,
      avatarFile: profileAvatarFile
    })

    if (!result.success) {
      setProfileError(language === 'en' ? 'Failed to update profile.' : language === 'ru' ? 'Не удалось обновить профиль.' : 'Profil yenilənmədi.')
      setIsSavingProfile(false)
      return
    }

    setProfileMessage(language === 'en' ? 'Profile updated successfully.' : language === 'ru' ? 'Профиль успешно обновлен.' : 'Profil uğurla yeniləndi.')
    setProfileAvatarFile(null)
    setIsSavingProfile(false)
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
      setError(language === 'en' ? 'Select both start and end dates.' : language === 'ru' ? 'Выберите даты начала и конца.' : 'Başlama və bitmə tarixlərini seçin.')
      return
    }

    if (busyFrom > busyTo) {
      setError(language === 'en' ? 'Start date must be before end date.' : language === 'ru' ? 'Дата начала должна быть раньше даты окончания.' : 'Başlama tarixi bitmə tarixindən böyük ola bilməz.')
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
      minGuests: String(property.minGuests || ''),
      maxGuests: String(property.maxGuests || ''),
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

  const testListings = React.useMemo(() => {
    const templates = [
      {
        type: 'villa' as PropertyType,
        district: 'mardakan' as District,
        city: 'Baku',
        locationCategory: 'metro' as LocationCategory,
        locationTags: ['koroglu', 'sahil'],
        amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'bbq'] as Amenity[],
        extraFeatures: ['pool', 'ac', 'sauna', 'gazebo', 'bbq', 'wifi'],
        nearbyPlaces: ['sea', 'park', 'restaurant'],
        image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200',
        basePrice: 320,
        baseRooms: 5,
        baseMinGuests: 2,
        baseMaxGuests: 10,
        baseArea: 320,
        titleAz: 'Lüks villa',
        titleEn: 'Luxury villa',
        areaAz: 'Mərdəkan',
        areaEn: 'Mardakan',
        tier: 'premium' as ListingTier
      },
      {
        type: 'apartment' as PropertyType,
        district: 'bilgah' as District,
        city: 'Baku',
        locationCategory: 'rayon' as LocationCategory,
        locationTags: ['denizkenari', 'whiteCity'],
        amenities: ['wifi', 'ac', 'kitchen', 'tv', 'parking', 'beach'] as Amenity[],
        extraFeatures: ['ac', 'wifi', 'garage', 'boardGames'],
        nearbyPlaces: ['sea', 'restaurant', 'park'],
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
        basePrice: 130,
        baseRooms: 3,
        baseMinGuests: 1,
        baseMaxGuests: 4,
        baseArea: 95,
        titleAz: 'Dəniz mənzərəli mənzil',
        titleEn: 'Sea view apartment',
        areaAz: 'Bilgəh',
        areaEn: 'Bilgah',
        tier: 'standard' as ListingTier
      },
      {
        type: 'cottage' as PropertyType,
        district: 'gabala' as District,
        city: 'Gabala',
        locationCategory: 'rayon' as LocationCategory,
        locationTags: ['xirdalan'],
        amenities: ['wifi', 'ac', 'kitchen', 'garden', 'bbq'] as Amenity[],
        extraFeatures: ['wifi', 'bbq', 'samovar', 'kidsZone'],
        nearbyPlaces: ['mountains', 'forest', 'riverLake'],
        image: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200',
        basePrice: 180,
        baseRooms: 4,
        baseMinGuests: 2,
        baseMaxGuests: 6,
        baseArea: 160,
        titleAz: 'Qəbələ bağ evi',
        titleEn: 'Gabala cottage',
        areaAz: 'Qəbələ',
        areaEn: 'Gabala',
        tier: 'standard' as ListingTier
      },
      {
        type: 'house' as PropertyType,
        district: 'novkhani' as District,
        city: 'Baku',
        locationCategory: 'rayon' as LocationCategory,
        locationTags: ['memarEcemi'],
        amenities: ['parking', 'wifi', 'kitchen', 'garden', 'bbq'] as Amenity[],
        extraFeatures: ['garage', 'gazebo', 'bbq', 'wifi'],
        nearbyPlaces: ['sea', 'park'],
        image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200',
        basePrice: 210,
        baseRooms: 4,
        baseMinGuests: 1,
        baseMaxGuests: 6,
        baseArea: 210,
        titleAz: 'Novxanı istirahət evi',
        titleEn: 'Novkhani holiday house',
        areaAz: 'Novxanı',
        areaEn: 'Novkhani',
        tier: 'free' as ListingTier
      },
      {
        type: 'penthouse' as PropertyType,
        district: 'baku' as District,
        city: 'Baku',
        locationCategory: 'rayon' as LocationCategory,
        locationTags: ['portBaku'],
        amenities: ['parking', 'wifi', 'ac', 'kitchen', 'tv', 'security'] as Amenity[],
        extraFeatures: ['ac', 'wifi', 'cityView', 'security'],
        nearbyPlaces: ['restaurant', 'mall', 'park'],
        image: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=1200',
        basePrice: 260,
        baseRooms: 3,
        baseMinGuests: 1,
        baseMaxGuests: 4,
        baseArea: 140,
        titleAz: 'Şəhər mərkəzində penthaus',
        titleEn: 'City center penthouse',
        areaAz: 'Bakı',
        areaEn: 'Baku',
        tier: 'premium' as ListingTier
      }
    ]

    return Array.from({ length: 30 }, (_, index) => {
      const template = templates[index % templates.length]
      const serial = index + 1
      const daily = template.basePrice + (index % 5) * 15
      const rooms = template.baseRooms + (index % 2)
      const minGuests = template.baseMinGuests
      const maxGuests = Math.min(10, template.baseMaxGuests + (index % 3))
      const area = template.baseArea + (index % 4) * 12

      return {
        title: {
          az: `${TEST_LISTING_MARKER} ${template.titleAz} #${serial}`,
          en: `${TEST_LISTING_MARKER} ${template.titleEn} #${serial}`
        },
        description: {
          az: `${TEST_LISTING_MARKER} Bu test elanıdır. Platform funksiyalarını yoxlamaq üçün yaradılıb.`,
          en: `${TEST_LISTING_MARKER} Test listing created for platform verification workflows.`
        },
        type: template.type,
        district: template.district,
        address: {
          az: `${template.areaAz}, Test küç. ${serial}`,
          en: `${template.areaEn}, Test street ${serial}`
        },
        price: {
          daily,
          weekly: daily * 6,
          monthly: daily * 24,
          currency: 'AZN'
        },
        rooms,
        minGuests,
        maxGuests,
        area,
        amenities: template.amenities,
        extraFeatures: template.extraFeatures,
        nearbyPlaces: template.nearbyPlaces,
        locationCategory: template.locationCategory,
        locationTags: template.locationTags,
        images: [template.image],
        coordinates: {
          lat: Number((40.36 + (index % 10) * 0.02).toFixed(6)),
          lng: Number((49.78 + (index % 10) * 0.03).toFixed(6))
        },
        listingTier: template.tier,
        status: 'active' as const,
        isFeatured: template.tier === 'premium',
        isActive: true,
        city: template.city
      }
    })
  }, [])

  const handleAddTestData = async () => {
    if (!user) return

    setIsAddingTestData(true)
    setError('')

    try {
      const existingTestListings = listings.filter((listing) => listing.ownerId === user.id && isTestListing(listing))

      for (const listing of existingTestListings) {
        await deleteProperty(listing.id)
      }

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
      const listingsToDelete = listings.filter(l => l.ownerId === user.id && isTestListing(l))

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
                  className={`nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
                  onClick={() => setActiveTab('favorites')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {language === 'en' ? 'Favorites' : language === 'ru' ? 'Избранные' : 'Sevimlilər'}
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
                {isTestAccount && (
                  <button
                    className="nav-item"
                    onClick={() => navigate('/dashboard/review')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4"/>
                      <path d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/>
                    </svg>
                    {language === 'en' ? 'Moderation' : language === 'ru' ? 'Модерация' : 'Moderasiya'}
                  </button>
                )}
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
                        const status = property.status || 'active'
                        const isCurrentlyActive = property.isActive !== false || isOccupationExpired(property)
                        const isPendingModeration = status === 'pending'
                        const statusLabel = isPendingModeration
                          ? (isEnglish ? 'Pending moderation' : isRussian ? 'На модерации' : 'Moderasiyada gözləyir')
                          : (isCurrentlyActive ? (isEnglish ? 'Active' : isRussian ? 'Активно' : 'Aktiv') : (isEnglish ? 'Temporarily hidden' : isRussian ? 'Временно скрыто' : 'Müvəqqəti gizli'))

                        return (
                          <div key={property.id} className="listing-item card">
                            <img 
                              src={property.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} 
                              alt={getLocalizedText(property.title)}
                              className="listing-image"
                            />
                            <div className="listing-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                                <Link to={`/property/${property.id}`} className="listing-title">
                                  {getLocalizedText(property.title)}
                                </Link>
                                <span className={`badge ${isPendingModeration ? 'badge-warning' : isCurrentlyActive ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', whiteSpace: 'normal', flexShrink: 1, maxWidth: '100%' }}>
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="listing-location">
                                {t.districts[property.district]}
                              </p>
                              <p className="listing-price">
                                {property.price.daily} {property.price.currency} / {t.property.perNight}
                              </p>
                              {!isPendingModeration && !isCurrentlyActive && property.unavailableFrom && property.unavailableTo && (
                                <p style={{ fontSize: '0.84rem', color: '#8b5a10', marginTop: '0.15rem' }}>
                                  <strong>{isEnglish ? 'Dates:' : isRussian ? 'Даты:' : 'Tarix:'}</strong> {property.unavailableFrom} - {property.unavailableTo}
                                </p>
                              )}
                              {!isPendingModeration && !isCurrentlyActive && property.unavailableTo && (
                                <p style={{ fontSize: '0.82rem', color: '#4a6288', marginTop: '0.12rem' }}>
                                  {isEnglish ? 'Click "Activate" to make it active again.' : isRussian ? 'Нажмите "Активировать" чтобы активировать снова.' : 'Yenidən aktiv etmək üçün "Aktiv et" düyməsini sıxın.'}
                                </p>
                              )}
                            </div>
                            <div className="listing-actions">
                              <div className="action-buttons">
                                {isPendingModeration ? null : isCurrentlyActive ? (
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleOpenBusyModal(property)}>
                                    {isEnglish ? 'Hide' : isRussian ? 'Скрыть' : 'Qeyri-aktiv et'}
                                  </button>
                                ) : (
                                  <button className="btn btn-accent btn-sm" onClick={() => handleSetActive(property.id)}>
                                    {isEnglish ? 'Activate' : isRussian ? 'Активировать' : 'Aktiv et'}
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

                        <CityLocationPicker
                          city={newListing.city}
                          locationTags={newListing.locationTags}
                          locationCategory={newListing.locationCategory}
                          onCityChange={(city) => setNewListing({...newListing, city, locationTags: []})}
                          onLocationTagsChange={(tags) => setNewListing({...newListing, locationTags: tags})}
                          onLocationCategoryChange={(category) => setNewListing({...newListing, locationCategory: category, locationTags: []})}
                        />

                        <div className="form-group full-width">
                          <label>{t.form.address} {newListing.listingTier === 'free' ? '' : '*'}</label>
                          <input
                            type="text"
                            value={newListing.address}
                            onChange={(e) => setNewListing({...newListing, address: e.target.value})}
                            required={newListing.listingTier !== 'free'}
                            placeholder={newListing.listingTier === 'free' ? (language === 'en' ? 'Location is hidden for Standard plan' : language === 'ru' ? 'Локация скрыта для тарифа Стандарт' : 'Standart paketdə lokasiya gizlədilir') : ''}
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>Xəritədə nöqtə *</label>
                          <p className="location-hint">Xəritədə klik edin və ya ünvanla axtarın.</p>
                          <div className="location-search-row">
                            <input
                              type="text"
                              value={locationSearch}
                              onChange={(e) => setLocationSearch(e.target.value)}
                              placeholder={language === 'en' ? 'Search address (e.g. Mardakan, Baku)' : language === 'ru' ? 'Поиск адреса (напр.: Mardakan, Baku)' : 'Ünvan axtarın (məs: Mərdəkan, Bakı)'}
                            />
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={handleSearchLocation}
                              disabled={isSearchingLocation}
                            >
                              {isSearchingLocation ? t.messages.loading : (language === 'en' ? 'Find on map' : language === 'ru' ? 'Найти на карте' : 'Xəritədə tap')}
                            </button>
                          </div>
                          {locationSearchError && <p className="location-search-error">{locationSearchError}</p>}
                          <div className="listing-location-picker">
                            <MapContainer
                              center={[listingCoordinates.lat, listingCoordinates.lng]}
                              zoom={13}
                              scrollWheelZoom={true}
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
                                onAddressReverse={(address) => setNewListing({...newListing, address})}
                              />
                            </MapContainer>
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
                            {selectableAmenities.map(amenity => (
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
                            <label>{language === 'en' ? 'More' : language === 'ru' ? 'Дополнительно' : 'Əlavə'} <span className="dashboard-count-pill">{newListing.extraFeatures.length}</span></label>
                            {newListing.extraFeatures.length > 0 && (
                              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('extraFeatures')}>
                                {language === 'en' ? 'Clear' : language === 'ru' ? 'Очистить' : 'Təmizlə'}
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
                            <label>{language === 'en' ? 'Near' : language === 'ru' ? 'Рядом' : 'Yaxında'} <span className="dashboard-count-pill">{newListing.nearbyPlaces.length}</span></label>
                            {newListing.nearbyPlaces.length > 0 && (
                              <button type="button" className="dashboard-section-clear" onClick={() => clearListingSection('nearbyPlaces')}>
                                {language === 'en' ? 'Clear' : language === 'ru' ? 'Очистить' : 'Təmizlə'}
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

                        <div className="form-group full-width">
                          <label>{t.form.photos}</label>
                          <div className="file-upload">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                            />
                            <p>{newListing.listingTier === 'free' ? (language === 'ru' ? 'Максимум 4 фото (тариф Стандарт)' : language === 'en' ? 'Maximum 4 photos (Standard plan)' : 'Maksimum 4 şəkil (Standart paket)') : (language === 'en' ? 'Drag & drop or click to upload' : language === 'ru' ? 'Перетащите файлы или нажмите для загрузки' : 'Yükləmək üçün faylları sürüşdürün və ya klik edin')}</p>
                            {selectedFiles.length > 0 && <p>{selectedFiles.length} {language === 'en' ? 'file(s) selected' : language === 'ru' ? 'файл(ов) выбрано' : 'fayl seçildi'}</p>}
                          </div>
                          {selectedFilePreviews.length > 0 && (
                            <div className="upload-preview-grid">
                              {selectedFilePreviews.map((preview) => (
                                <div key={preview.url} className="upload-preview-item">
                                  <img src={preview.url} alt={preview.name} />
                                  <span>{preview.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="form-group full-width" style={{ backgroundColor: 'rgba(183, 146, 93, 0.14)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #b7925d' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#5e4830', lineHeight: '1.5' }}>
                            <strong>{isEnglish ? 'Note:' : isRussian ? 'Примечание:' : 'Qeyd:'}</strong>{' '}
                            {isEnglish
                              ? 'All listings, including Free plan, are sent to moderation and published after approval.'
                              : language === 'ru'
                                ? 'Все объявления, включая бесплатный тариф, отправляются на модерацию и публикуются после одобрения.'
                                : 'Bütün elanlar, o cümlədən pulsuz paket, moderasiyaya göndərilir və təsdiqdən sonra yayımlanır.'}
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

              {/* Favorites Tab */}
              {activeTab === 'favorites' && <FavoritesTab />}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.profile}</h2>
                  
                  <div className="profile-card card">
                    <div className="profile-header">
                      <img src={profileAvatar || user.avatar} alt={user.name} className="profile-avatar" />
                      <div>
                        <h3>{profileName || user.name}</h3>
                        <p>{user.email}</p>
                      </div>
                    </div>

                    {profileError && <div className="error-message">{profileError}</div>}
                    {profileMessage && <div className="success-inline-message">{profileMessage}</div>}

                    <form className="profile-form" onSubmit={handleSaveProfile}>
                      <div className="form-group">
                        <label>{language === 'en' ? 'Profile Photo' : language === 'ru' ? 'Фото профиля' : 'Profil şəkli'}</label>
                        <div className="profile-photo-upload-row">
                          <label className="btn btn-ghost btn-sm profile-photo-btn">
                            {language === 'en' ? 'Choose photo' : language === 'ru' ? 'Выбрать фото' : 'Şəkil seç'}
                            <input
                              type="file"
                              accept="image/*"
                              className="profile-photo-input"
                              onChange={(e) => handleProfilePhotoChange(e.target.files?.[0] || null)}
                            />
                          </label>
                          {profileAvatar && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setProfileAvatar('')
                                setProfileAvatarFile(null)
                              }}
                            >
                              {language === 'en' ? 'Remove' : language === 'ru' ? 'Удалить' : 'Sil'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>{t.auth.fullName}</label>
                        <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.email}</label>
                        <input type="email" defaultValue={user.email} disabled />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.phone}</label>
                        <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                      </div>
                      <button type="submit" className="btn btn-accent" disabled={isSavingProfile}>
                        {isSavingProfile ? t.messages.loading : t.form.submit}
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
                            disabled={isAddingTestData}
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
                  <h3>{language === 'en' ? 'Set as inactive' : language === 'ru' ? 'Отметить как неактивное' : 'Qeyri-aktiv et'}</h3>
            <p>
              {language === 'en'
                ? 'This listing will be marked as inactive until the selected end date.'
                : language === 'ru' ? 'Это объявление будет неактивным до выбранной даты окончания.'
                : 'Bu elan seçdiyiniz bitmə tarixinə qədər qeyri-aktiv olacaq.'}
            </p>

            <div className="availability-grid">
              <div className="form-group">
                      <label>{language === 'en' ? 'Start date' : language === 'ru' ? 'Дата начала' : 'Başlama tarixi'}</label>
                <input type="date" value={busyFrom} onChange={(e) => setBusyFrom(e.target.value)} />
              </div>
              <div className="form-group">
                      <label>{language === 'en' ? 'End date' : language === 'ru' ? 'Дата окончания' : 'Bitmə tarixi'}</label>
                <input type="date" value={busyTo} min={busyFrom || undefined} onChange={(e) => setBusyTo(e.target.value)} />
              </div>
            </div>

            <div className="availability-actions">
              <button type="button" className="btn btn-ghost" onClick={handleCloseBusyModal}>
                {t.form.cancel}
              </button>
              <button type="button" className="btn btn-accent" onClick={handleSetInactiveWithDates} disabled={isSavingAvailability}>
                        {isSavingAvailability ? t.messages.loading : (language === 'en' ? 'Set non active' : language === 'ru' ? 'Сделать неактивным' : 'Qeyri-aktiv et')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
