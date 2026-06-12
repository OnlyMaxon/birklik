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
import { propertyTypes, amenitiesList, moreFilterOptions, nearFilterOptions, cities } from '../../data'
import { resolveCity } from '../../data/cityAliases'
import { isModerator } from '../../config/constants'
import { Language, PropertyType, District, Amenity, Property, ListingTier, ListingStatus, LocationCategory } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner, updateProperty, createPremiumNotification } from '../../services'
import { getFunctions, httpsCallable } from 'firebase/functions'
import firebaseApp from '../../config/firebase'
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
  const [paymentNotification, setPaymentNotification] = React.useState<'success' | 'failed' | 'error' | null>(null)
  const [listings, setListings] = React.useState<Property[]>([])
  const [isLoadingListings, setIsLoadingListings] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isTestAccount, setIsTestAccount] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [existingImages, setExistingImages] = React.useState<string[]>([])
  const [editingListingId, setEditingListingId] = React.useState<string | null>(null)
  const [listingCoordinates, setListingCoordinates] = React.useState(DEFAULT_COORDINATES)
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
  const [reversalOrderId, setReversalOrderId] = React.useState('49438340')
  const [isReversing, setIsReversing] = React.useState(false)
  const [reversalMessage, setReversalMessage] = React.useState('')


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

  const planFeatures = React.useMemo(() => ({
  standard: isEnglish
    ? ['20 photos', 'Full description', 'Open location']
    : isRussian
    ? ['20 фото', 'Полное описание', 'Открытая локация']
    : ['20 foto', 'Tam təsvir', 'Açıq lokasiya'],
    
  vip: isEnglish
    ? [
        'VIP badge on listing', 
        'Up to 20 photos', 
        'Open location', // Добавлено
        'The ad will be randomly displayed at the top of the VIP section and search results in your area' // Добавлено
      ]
    : isRussian
    ? [
        'VIP значок на объявлении', 
        'До 20 фото', 
        'Открытая локация', // Добавлено
        'Объявление будет отображаться в случайном порядке в топ-позициях в разделе VIP и результатах поиска по вашему региону' // Добавлено
      ]
    : [
        'Elana VIP nişanı', 
        '20 fotoya qədər', 
        'Açıq lokasiya', 
        'Elan VIP bölməsində və sizin ərazi üzrə axtarış nəticələrində təsadüfi qaydada ön sıralarda göstəriləcək'
      ],

  premium: isEnglish
    ? [
        'Full description', // Добавлено
        'Up to 30 photos', 
        'Open location', // Добавлено
        'Priority Ad will be shown on the home page (recommendations)', // Добавлено
        'The ad will be randomly displayed at the top of the search results in your area' // Добавлено
      ]
    : isRussian
    ? [
        'Полное описание', // Добавлено
        'До 30 фото', 
        'Открытая локация', // Добавлено
        'Приоритетное объявление будет отображаться на главной странице (в рекомендациях)', // Добавлено
        'Объявление будет отображаться в случайном порядке в топ-позициях результатов поиска по вашему региону' // Добавлено
      ]
    : [
        'Tam təsvir', 
        '30 fotoya qədər', 
        'Açıq lokasiya', 
        'Prioritetli Elan əsas səhifədə (rekomendasiyalarda) göstəriləcək', 
        'Sizin ərazi üzrə axtarış nəticələrində təsadüfi qaydada ön sıralarda göstəriləcək'
      ]
  }), [language]) // eslint-disable-line react-hooks/exhaustive-deps

  const listingPlans = React.useMemo(() => [
    {
      id: 'standard' as ListingTier,
      title: t.pricing.standard,
      isFree: true,
      price: t.pricing.free,
      features: planFeatures.standard,
      emphasis: t.pricing.standardDesc,
      ribbon: '🎁 ' + t.pricing.free
    },
    {
      id: 'vip' as ListingTier,
      title: t.pricing.vip,
      isFree: false,
      features: planFeatures.vip,
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
      features: planFeatures.premium,
      emphasis: t.pricing.premiumDesc,
      pricingOptions: [
        { duration: '14days', label: t.pricing.days14, price: '30 AZN' },
        { duration: '30days', label: t.pricing.days30, price: '55 AZN' }
      ],
      showPricingDropdown: true,
      highlighted: true
    }
  ], [planFeatures, t])

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

  // Handle payment result from Azericard redirect
  React.useEffect(() => {
    const paymentParam = searchParams.get('payment')
    if (paymentParam === 'success' || paymentParam === 'failed' || paymentParam === 'error') {
      setPaymentNotification(paymentParam)
      setActiveTab('listings')
      setTimeout(() => setPaymentNotification(null), 6000)
    }
  }, [])

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
    setExistingImages([])
    setEditingListingId(null)
    setListingCoordinates(DEFAULT_COORDINATES)
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

  const handleMoveExistingUp = React.useCallback((index: number) => {
    if (index > 0) {
      setExistingImages(prev => {
        const arr = [...prev]
        ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
        return arr
      })
    }
  }, [])

  const handleMoveExistingDown = React.useCallback((index: number) => {
    setExistingImages(prev => {
      if (index < prev.length - 1) {
        const arr = [...prev]
        ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
        return arr
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

  const geocodeCity = async (cityName: string) => {
    if (!cityName) return
    try {
      const resolvedQuery = resolveCity(cityName)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=az&q=${encodeURIComponent(resolvedQuery)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'az' } })
      if (!res.ok) return
      const results = (await res.json()) as GeocodeResult[]
      if (!results.length) return
      const lat = Number(results[0].lat)
      const lng = Number(results[0].lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setListingCoordinates({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })
      }
    } catch { /* ignore */ }
  }

  const handleSearchLocation = async () => {
    const query = newListing.address.trim()
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

    if ((newListing.listingTier === 'standard' || newListing.listingTier === 'vip') && selectedFiles.length + existingImages.length > 20) {
      setError(t.listing.maxImagesStandard)
      setIsSubmitting(false)
      return
    }

    if (newListing.listingTier === 'premium' && selectedFiles.length + existingImages.length > 30) {
      setError(t.listing.maxImagesPremium)
      setIsSubmitting(false)
      return
    }

    if (selectedFiles.length + existingImages.length < 5) {
      setError(t.listing.minPhotos)
      setIsSubmitting(false)
      return
    }

    const descriptionWordCount = newListing.description.trim().split(/\s+/).filter(Boolean).length
    if (newListing.listingTier === 'standard' && descriptionWordCount > 300) {
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
      images: existingImages,
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
      premiumExpiresAt: newListing.listingTier === 'premium'
        ? (() => { const d = new Date(); d.setDate(d.getDate() + (newListing.tierPlanDuration === '14days' ? 14 : 30)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
        : undefined
    }

    if (editingListingId) {
      const updated = await updateProperty(editingListingId, propertyPayload, selectedFiles)
      if (!updated) {
        setError(t.listing.updateFailed)
        setIsSubmitting(false)
        return
      }
    } else if (newListing.listingTier === 'vip' || newListing.listingTier === 'premium') {
      // Платный тариф: сохраняем как draft, затем редиректим на оплату
      const draftPayload = { ...propertyPayload, status: 'draft' as ListingStatus }
      const created = await createProperty(draftPayload, selectedFiles)
      if (!created) {
        setError(t.listing.createdFailed)
        setIsSubmitting(false)
        return
      }

      try {
        const fns = getFunctions(firebaseApp, 'europe-west1')
        const initiatePaymentFn = httpsCallable<
          { propertyId: string; tier: string; duration: string },
          { paymentUrl: string; params: Record<string, string> }
        >(fns, 'initiatePayment')

        const result = await initiatePaymentFn({
          propertyId: created.id,
          tier: newListing.listingTier,
          duration: newListing.tierPlanDuration || '30days',
        })

        const { paymentUrl, params } = result.data
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = paymentUrl
        form.style.display = 'none'
        Object.entries(params).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = value
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        return // Страница перейдёт на Azericard
      } catch (err) {
        logger.error('Payment initiation failed:', err)
        await deleteProperty(created.id)
        setError(isEnglish ? 'Payment initiation failed. Please try again.' : isRussian ? 'Ошибка при запуске оплаты. Попробуйте снова.' : 'Ödəniş başladılmadı. Yenidən cəhd edin.')
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
      avatar: profileAvatar,
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

  const handleReversal = async () => {
    if (!reversalOrderId.trim()) return
    setIsReversing(true)
    setReversalMessage('')
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1')
      const performReversalFn = httpsCallable<
        { orderId: string },
        { paymentUrl: string; params: Record<string, string> }
      >(fns, 'performReversal')
      const result = await performReversalFn({ orderId: reversalOrderId.trim() })
      const { paymentUrl, params } = result.data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = paymentUrl
      form.style.display = 'none'
      Object.entries(params).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setReversalMessage('Error: ' + msg)
      setIsReversing(false)
    }
  }

  const handleExtendPremium = async (propertyId: string) => {
    const d = new Date(); d.setDate(d.getDate() + 21)
    const newExpiryDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    try {
      const property = listings.find((p: Property) => p.id === propertyId)
      if (!property) return
      
      await updateProperty(propertyId, {
        premiumExpiresAt: newExpiryDate,
        status: 'active',
      })
      
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
    setExistingImages(property.images || [])

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

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="user-info">
              <img src={user.avatar} alt={user.name} className="dashboard-user-avatar" />
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
                  {paymentNotification === 'success' && (
                    <div className="success-banner">
                      {isEnglish ? '✅ Payment successful! Your listing has been sent for moderation.' : isRussian ? '✅ Оплата прошла! Объявление отправлено на модерацию.' : '✅ Ödəniş uğurlu oldu! Elan moderasiyaya göndərildi.'}
                    </div>
                  )}
                  {(paymentNotification === 'failed' || paymentNotification === 'error') && (
                    <div className="error-message">
                      {isEnglish ? '❌ Payment failed. Your listing was not saved. Please try again.' : isRussian ? '❌ Оплата не прошла. Объявление не сохранено. Попробуйте снова.' : '❌ Ödəniş uğursuz oldu. Elan saxlanmadı. Yenidən cəhd edin.'}
                    </div>
                  )}
                  {error && <div className="error-message">{error}</div>}
                  
                  {isLoadingListings ? (
                    <div className="dashboard-empty-state">
                      <p>{t.messages.loading}</p>
                    </div>
                  ) : listings.length > 0 ? (
                    <div className="listings-list">
                      {listings.filter(p => p.status !== 'draft').map((property) => {
                        const status = property.status || 'active'
                        const isCurrentlyActive = property.isActive !== false || isOccupationExpired(property)
                        const isPendingModeration = status === 'pending'
                        const isInactivePremium = status === 'inactive'
                        const statusLabel = isPendingModeration
                          ? (isEnglish ? 'Pending moderation' : isRussian ? 'На модерации' : 'Moderasiyada gözləyir')
                          : isInactivePremium
                          ? (isEnglish ? 'Hidden — premium expired' : isRussian ? 'Скрыто — истёк премиум' : 'Gizli — premium bitdi')
                          : (isCurrentlyActive ? (isEnglish ? 'Active' : isRussian ? 'Активно' : 'Aktiv') : (isEnglish ? 'Temporarily hidden' : isRussian ? 'Временно скрыто' : 'Müvəqqəti gizli'))

                        return (
                          <div key={property.id} className="listing-item card">
                            <img 
                              src={property.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} 
                              alt={getLocalizedText(property.title)}
                              className="listing-image"
                            />
                            <div className="listing-info">
                              <div className="listing-title-row">
                                <Link to={`/property/${property.id}`} className="listing-title">
                                  {getLocalizedText(property.title)}
                                </Link>
                                <span className={`badge ${isPendingModeration || isInactivePremium ? 'badge-warning' : isCurrentlyActive ? 'badge-success' : 'badge-warning'}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="listing-location">
                                {(() => {
                                  if (property.city) {
                                    const c = cities.find(x => x.value === property.city)
                                    if (c) return language === 'en' ? c.en : language === 'ru' ? (c.ru || c.az) : c.az
                                    return property.city
                                  }
                                  return t.districts[property.district] || property.district
                                })()}
                              </p>
                              <p className="listing-price">
                                {property.price.daily} {property.price.currency} / {t.property.perNight}
                              </p>
                              <div className="listing-meta">
                                {(property.views !== undefined && property.views > 0) && (
                                  <span className="listing-meta-views">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                      <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                    <strong>{property.views}</strong> {isEnglish ? 'views' : isRussian ? 'просмотров' : 'baxış'}
                                  </span>
                                )}
                                {property.unavailableFrom && property.unavailableTo && (
                                  <span className="listing-busy-dates">
                                    {isEnglish ? 'Dates:' : isRussian ? 'Даты:' : 'Tarix:'} {property.unavailableFrom} — {property.unavailableTo}
                                  </span>
                                )}
                                {property.listingTier === 'premium' && isPremiumExpired(property) && (
                                  <span className="listing-premium-expired">
                                    ⏰ {isEnglish ? 'Premium expired — click Extend!' : isRussian ? 'Премиум истек — нажмите Продлить!' : 'Premium bitdi — Uzat düyməsinə klik!'}
                                    {isInactivePremium && property.expiredAt && (() => {
                                      const daysLeft = 30 - Math.floor((Date.now() - new Date(property.expiredAt).getTime()) / (1000 * 60 * 60 * 24))
                                      return daysLeft > 0
                                        ? ` (${isEnglish ? `${daysLeft}d until deletion` : isRussian ? `${daysLeft} дн. до удаления` : `silinməyə ${daysLeft} gün`})`
                                        : null
                                    })()}
                                  </span>
                                )}
                                {property.listingTier === 'premium' && isPremiumActive(property) && (
                                  <span className="listing-premium-active">
                                    ⭐ {isEnglish ? `Premium until ${property.premiumExpiresAt}` : isRussian ? `Премиум до ${property.premiumExpiresAt}` : `Premium ${property.premiumExpiresAt} qədər`}
                                  </span>
                                )}
                                {!isPendingModeration && !isCurrentlyActive && property.unavailableTo && (
                                  <span className="listing-inactive-hint">
                                    {isEnglish ? 'Click Activate to restore.' : isRussian ? 'Нажмите Активировать для восстановления.' : '"Aktiv et" düyməsinə klik edin.'}
                                  </span>
                                )}
                              </div>
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
                    <div className="dashboard-empty-state">
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

                  </div>
                </div>
              )}

              {/* Admin: Reversal Panel — only visible to moderator/admin */}
              {isTestAccount && (
                <div className="tab-content fade-in" style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--color-surface, #f9f9f9)', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <h3 style={{ marginBottom: '1rem', color: '#b00020' }}>Admin: TRTYPE=22 Reversal</h3>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Order ID</label>
                    <input
                      type="text"
                      value={reversalOrderId}
                      onChange={(e) => setReversalOrderId(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', width: '200px' }}
                    />
                  </div>
                  <button
                    className="btn btn-accent"
                    onClick={handleReversal}
                    disabled={isReversing || !reversalOrderId.trim()}
                  >
                    {isReversing ? 'Redirecting to Azericard...' : 'Perform Reversal'}
                  </button>
                  {reversalMessage && (
                    <p style={{ marginTop: '0.75rem', color: reversalMessage.startsWith('Error') ? '#b00020' : '#1a7a1a' }}>
                      {reversalMessage}
                    </p>
                  )}
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
