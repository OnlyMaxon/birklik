import { Property, PropertyType, District, Amenity, LocationCategory } from '../types'

export interface FilterOption {
  key: string
  az: string
  en: string
}

export interface CityOption {
  value: string
  az: string
  en: string
  ru: string
}

export const propertyTypes: PropertyType[] = [
  'villa',
  'apartment',
  'house',
  'cottage',
  'penthouse'
]

export const cities: CityOption[] = [
  { value: 'Baku', az: 'Bakı', en: 'Baku', ru: 'Баку' },
  { value: 'Shaki', az: 'Şəki', en: 'Shaki', ru: 'Шеки' },
  { value: 'Shamakhi', az: 'Şamaxı', en: 'Shamakhi', ru: 'Шамаха' },
  { value: 'Gabala', az: 'Qəbələ', en: 'Gabala', ru: 'Габала' },
  { value: 'Quba', az: 'Quba', en: 'Quba', ru: 'Губа' },
  { value: 'Lankaran', az: 'Lənkəran', en: 'Lankaran', ru: 'Ленкорань' },
  { value: 'Ismayilli', az: 'İsmayıllı', en: 'Ismayilli', ru: 'Исмаиллы' },
  { value: 'Naftalan', az: 'Naftalan', en: 'Naftalan', ru: 'Нафталан' },
  { value: 'Qusar', az: 'Qusar', en: 'Qusar', ru: 'Кусары' },
  { value: 'Lerik', az: 'Lerik', en: 'Lerik', ru: 'Лерик' },
  { value: 'Shushi', az: 'Şuşa', en: 'Shushi', ru: 'Шуша' },
  { value: 'Goygol', az: 'Göygöl', en: 'Goygol', ru: 'Гейгель' },
  { value: 'Nakhchivan', az: 'Naxçıvan', en: 'Nakhchivan', ru: 'Нахчыван' },
  { value: 'Mingachevir', az: 'Mingəçevir', en: 'Mingachevir', ru: 'Мингечевир' },
  { value: 'Ganja', az: 'Gəncə', en: 'Ganja', ru: 'Гянджа' }
]

export const districts: District[] = [
  'mardakan',
  'novkhani',
  'buzovna',
  'bilgah',
  'zagulba',
  'pirshagi',
  'shuvalan',
  'baku',
  'nabran',
  'gabala'
]

export const amenitiesList: Amenity[] = [
  'pool',
  'parking',
  'wifi',
  'ac',
  'kitchen',
  'tv',
  'washer',
  'garden',
  'bbq',
  'security',
  'beach',
  'gym'
]

export const moreFilterOptions: FilterOption[] = [
  { key: 'sauna', az: 'Sauna', en: 'Sauna' },
  { key: 'kidsZone', az: 'Uşaq oyun zonası', en: 'Kids play zone' },
  { key: 'playstation', az: 'PlayStation', en: 'PlayStation' },
  { key: 'billiard', az: 'Bilyard', en: 'Billiards' },
  { key: 'tennis', az: 'Tennis', en: 'Tennis' },
  { key: 'boardGames', az: 'Stol oyunları', en: 'Board games' },
  { key: 'samovar', az: 'Samovar', en: 'Samovar' },
  { key: 'gazebo', az: 'Besedka', en: 'Gazebo' },
  { key: 'garage', az: 'Qaraj', en: 'Garage' }
]

export const nearFilterOptions: FilterOption[] = [
  { key: 'beach', az: 'Çimərlik', en: 'Beach' },
  { key: 'mountains', az: 'Dağlar', en: 'Mountains' },
  { key: 'forest', az: 'Meşə', en: 'Forest' },
  { key: 'sea', az: 'Dəniz', en: 'Sea' },
  { key: 'riverLake', az: 'Çay və ya göl', en: 'River or lake' },
  { key: 'resortCenters', az: 'İstirahət mərkəzləri', en: 'Resort centers' },
  { key: 'restaurant', az: 'Restoran', en: 'Restaurant' },
  { key: 'park', az: 'Park', en: 'Park' }
]

const keyReplacements: Record<string, string> = {
  ə: 'e',
  Ə: 'e',
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u'
}

const toOptionKey = (value: string): string => {
  const transliterated = value
    .split('')
    .map((char) => keyReplacements[char] || char)
    .join('')

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
}

const toFilterOptions = (names: string[]): FilterOption[] => {
  return names.map((name) => ({
    key: toOptionKey(name),
    az: name,
    en: name
  }))
}

const rayonLocationNames = [
  'Abşeron r.',
  'Aşağı Güzdək',
  'Atyalı',
  'Ceyranbatan',
  'Çiçək',
  'Digah',
  'Fatmayı',
  'Görədil',
  'Güzdək',
  'Hökməli',
  'Köhnə Corat',
  'Qobu',
  'Masazır',
  'Mehdiabad',
  'Məmmədli',
  'Novxanı',
  'Pirəkəşkül',
  'Saray',
  'Yeni Corat',
  'Zuğulba',
  'Binəqədi r.',
  '2-ci Alatava',
  '6-cı mikrorayon',
  '7-ci mikrorayon',
  '8-ci mikrorayon',
  '9-cu mikrorayon',
  'Biləcəri',
  'Binəqədi',
  'Xocəsən',
  'Xutor',
  'M.Ə.Rəsulzadə',
  'Sulutəpə',
  'Xətai r.',
  'Ağ şəhər',
  'Əhmədli',
  'Həzi Aslanov',
  'Köhnə Günəşli',
  'NZS',
  'Xəzər r.',
  'Binə',
  'Buzovna',
  'Dübəndi',
  'Gürgən',
  'Qala',
  'Mərdəkan',
  'Şağan',
  'Şimal DRES',
  'Şüvəlan',
  'Türkan',
  'Zirə',
  'Qaradağ r.',
  'Ələt',
  'Qızıldaş',
  'Qobustan',
  'Lökbatan',
  'Müşfiqabad',
  'Puta',
  'Sahil',
  'Səngəçal',
  'Şubanı',
  'Nərimanov r.',
  'Böyükşor',
  'Nəsimi r.',
  '1-ci mikrorayon',
  '2-ci mikrorayon',
  '3-cü mikrorayon',
  '4-cü mikrorayon',
  '5-ci mikrorayon',
  'Kubinka',
  'Nizami r.',
  '8-ci kilometr',
  'Keşlə',
  'Pirallahı r.',
  'Sabunçu r.',
  'Albalılıq',
  'Bakıxanov',
  'Balaxanı',
  'Bilgəh',
  'Kürdəxanı',
  'Maştağa',
  'Nardaran',
  'Pirşağı',
  'Ramana',
  'Sabunçu',
  'Savalan',
  'Sea Breeze',
  'Yeni Balaxanı',
  'Yeni Ramana',
  'Zabrat',
  'Səbail r.',
  '20-ci sahə',
  'Badamdar',
  'Bayıl',
  'Bibiheybət',
  'Şıxov',
  'Suraxanı r.',
  'Bahar',
  'Bülbülə',
  'Dədə Qorqud',
  'Əmircan',
  'Günəşli',
  'Hövsan',
  'Qaraçuxur',
  'Massiv A',
  'Massiv B',
  'Massiv D',
  'Massiv G',
  'Massiv V',
  'Suraxanı',
  'Şərq',
  'Yeni Günəşli',
  'Yeni Suraxanı',
  'Zığ',
  'Yasamal r.',
  'Yasamal',
  'Yeni Yasamal'
]

const metroLocationNames = [
  '20 Yanvar',
  '28 May',
  '8 Noyabr',
  'Avtovağzal',
  'Azadlıq Prospekti',
  'Bakmil',
  'Dərnəgül',
  'Elmlər Akademiyası',
  'Əhmədli',
  'Gənclik',
  'Həzi Aslanov',
  'Xalqlar Dostluğu',
  'Xocəsən',
  'İçəri Şəhər',
  'İnşaatçılar',
  'Koroğlu',
  'Qara Qarayev',
  'Memar Əcəmi',
  'Neftçilər',
  'Nəriman Nərimanov',
  'Nəsimi',
  'Nizami',
  'Sahil',
  'Şah İsmayıl Xətai',
  'Ulduz'
]

// City to districts/regions mapping
export const cityDistricts: Record<string, string[]> = {
  'Baku': ['mardakan', 'novkhani', 'buzovna', 'bilgah', 'zagulba', 'pirshagi', 'shuvalan', 'baku', 'nabran'],
  'Shaki': ['Kiş', 'Baş Layışı', 'İnçə', 'Orta Zəyzid', 'Oxud', 'Baltalı', 'Cumay', 'Şorsu', 'Aşağı Göynük', 'Daşüz'],
  'Gabala': ['Nic', 'Vəndam', 'Bum', 'Laza', 'Durca', 'Həmzəli', 'Mirzəbəyli', 'Mixlıqovaq', 'Solquca', 'Tikanlı'],
  'Quba': ['Xınalıq', 'Qrız', 'Qəçreş', 'Təngəaltı', 'Yerfi', 'Buduq', 'Alıpan', 'Rüstov', 'Cek', 'Xaltan'],
  'Lankaran': ['Haftoni', 'Xanbulançay', 'Gərmətük', 'Girdəni', 'Şağlaküçə', 'Şıxakəran', 'Separadi', 'Boladi', 'Nərbağı', 'Türsə'],
  'Shamakhi': ['Dəmirçi', 'Avaxıl', 'Pirqulu', 'Meysəri', 'Məlhəm', 'Mədrəsə', 'Çuxuryurd', 'Qaleybuğurd', 'Nağaraxana', 'Sis'],
  'Ismayilli': ['Lahıc', 'Basqal', 'İvanovka', 'Talıstan', 'Buynuz', 'Topçu', 'Təzəkənd', 'Qalacıq', 'Diyallı', 'Qurbanəfəndi'],
  'Naftalan': ['Boluslu', 'Tap Qaraqoyunlu', 'Borsunlu', 'Səfikürd', 'Zeyvə', 'Xarxaput', 'Qaraçinar', 'Goran', 'Qazanbulaq', 'Ballıqaya'],
  'Qusar': ['Laza', 'Əniq', 'Hil', 'Quzun', 'Sudur', 'Urva', 'Yasab', 'Gədəzeyxur', 'Bədirqala', 'Bala Qusar'],
  'Lerik': ['Hamarat', 'Mastail', 'Zuvand', 'Orand', 'Vov', 'Pirasora', 'Monidigah', 'Bilnə', 'Şingədulan', 'Vizazəmin'],
  'Shushi': ['Daşaltı', 'Turşsu', 'Malıbəyli', 'Şuşakənd', 'Qeybalı', 'Xəlfəli', 'Ünvanlı', 'Baş Qaladərəsi', 'Kiçik Qaladərəsi', 'Mirzələr'],
  'Goygol': ['Toğanalı', 'Çaylı', 'Mixaylovka', 'Yeni Zod', 'Gümüşlü', 'Firuzabad', 'Aşağı Ağcakənd', 'Azad', 'Quşqara', 'Üçtəpə'],
  'Nakhchivan': ['Badamlı', 'Sirab', 'Qarabağlar', 'Gülüstan', 'Qal', 'Biləv', 'Nəsirvaz', 'Batabat', 'Ordubad (Qədim Şəhər)', 'Şahbuz'],
  'Mingachevir': ['Varvara', 'Havarlı', 'Balçılı', 'Aran', 'Tanrıverdilər', 'Nemədabad', 'Yuxarı Bucaq', 'Aşağı Bucaq'],
  'Ganja': ['Hacıkənd', 'Zurnabad', 'Çaylı', 'Aşağı Ağcakənd', 'Yeni Zod', 'Mixaylovka', 'Toğanalı', 'Azad', 'Çaykənd', 'Topalhəsənli']
}

export const cityLocationOptions: Record<LocationCategory, FilterOption[]> = {
  rayon: toFilterOptions(rayonLocationNames),
  metro: toFilterOptions(metroLocationNames)
}

const moreToAmenityMap: Record<string, Amenity> = {
  garage: 'parking'
}

const includesAny = (values: string[] | undefined, selected: string[]): boolean => {
  if (selected.length === 0) return true
  if (!values || values.length === 0) return false
  return selected.some((item) => values.includes(item))
}

export const getOptionLabel = (options: FilterOption[], key: string, language: 'az' | 'en' | 'ru'): string => {
  const option = options.find((entry) => entry.key === key)
  if (!option) return key
  if (language === 'en') return option.en
  return option.az
}

// Filter properties based on various criteria
export const filterProperties = (
  properties: Property[],
  filters: {
    search?: string
    checkIn?: string
    checkOut?: string
    guests?: number
    type?: PropertyType | ''
    district?: District | ''
    minPrice?: number
    maxPrice?: number
    rooms?: number
    hasPool?: boolean | null
    extraFilters?: string[]
    nearbyPlaces?: string[]
    city?: string
    locationCategory?: LocationCategory
    locationTags?: string[]
  }
): Property[] => {
  const intersectsRange = (
    rangeStart: string,
    rangeEnd: string,
    targetStart: string,
    targetEnd: string
  ): boolean => {
    return rangeStart <= targetEnd && rangeEnd >= targetStart
  }

  const isUnavailableForSelectedDates = (property: Property): boolean => {
    const busyFrom = property.unavailableFrom
    const busyTo = property.unavailableTo

    if (!busyFrom || !busyTo) {
      return false
    }

    if (filters.checkIn && filters.checkOut) {
      return intersectsRange(filters.checkIn, filters.checkOut, busyFrom, busyTo)
    }

    if (filters.checkIn) {
      return filters.checkIn >= busyFrom && filters.checkIn <= busyTo
    }

    return false
  }

  const amenityAliases: Record<Amenity, string[]> = {
    pool: ['pool', 'hovuz', 'бассейн'],
    parking: ['parking', 'парковка', 'parkinq'],
    wifi: ['wifi', 'wi-fi', 'вайфай'],
    ac: ['ac', 'air conditioning', 'kondisioner', 'кондиционер'],
    kitchen: ['kitchen', 'metbex', 'кухня'],
    tv: ['tv', 'televizor', 'телевизор'],
    washer: ['washer', 'paltaryuyan', 'стиральная'],
    garden: ['garden', 'bag', 'сад'],
    bbq: ['bbq', 'manqal', 'мангал'],
    security: ['security', 'muhafize', 'охрана'],
    beach: ['beach', 'deniz', 'пляж'],
    gym: ['gym', 'idman', 'спортзал']
  }

  return properties.filter(property => {
    if (isUnavailableForSelectedDates(property)) return false

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = Object.values(property.title).some(t => t.toLowerCase().includes(searchLower))
      const matchesAddress = Object.values(property.address).some(a => a.toLowerCase().includes(searchLower))
      const matchedAmenity = (Object.entries(amenityAliases) as Array<[Amenity, string[]]>).find(([, aliases]) =>
        aliases.some(alias => alias.includes(searchLower) || searchLower.includes(alias))
      )
      const matchesAmenity = matchedAmenity ? property.amenities.includes(matchedAmenity[0]) : false

      if (!matchesTitle && !matchesAddress && !matchesAmenity) return false
    }

    // Type filter
    if (filters.type && property.type !== filters.type) return false

    // District filter
    if (filters.district && property.district !== filters.district) return false

    // Price filter
    if (filters.minPrice && property.price.daily < filters.minPrice) return false
    if (filters.maxPrice && property.price.daily > filters.maxPrice) return false

    // Rooms filter
    if (filters.rooms && property.rooms !== filters.rooms) return false

    // Guests filter - check if property's minGuests/maxGuests range can accommodate selected guest count
    if (filters.guests) {
      const minGuests = property.minGuests ?? 1
      const maxGuests = property.maxGuests ?? 10
      // Property can accommodate the guest count if it's within the range
      if (filters.guests < minGuests || filters.guests > maxGuests) return false
    }

    // Pool filter
    if (filters.hasPool === true && !property.amenities.includes('pool')) return false
    if (filters.hasPool === false && property.amenities.includes('pool')) return false

    // More filters (amenity-backed + custom extra features)
    if (filters.extraFilters && filters.extraFilters.length > 0) {
      const extraFeatures = property.extraFeatures || []
      const allMoreMatched = filters.extraFilters.every((selected) => {
        const mappedAmenity = moreToAmenityMap[selected]
        if (mappedAmenity) {
          return property.amenities.includes(mappedAmenity) || extraFeatures.includes(selected)
        }
        return extraFeatures.includes(selected)
      })

      if (!allMoreMatched) return false
    }

    // Nearby places - only filter if specific places are selected
    if (filters.nearbyPlaces && filters.nearbyPlaces.length > 0) {
      if (!includesAny(property.nearbyPlaces, filters.nearbyPlaces)) return false
    }

    if (filters.city) {
      if (!property.city) return false
      if (property.city.toLowerCase() !== filters.city.toLowerCase()) return false
    }

    if (filters.locationTags && filters.locationTags.length > 0) {
      if (!includesAny(property.locationTags, filters.locationTags)) return false

      if (filters.locationCategory && property.locationCategory && property.locationCategory !== filters.locationCategory) {
        return false
      }
    }

    return true
  })
}
