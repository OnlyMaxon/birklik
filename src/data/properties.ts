import { Property, PropertyType, District, Amenity, UserListing, LocationCategory } from '../types'

export interface FilterOption {
  key: string
  az: string
  en: string
}

export const mockProperties: Property[] = []

export const propertyTypes: PropertyType[] = [
  'villa',
  'apartment',
  'house',
  'cottage',
  'penthouse'
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
  { key: 'pool', az: 'Hovuz', en: 'Pool' },
  { key: 'ac', az: 'Kondisioner', en: 'Air conditioning' },
  { key: 'sauna', az: 'Sauna', en: 'Sauna' },
  { key: 'kidsZone', az: 'Uşaq oyun zonası', en: 'Kids play zone' },
  { key: 'playstation', az: 'PlayStation', en: 'PlayStation' },
  { key: 'billiard', az: 'Bilyard', en: 'Billiards' },
  { key: 'tennis', az: 'Tennis', en: 'Tennis' },
  { key: 'boardGames', az: 'Stol oyunları', en: 'Board games' },
  { key: 'samovar', az: 'Samovar', en: 'Samovar' },
  { key: 'gazebo', az: 'Besedka', en: 'Gazebo' },
  { key: 'bbq', az: 'Manqal', en: 'BBQ' },
  { key: 'wifi', az: 'Wi-Fi', en: 'Wi-Fi' },
  { key: 'garage', az: 'Qaraj', en: 'Garage' }
]

export const nearFilterOptions: FilterOption[] = [
  { key: 'mountains', az: 'Dağlar', en: 'Mountains' },
  { key: 'forest', az: 'Meşə', en: 'Forest' },
  { key: 'sea', az: 'Dəniz', en: 'Sea' },
  { key: 'riverLake', az: 'Çay və ya göl', en: 'River or lake' },
  { key: 'resortCenters', az: 'İstirahət mərkəzləri', en: 'Resort centers' },
  { key: 'restaurant', az: 'Restoran', en: 'Restaurant' },
  { key: 'park', az: 'Park', en: 'Park' }
]

export const cityLocationOptions: Record<LocationCategory, FilterOption[]> = {
  rayon: [
    { key: 'yasamal', az: 'Yasamal', en: 'Yasamal' },
    { key: 'nerimanov', az: 'Nərimanov', en: 'Narimanov' },
    { key: 'nesimi', az: 'Nəsimi', en: 'Nasimi' },
    { key: 'xetai', az: 'Xətai', en: 'Khatai' },
    { key: 'sabail', az: 'Səbail', en: 'Sabail' },
    { key: 'bineqedi', az: 'Binəqədi', en: 'Binagadi' },
    { key: 'qaradag', az: 'Qaradag', en: 'Garadagh' },
    { key: 'xezar', az: 'Xəzər', en: 'Khazar' },
    { key: 'suraxani', az: 'Suraxanı', en: 'Surakhani' },
    { key: 'pirallahi', az: 'Pirallahi', en: 'Pirallahi' },
    { key: 'abseron', az: 'Abşeron', en: 'Absheron' },
    { key: 'xirdalan', az: 'Xırdalan', en: 'Khirdalan' },
    { key: 'sumqayitDistrict', az: 'Sumqayıt rayonu', en: 'Sumgait district' },
    { key: 'salyanHighway', az: 'Salyan şossesi', en: 'Salyan highway' },
    { key: 'bayil', az: 'Bayil', en: 'Bayil' },
    { key: 'badamdar', az: 'Badamdar', en: 'Badamdar' },
    { key: '8km', az: '8-ci km', en: '8th km' },
    { key: 'mehemmedi', az: 'Məhəmmədi', en: 'Mammadli' },
    { key: 'mashtaga', az: 'Mashtaga', en: 'Mashtaga' },
    { key: 'zabrat', az: 'Zabrat', en: 'Zabrat' },
    { key: 'sabuncu', az: 'Sabunçu', en: 'Sabunchu' },
    { key: 'ramana', az: 'Ramana', en: 'Ramana' },
    { key: 'amirjan', az: 'Əmircan', en: 'Amirjan' },
    { key: 'lokbatan', az: 'Lokbatan', en: 'Lokbatan' },
    { key: 'turkan', az: 'Turkan', en: 'Turkan' },
    { key: 'hokmeli', az: 'Hökməli', en: 'Hokmali' },
    { key: 'saray', az: 'Saray', en: 'Saray' },
    { key: 'hovsan', az: 'Hovsan', en: 'Hovsan' },
    { key: 'zil', az: 'Zığ', en: 'Zigh' }
  ],
  metro: [
    { key: '20yanvar', az: '20 Yanvar', en: '20 Yanvar' },
    { key: '28may', az: '28 May', en: '28 May' },
    { key: '8noyabr', az: '8 Noyabr', en: '8 November' },
    { key: 'avtovagzal', az: 'Avtovağzal', en: 'Avtovagzal' },
    { key: 'azadliqprospekti', az: 'Azadlıq Prospekti', en: 'Azadlig Prospekti' },
    { key: 'bakmil', az: 'Bakmil', en: 'Bakmil' },
    { key: 'dernegul', az: 'Dərnəgül', en: 'Darnagul' },
    { key: 'elmler', az: 'Elmlər Akademiyası', en: 'Elmler Akademiyasi' },
    { key: 'ehmedli', az: 'Əhmədli', en: 'Ahmadli' },
    { key: 'genclik', az: 'Gənclik', en: 'Ganjlik' },
    { key: 'heziaslanov', az: 'Həzi Aslanov', en: 'Hazi Aslanov' },
    { key: 'xalqlardostlugu', az: 'Xalqlar Dostluğu', en: 'Khalklar Dostlugu' },
    { key: 'xocesen', az: 'Xocəsən', en: 'Khojasan' },
    { key: 'iceriseher', az: 'İçərişəhər', en: 'Icherisheher' },
    { key: 'insaatcilar', az: 'İnşaatçılar', en: 'Inshaatchilar' },
    { key: 'koroglu', az: 'Koroğlu', en: 'Koroglu' },
    { key: 'qaraqarayev', az: 'Qara Qarayev', en: 'Qara Qarayev' },
    { key: 'memarEcemi', az: 'Memar Əcəmi', en: 'Memar Ajami' },
    { key: 'neftciler', az: 'Neftçilər', en: 'Neftchilar' },
    { key: 'nerimanov', az: 'Nəriman Nərimanov', en: 'Nariman Narimanov' },
    { key: 'nesimiStation', az: 'Nəsimi', en: 'Nasimi' },
    { key: 'nizamiStation', az: 'Nizami', en: 'Nizami' },
    { key: 'sahil', az: 'Sahil', en: 'Sahil' },
    { key: 'sahismayilxetai', az: 'Şah İsmayıl Xətai', en: 'Shah Ismayil Khatai' },
    { key: 'ulduz', az: 'Ulduz', en: 'Ulduz' }
  ],
  landmark: [
    { key: 'flameTowers', az: 'Flame Towers', en: 'Flame Towers' },
    { key: 'fountainSquare', az: 'Fountain Square', en: 'Fountain Square' },
    { key: 'portBaku', az: 'Port Baku', en: 'Port Baku' },
    { key: 'ganjlikMall', az: 'Gənclik Mall', en: 'Ganjlik Mall' },
    { key: 'denizkenari', az: 'Dənizkənarı bulvar', en: 'Seaside boulevard' },
    { key: 'nizamiStreet', az: 'Nizami küçəsi', en: 'Nizami street' },
    { key: 'whiteCity', az: 'White City', en: 'White City' },
    { key: 'heydarAliyevCenter', az: 'Heydər Əliyev Mərkəzi', en: 'Heydar Aliyev Center' },
    { key: 'oldCity', az: 'İçərişəhər', en: 'Old City' },
    { key: 'bakuEye', az: 'Baku Eye', en: 'Baku Eye' },
    { key: 'crystalHall', az: 'Baku Crystal Hall', en: 'Baku Crystal Hall' },
    { key: 'seaMall', az: 'Dəniz Mall', en: 'Deniz Mall' },
    { key: 'winterPark', az: 'Qış parkı', en: 'Winter Park' },
    { key: 'highlandPark', az: 'Dağüstü park', en: 'Highland Park' },
    { key: 'nizamiMall', az: '28 Mall', en: '28 Mall' },
    { key: 'metroPark', az: 'Metro Park', en: 'Metro Park' },
    { key: 'korogluPark', az: 'Koroğlu parkı', en: 'Koroglu Park' },
    { key: 'gobustan', az: 'Qobustan qayaüstü', en: 'Gobustan rock art' },
    { key: 'ateshgah', az: 'Atəşgah məbədi', en: 'Ateshgah temple' },
    { key: 'yanardag', az: 'Yanardağ', en: 'Yanar Dag' },
    { key: 'olympicStadium', az: 'Olimpiya stadionu', en: 'Olympic Stadium' }
  ]
}

const moreToAmenityMap: Record<string, Amenity> = {
  pool: 'pool',
  ac: 'ac',
  wifi: 'wifi',
  bbq: 'bbq',
  garage: 'parking'
}

const includesAny = (values: string[] | undefined, selected: string[]): boolean => {
  if (selected.length === 0) return true
  if (!values || values.length === 0) return false
  return selected.some((item) => values.includes(item))
}

export const getOptionLabel = (options: FilterOption[], key: string, language: 'az' | 'en'): string => {
  const option = options.find((entry) => entry.key === key)
  if (!option) return key
  return language === 'en' ? option.en : option.az
}

// Mock user listings for dashboard
export const mockUserListings: UserListing[] = []

// Helper functions
export const getPropertyById = (id: string): Property | undefined => {
  return mockProperties.find(p => p.id === id)
}

export const filterProperties = (
  properties: Property[],
  filters: {
    search?: string
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

    if (!includesAny(property.nearbyPlaces, filters.nearbyPlaces || [])) return false

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
