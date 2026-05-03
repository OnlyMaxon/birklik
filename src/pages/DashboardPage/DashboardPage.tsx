import React from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { FavoritesTab } from './FavoritesTab'
import { BookingsTab } from './BookingsTab'
import { NotificationsTab } from '../../components/NotificationsTab'
import { CityLocationPicker } from '../../components'
import { LocationPicker, MapCenterUpdater, DEFAULT_COORDINATES } from './LocationPicker'
import { propertyTypes, amenitiesList, moreFilterOptions, nearFilterOptions } from '../../data'
import { isModerator } from '../../config/constants'
import { Language, PropertyType, District, Amenity, Property, ListingTier, LocationCategory } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner, updateProperty, createPremiumNotification } from '../../services'
import './DashboardPage.css'
import * as logger from '../../services/logger'

type TabType = 'listings' | 'add' | 'favorites' | 'bookings' | 'notifications' | 'profile'

interface DashboardPageProps {
  initialTab?: TabType
}

interface GeocodeResult {
  lat: string
  lon: string
}
const TEST_LISTING_MARKER = '[TEST_DATA]'
const getTodayISO = (): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

const isPremiumExpired = (property: Property): boolean => {
  if (!property.premiumExpiresAt || property.listingTier !== 'premium') return false
  const today = getTodayISO()
  return property.premiumExpiresAt < today
}

const isPremiumActive = (property: Property): boolean => {
  if (!property.premiumExpiresAt || property.listingTier !== 'premium') return false
  const today = getTodayISO()
  return property.premiumExpiresAt >= today
}

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

export const DashboardPage: React.FC<DashboardPageProps> = ({ initialTab = 'listings' }) => {
  const { language, t } = useLanguage()
  const { user, isAuthenticated, firebaseUser, updateUserProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = React.useState<TabType>(tabParam || initialTab)
  const [showAddSuccess, setShowAddSuccess] = React.useState(false)
  const [listings, setListings] = React.useState<Property[]>([])
  const [isLoadingListings, setIsLoadingListings] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isTestAccount, setIsTestAccount] = React.useState(false)
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


  // Check if user is moderator
  React.useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsTestAccount(isModerator(token))
      }
    }
    checkModerator()
  }, [firebaseUser])
  const isEnglish = language === 'en'
  const isRussian = language === 'ru'
  const savedMessage = language === 'en'
    ? 'Listing saved successfully'
    : language === 'ru'
      ? 'Объявление успешно сохранено'
    : 'Elan uğurla yadda saxlanıldı'

  const listingPlans = [
    {
      id: 'standard' as ListingTier,
      title: t.pricing.standard,
      isFree: true,
      price: t.pricing.free,
      features: [t.pricing_info.standard_features],
      emphasis: t.pricing.standardDesc,
      ribbon: '🎁 ' + t.pricing.free // Ribbon for Free
    },
    {
      id: 'vip' as ListingTier,
      title: t.pricing.vip,
      isFree: false,
      features: [t.pricing_info.vip_features, t.pricing.vipFeatures, t.pricing.vipDisplays],
      emphasis: t.pricing.vipDesc,
      pricingOptions: [
        { duration: '14days', label: t.pricing.days14, price: '20 AZN' },
        { duration: '30days', label: t.pricing.days30, price: '30 AZN' }
      ],
      showPricingDropdown: true
    },
    {
      id: 'premium' as ListingTier,
      title: t.pricing.premium,
      isFree: false,
      features: [t.pricing_info.premium_features, t.pricing.premiumFeatures, t.pricing.premiumDisplays],
      emphasis: t.pricing.premiumDesc,
      pricingOptions: [
        { duration: '14days', label: t.pricing.days14, price: '30 AZN' },
        { duration: '30days', label: t.pricing.days30, price: '55 AZN' }
      ],
      showPricingDropdown: true,
      highlighted: true // Premium is highlighted
    }
  ]

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Sync activeTab with URL search params
  React.useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

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
    listingTier: 'standard' as ListingTier,
    tierPlanDuration: '30days' as '14days' | '30days', // VIP/Premium duration
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
    city: '',
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
      listingTier: 'standard',
      tierPlanDuration: '30days',
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

  const handleDeletePhoto = React.useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleMovePhotoUp = React.useCallback((index: number) => {
    if (index > 0) {
      setSelectedFiles(prev => {
        const newFiles = [...prev]
        const temp = newFiles[index - 1]
        newFiles[index - 1] = newFiles[index]
        newFiles[index] = temp
        return newFiles
      })
    }
  }, [])

  const handleMovePhotoDown = React.useCallback((index: number) => {
    setSelectedFiles(prev => {
      if (index < prev.length - 1) {
        const newFiles = [...prev]
        const temp = newFiles[index]
        newFiles[index] = newFiles[index + 1]
        newFiles[index + 1] = temp
        return newFiles
      }
      return prev
    })
  }, [])

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
      setLocationSearchError(t.dashboard.enterAddressForSearch)
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
        setLocationSearchError(t.dashboard.addressNotFound)
        return
      }

      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchError(t.errors.invalidCoordinates)
        return
      }

      setListingCoordinates({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      })
    } catch (searchError) {
      setLocationSearchError(t.dashboard.locationSearchFailed)
    } finally {
      setIsSearchingLocation(false)
    }
  }

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)
    setError('')

    // Check if user is authenticated
    if (!user) {
      setError(language === 'en' ? 'Please sign in to add a listing' : language === 'ru' ? 'Пожалуйста, войдите чтобы добавить объявление' : 'Elan əlavə etmək üçün giriş yapın')
      setIsSubmitting(false)
      return
    }

    // Validate title
    if (!newListing.title.trim()) {
      setError(t.listing.createTitle)
      setIsSubmitting(false)
      return
    }

    // Validate type
    if (!newListing.type) {
      setError(t.listing.selectType)
      setIsSubmitting(false)
      return
    }



    // Validate city
    if (!newListing.city) {
      setError(t.listing.selectCity)
      setIsSubmitting(false)
      return
    }

    // Validate city selection (required)
    if (!newListing.city) {
      setError(t.listing.selectCity)
      setIsSubmitting(false)
      return
    }

    // Validate price
    if (!newListing.price || Number(newListing.price) <= 0) {
      setError(t.listing.enterPrice)
      setIsSubmitting(false)
      return
    }

    // Validate rooms
    if (!newListing.rooms || Number(newListing.rooms) <= 0) {
      setError(t.listing.enterRooms)
      setIsSubmitting(false)
      return
    }

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

    if ((newListing.listingTier === 'standard' || newListing.listingTier === 'vip') && selectedFiles.length > 20) {
      setError(t.listing.maxImagesStandard)
      setIsSubmitting(false)
      return
    }

    if (newListing.listingTier === 'premium' && selectedFiles.length > 30) {
      setError(t.listing.maxImagesPremium)
      setIsSubmitting(false)
      return
    }

    if (selectedFiles.length < 2) {
      setError(t.listing.minPhotos)
      setIsSubmitting(false)
      return
    }

    const descriptionWordCount = newListing.description.trim().split(/\s+/).filter(Boolean).length
    if (newListing.listingTier === 'standard' && descriptionWordCount > 35) {
      setError(t.listing.maxWordsStandard)
      setIsSubmitting(false)
      return
    }

    if (!newListing.address.trim()) {
      setError('Ünvan daxil edilməlidir')
      setIsSubmitting(false)
      return
    }

    // Validate coordinates are set
    if (!listingCoordinates.lat || !listingCoordinates.lng) {
      setError(t.listing.setLocationMap)
      setIsSubmitting(false)
      return
    }

    const dailyPrice = Number(newListing.price)
    const rooms = Number(newListing.rooms)
    const minGuests = Number(newListing.minGuests)
    const maxGuests = Number(newListing.maxGuests)
    const area = Number(newListing.area || 0)
    const normalizedAddress = newListing.address
    const listingStatus = 'pending'

    // Use first location tag as district
    const selectedDistrict = (newListing.locationTags && newListing.locationTags.length > 0) 
      ? (newListing.locationTags[0] as District)
      : 'baku' // Default fallback

    const propertyPayload: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
      type: newListing.type,
      district: selectedDistrict,
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
      city: newListing.city || 'Baku',
      views: 0,
      likes: [],
      favorites: [],
      comments: [],
      premiumExpiresAt: newListing.listingTier === 'premium' ? new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined
    }

    if (editingListingId) {
      const updated = await updateProperty(editingListingId, propertyPayload, selectedFiles)
      if (!updated) {
        setError(t.listing.updateFailed)
        setIsSubmitting(false)
        return
      }
    } else {
      const created = await createProperty(propertyPayload, selectedFiles)
      if (!created) {
        setError(t.listing.createdFailed)
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



  const getLocalizedOptionLabel = React.useCallback((option: { key: string } | string) => {
    if (typeof option === 'string') return option
    if (!t || !t.amenities) return option.key
    return (t.amenities as Record<string, string>)[option.key] || option.key
  }, [t])

  const sortByOptionLabel = React.useCallback((a: { key: string } | string, b: { key: string } | string) => {
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
      setProfileError(t.dashboard.fullNameRequired)
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
      setProfileError(t.dashboard.profileUpdateFailed)
      setIsSavingProfile(false)
      return
    }

    setProfileMessage(t.dashboard.profileUpdated)
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

  const handleExtendPremium = async (propertyId: string) => {
    const newExpiryDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      const property = listings.find((p: Property) => p.id === propertyId)
      if (!property) return
      
      await updateProperty(propertyId, { premiumExpiresAt: newExpiryDate })
      
      // Send notification to user about premium extension
      const getLocalizedTitle = (titleObj: unknown): string => {
        const title = titleObj as Record<string, unknown> || {}
        if (!title) return 'Your property'
        if (language === 'en') return (title.en as string) || (title.az as string) || (title.ru as string) || 'Your property'
        if (language === 'ru') return (title.ru as string) || (title.az as string) || (title.en as string) || 'Your property'
        return (title.az as string) || (title.en as string) || (title.ru as string) || 'Your property'
      }
      
      if (user?.id) {
        await createPremiumNotification(user.id, {
          userId: user.id,
          type: 'premium',
          title: language === 'en' ? 'Premium Extended' : language === 'ru' ? 'Премиум продлен' : 'Premium Uzadılmışdır',
          message: language === 'en' 
            ? `Your premium listing "${getLocalizedTitle(property.title)}" is now active until ${newExpiryDate}`
            : language === 'ru'
            ? `Ваше премиум объявление "${getLocalizedTitle(property.title)}" теперь активно до ${newExpiryDate}`
            : `Sizin premium elanı "${getLocalizedTitle(property.title)}" ${newExpiryDate} tarixinə qədər aktiv`,
          read: false,
          propertyId: propertyId,
          propertyTitle: getLocalizedTitle(property.title),
          action: 'expired'
        })
      }
      
      await loadListings()
      alert(t.errors.premiumExtendedSuccess)
    } catch (error) {
      logger.error('Error extending premium:', error)
      alert(t.dashboard.failedToExtendPremium)
    }
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
      setError(t.dashboard.selectBothDates)
      return
    }

    if (busyFrom > busyTo) {
      setError(t.dashboard.startBeforeEnd)
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
      listingTier: property.listingTier || 'standard',
      tierPlanDuration: property.tierPlanDuration || '30days',
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
          ownerId: user.id,
          views: 0,
          likes: [],
          favorites: [],
          comments: [],
          premiumExpiresAt: testListing.listingTier === 'premium' ? new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined
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
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t.dashboard.favorites}
                </button>
                <button
                  className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bookings')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
                  </svg>
                 {t.dashboard.bookings}
                </button>
                <button
                  className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {t.dashboard.notifications}
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
                    {t.dashboard.moderation}
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
                              {(property.views !== undefined && property.views > 0) && (
                                <p style={{ fontSize: '0.80rem', color: '#7a6b5d', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                  <span><strong>{property.views}</strong> {isEnglish ? 'views' : isRussian ? 'просмотров' : 'baxış'}</span>
                                </p>
                              )}
                              {property.unavailableFrom && property.unavailableTo && (
                                <p style={{ fontSize: '0.84rem', color: '#8b5a10', marginTop: '0.15rem' }}>
                                  <strong>{isEnglish ? 'Dates:' : isRussian ? 'Даты:' : 'Tarix:'}</strong> {property.unavailableFrom} - {property.unavailableTo}
                                </p>
                              )}
                              {property.listingTier === 'premium' && isPremiumExpired(property) && (
                                <p style={{ fontSize: '0.82rem', color: '#c62828', marginTop: '0.12rem', fontWeight: 'bold' }}>
                                  ⏰ {isEnglish ? 'Premium status expired. Click "Extend" below to revive!' : isRussian ? 'Премиум истек. Нажмите "Продлить" ниже!' : 'Premium sürəsi bitdi. Aşağıda "Uzat"a klik edin!'}
                                </p>
                              )}
                              {property.listingTier === 'premium' && isPremiumActive(property) && (
                                <p style={{ fontSize: '0.82rem', color: '#ffa500', marginTop: '0.12rem' }}>
                                  ⭐ {isEnglish ? `Premium active until ${property.premiumExpiresAt}` : isRussian ? `Премиум активен до ${property.premiumExpiresAt}` : `Premium ${property.premiumExpiresAt} tarixinə qədər aktiv`}
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
                                {property.listingTier === 'premium' && isPremiumExpired(property) && (
                                  <button className="btn btn-primary btn-sm" onClick={() => handleExtendPremium(property.id)}>
                                    ⭐ {isEnglish ? 'Extend' : isRussian ? 'Продлить' : 'Uzat'}
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
                    <form onSubmit={handleAddListing} className="add-listing-form card">
                      <div className="listing-plans-header">
                        <h3>
                          {t.home.plansTitle}
                          {newListing.listingTier ? (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.9em', color: '#28a745', fontWeight: 'normal' }}>
                              ✓ {newListing.listingTier === 'standard' ? t.pricing.standard : newListing.listingTier === 'vip' ? t.pricing.vip : t.pricing.premium}
                            </span>
                          ) : (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.9em', color: '#dc3545', fontWeight: 'bold' }}>
                              ({t.form.required})
                            </span>
                          )}
                        </h3>
                        <p>{t.home.plansSubtitle}</p>
                      </div>

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
                          onCityChange={(city) => setNewListing(prev => ({...prev, city, locationTags: []}))}
                          onLocationTagsChange={(tags) => setNewListing(prev => ({...prev, locationTags: tags}))}
                          onLocationCategoryChange={(category) => setNewListing(prev => ({...prev, locationCategory: category}))}
                        />

                        <div className="form-group full-width">
                          <label>{t.form.address} *</label>
                          <input
                            type="text"
                            value={newListing.address}
                            onChange={(e) => setNewListing({...newListing, address: e.target.value})}
                            required={true}
                            placeholder=""
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
                              placeholder={t.dashboard.searchAddressPlaceholder}
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
                                <span>{t?.amenities?.[amenity] || amenity}</span>
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
                            <p>
                              {newListing.listingTier === 'standard' || newListing.listingTier === 'vip' ? (
                                language === 'en' ? 'Maximum 20 photos' : language === 'ru' ? 'Максимум 20 фото' : 'Maksimum 20 şəkil'
                              ) : newListing.listingTier === 'premium' ? (
                                language === 'en' ? 'Maximum 30 photos' : language === 'ru' ? 'Максимум 30 фото' : 'Maksimum 30 şəkil'
                              ) : (
                                language === 'en' ? 'Select a plan first' : language === 'ru' ? 'Сначала выберите тариф' : 'Əvvəlcə paket seçin'
                              )}
                            </p>
                            {selectedFiles.length > 0 && <p>{selectedFiles.length} {language === 'en' ? 'file(s) selected' : language === 'ru' ? 'файл(ов) выбрано' : 'fayl seçildi'}</p>}
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

                      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

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

              {/* Bookings Tab */}
              {activeTab === 'bookings' && <BookingsTab />}



              {/* Notifications Tab */}
              {activeTab === 'notifications' && <NotificationsTab />}

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
