'use client'

import React from 'react'
import {getFunctions, httpsCallable} from 'firebase/functions'
import {useAuth, useLanguage} from '@/components/providers'
import {resolveCity} from '@/data/city-aliases'
import firebaseApp from '@/lib/firebase/client'
import {createProperty, deleteProperty, updateProperty} from '@/services'
import type {Amenity, District, ListingStatus, ListingTier, LocationCategory, Property, PropertyType} from '@/types'
import * as logger from '@/services/logger'
import {DEFAULT_COORDINATES, type ListingFormState} from '../components/dashboard-types'

interface GeocodeResult {
  lat: string
  lon: string
}

interface UseListingEditorOptions {
  listings: Property[]
  onEditStarted: () => void
  onSaved: () => void
}

export function useListingEditor({listings, onEditStarted, onSaved}: UseListingEditorOptions) {
  const {user} = useAuth()
  const {language, t} = useLanguage()
  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

  const [showAddSuccess, setShowAddSuccess] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [existingImages, setExistingImages] = React.useState<string[]>([])
  const [editingListingId, setEditingListingId] = React.useState<string | null>(null)
  const [listingCoordinates, setListingCoordinates] = React.useState(DEFAULT_COORDINATES)
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false)
  const [locationSearchError, setLocationSearchError] = React.useState('')

  // Form state for adding listing
  const [newListing, setNewListing] = React.useState<ListingFormState>({
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
    if (!editingListingId && user) {
      setNewListing(prev => ({
        ...prev,
        contactEmail: prev.contactEmail || user.email,
        contactPhone: prev.contactPhone || user.phone
      }))
    }
  }, [editingListingId, user])

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
    const existingListing = editingListingId ? listings.find(p => p.id === editingListingId) : null
    const listingStatus = existingListing ? existingListing.status : 'pending'

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
      // Paid metadata is applied only by the verified Azericard callback.
      isFeatured: false,
      isActive: true,
      city: newListing.city || 'Baku',
      views: 0,
      likes: [],
      favorites: [],
      comments: [],
      premiumExpiresAt: undefined
    }

    if (editingListingId) {
      // When editing, never overwrite metadata — only update content fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { views, likes, favorites, comments, premiumExpiresAt, isFeatured, isActive, listingTier, status: _status, ...contentFields } = propertyPayload
      const editPayload: Partial<Property> = {
        ...contentFields,
        status: existingListing?.status ?? 'active',
        listingTier: existingListing?.listingTier ?? listingTier,
        isFeatured: existingListing?.isFeatured ?? isFeatured,
        isActive: existingListing?.isActive ?? true,
        ...(existingListing?.premiumExpiresAt !== undefined && { premiumExpiresAt: existingListing.premiumExpiresAt }),
        ...(existingListing?.vipExpiresAt !== undefined && { vipExpiresAt: existingListing.vipExpiresAt }),
      }
      const updated = await updateProperty(editingListingId, editPayload, selectedFiles)
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
      resetListingForm()
      onSaved()
    }, 1500)

    setIsSubmitting(false)
  }


  const handleEditListing = (property: Property) => {
    if (!user) return
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

    onEditStarted()
  }

  return {
    editListing: handleEditListing,
    reset: resetListingForm,
    editorProps: {
      editingListingId,
      newListing,
      setNewListing,
      error,
      showAddSuccess,
      onSubmit: handleAddListing,
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
    }
  }
}
