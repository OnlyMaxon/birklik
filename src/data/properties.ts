import { Property, PropertyType, District, Amenity, UserListing } from '../types'

export const mockProperties: Property[] = [
  {
    id: '1',
    title: {
      az: 'Lüks villa hovuzla - Mərdəkan',
      ru: 'Роскошная вилла с бассейном - Мардакян',
      en: 'Luxury Villa with Pool - Mardakan'
    },
    description: {
      az: 'Geniş bağ ərazisi olan lüks villa. 5 yataq otağı, geniş oturma otağı, müasir mətbəx. Böyük hovuz və manqal sahəsi. Ailəvi istirahət üçün ideal.',
      ru: 'Роскошная вилла с большой садовой территорией. 5 спален, просторная гостиная, современная кухня. Большой бассейн и зона для барбекю. Идеально подходит для семейного отдыха.',
      en: 'Luxury villa with large garden area. 5 bedrooms, spacious living room, modern kitchen. Large pool and BBQ area. Perfect for family vacation.'
    },
    type: 'villa',
    district: 'mardakan',
    address: {
      az: 'Mərdəkan qəsəbəsi, Səməd Vurğun küçəsi 45',
      ru: 'поселок Мардакян, улица Самеда Вургуна 45',
      en: 'Mardakan village, Samad Vurgun street 45'
    },
    price: {
      daily: 250,
      weekly: 1500,
      monthly: 5000,
      currency: 'AZN'
    },
    rooms: 5,
    area: 350,
    amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'tv', 'washer', 'garden', 'bbq', 'security'],
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'
    ],
    coordinates: { lat: 40.5236, lng: 50.1486 },
    owner: {
      name: 'Əli Məmmədov',
      phone: '+994501234567',
      email: 'ali@example.com'
    },
    rating: 4.8,
    reviews: 24
  },
  {
    id: '2',
    title: {
      az: 'Dəniz mənzərəli mənzil - Bilgəh',
      ru: 'Квартира с видом на море - Бильгях',
      en: 'Sea View Apartment - Bilgah'
    },
    description: {
      az: '3 otaqlı müasir mənzil dəniz mənzərəsi ilə. Tam mebelli, kondisionerli. Çimərlikə 5 dəqiqəlik məsafədə.',
      ru: '3-комнатная современная квартира с видом на море. Полностью меблирована, с кондиционером. 5 минут до пляжа.',
      en: '3-room modern apartment with sea view. Fully furnished with AC. 5 minutes walk to beach.'
    },
    type: 'apartment',
    district: 'bilgah',
    address: {
      az: 'Bilgəh qəsəbəsi, Dəniz küçəsi 12',
      ru: 'поселок Бильгях, улица Дениз 12',
      en: 'Bilgah village, Deniz street 12'
    },
    price: {
      daily: 120,
      weekly: 700,
      monthly: 2500,
      currency: 'AZN'
    },
    rooms: 3,
    area: 95,
    amenities: ['wifi', 'ac', 'kitchen', 'tv', 'washer', 'parking', 'beach'],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'
    ],
    coordinates: { lat: 40.5644, lng: 50.0372 },
    owner: {
      name: 'Leyla Əliyeva',
      phone: '+994552345678',
      email: 'leyla@example.com'
    },
    rating: 4.6,
    reviews: 18
  },
  {
    id: '3',
    title: {
      az: 'Müasir kottec - Novxanı',
      ru: 'Современный коттедж - Новханы',
      en: 'Modern Cottage - Novkhani'
    },
    description: {
      az: '4 otaqlı rahat kottec. Sakit məhəllədə yerləşir. Geniş həyət və manqal sahəsi mövcuddur.',
      ru: '4-комнатный уютный коттедж. Расположен в тихом районе. Есть просторный двор и зона для барбекю.',
      en: '4-room cozy cottage. Located in quiet neighborhood. Has spacious yard and BBQ area.'
    },
    type: 'cottage',
    district: 'novkhani',
    address: {
      az: 'Novxanı qəsəbəsi, Mərkəz küçəsi 78',
      ru: 'поселок Новханы, улица Меркез 78',
      en: 'Novkhani village, Merkez street 78'
    },
    price: {
      daily: 180,
      weekly: 1100,
      monthly: 4000,
      currency: 'AZN'
    },
    rooms: 4,
    area: 220,
    amenities: ['parking', 'wifi', 'ac', 'kitchen', 'tv', 'garden', 'bbq', 'security'],
    images: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800'
    ],
    coordinates: { lat: 40.5421, lng: 50.0856 },
    owner: {
      name: 'Rəşad Hüseynov',
      phone: '+994703456789',
      email: 'rashad@example.com'
    },
    rating: 4.5,
    reviews: 12
  },
  {
    id: '4',
    title: {
      az: 'Premium villa - Buzovna',
      ru: 'Премиум вилла - Бузовна',
      en: 'Premium Villa - Buzovna'
    },
    description: {
      az: 'Eksklüziv villa böyük hovuzla. 6 yataq otağı, smart ev sistemi, geniş parkinq. VIP tədbirlər üçün idealdır.',
      ru: 'Эксклюзивная вилла с большим бассейном. 6 спален, система умного дома, просторная парковка. Идеально для VIP мероприятий.',
      en: 'Exclusive villa with large pool. 6 bedrooms, smart home system, spacious parking. Perfect for VIP events.'
    },
    type: 'villa',
    district: 'buzovna',
    address: {
      az: 'Buzovna qəsəbəsi, Sahil küçəsi 23',
      ru: 'поселок Бузовна, улица Сахиль 23',
      en: 'Buzovna village, Sahil street 23'
    },
    price: {
      daily: 400,
      weekly: 2500,
      monthly: 9000,
      currency: 'AZN'
    },
    rooms: 6,
    area: 450,
    amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'tv', 'washer', 'garden', 'bbq', 'security', 'gym'],
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800'
    ],
    coordinates: { lat: 40.5234, lng: 50.1123 },
    owner: {
      name: 'Kamran Əsgərov',
      phone: '+994774567890',
      email: 'kamran@example.com'
    },
    rating: 4.9,
    reviews: 31
  },
  {
    id: '5',
    title: {
      az: 'Ailə evi - Şüvəlan',
      ru: 'Семейный дом - Шувелан',
      en: 'Family House - Shuvalan'
    },
    description: {
      az: 'Rahat ailə evi 3 otaqla. Sakit küçədə yerləşir. Uşaqlar üçün oyun sahəsi var.',
      ru: 'Уютный семейный дом с 3 комнатами. Расположен на тихой улице. Есть игровая площадка для детей.',
      en: 'Cozy family house with 3 rooms. Located on quiet street. Has playground for children.'
    },
    type: 'house',
    district: 'shuvalan',
    address: {
      az: 'Şüvəlan qəsəbəsi, Bağ küçəsi 56',
      ru: 'поселок Шувелан, улица Баг 56',
      en: 'Shuvalan village, Bag street 56'
    },
    price: {
      daily: 100,
      weekly: 600,
      monthly: 2000,
      currency: 'AZN'
    },
    rooms: 3,
    area: 150,
    amenities: ['parking', 'wifi', 'ac', 'kitchen', 'tv', 'garden'],
    images: [
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800'
    ],
    coordinates: { lat: 40.5456, lng: 50.0234 },
    owner: {
      name: 'Nigar Kazımova',
      phone: '+994505678901',
      email: 'nigar@example.com'
    },
    rating: 4.4,
    reviews: 8
  },
  {
    id: '6',
    title: {
      az: 'Dağ mənzərəli villa - Qəbələ',
      ru: 'Вилла с видом на горы - Габала',
      en: 'Mountain View Villa - Gabala'
    },
    description: {
      az: 'Qəbələnin ən gözəl yerində lüks villa. Dağ mənzərəsi, təmiz hava, istirahət üçün ideal şərait.',
      ru: 'Роскошная вилла в самом красивом месте Габалы. Вид на горы, чистый воздух, идеальные условия для отдыха.',
      en: 'Luxury villa in the most beautiful location of Gabala. Mountain view, fresh air, perfect conditions for relaxation.'
    },
    type: 'villa',
    district: 'gabala',
    address: {
      az: 'Qəbələ, Dağ yolu küçəsi 15',
      ru: 'Габала, улица Дагйолу 15',
      en: 'Gabala, Dagyolu street 15'
    },
    price: {
      daily: 300,
      weekly: 1800,
      monthly: 6500,
      currency: 'AZN'
    },
    rooms: 5,
    area: 320,
    amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'tv', 'washer', 'garden', 'bbq', 'security'],
    images: [
      'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'
    ],
    coordinates: { lat: 40.9815, lng: 47.8462 },
    owner: {
      name: 'Tural Babayev',
      phone: '+994556789012',
      email: 'tural@example.com'
    },
    rating: 4.7,
    reviews: 21
  },
  {
    id: '7',
    title: {
      az: 'Çimərlik evi - Nabran',
      ru: 'Пляжный дом - Набрань',
      en: 'Beach House - Nabran'
    },
    description: {
      az: 'Nabranda çimərlik evləri. Dənizə 50 metr məsafədə. Yay istirahəti üçün ən yaxşı seçim.',
      ru: 'Пляжные дома в Набрани. 50 метров до моря. Лучший выбор для летнего отдыха.',
      en: 'Beach houses in Nabran. 50 meters to sea. Best choice for summer vacation.'
    },
    type: 'house',
    district: 'nabran',
    address: {
      az: 'Nabran, Sahil zolağı 8',
      ru: 'Набрань, Прибрежная зона 8',
      en: 'Nabran, Coastal area 8'
    },
    price: {
      daily: 150,
      weekly: 900,
      monthly: 3500,
      currency: 'AZN'
    },
    rooms: 4,
    area: 180,
    amenities: ['beach', 'parking', 'wifi', 'ac', 'kitchen', 'tv', 'bbq'],
    images: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'
    ],
    coordinates: { lat: 41.7589, lng: 48.6631 },
    owner: {
      name: 'Fərid İsmayılov',
      phone: '+994707890123',
      email: 'farid@example.com'
    },
    rating: 4.3,
    reviews: 15
  },
  {
    id: '8',
    title: {
      az: 'Penthous - Bakı şəhəri',
      ru: 'Пентхаус - город Баку',
      en: 'Penthouse - Baku City'
    },
    description: {
      az: 'Bakının mərkəzində lüks penthous. Panoramik şəhər mənzərəsi, tam təchiz olunmuş.',
      ru: 'Роскошный пентхаус в центре Баку. Панорамный вид на город, полностью оборудован.',
      en: 'Luxury penthouse in Baku center. Panoramic city view, fully equipped.'
    },
    type: 'penthouse',
    district: 'baku',
    address: {
      az: 'Bakı, Neftçilər prospekti 95',
      ru: 'Баку, проспект Нефтяников 95',
      en: 'Baku, Neftchilar avenue 95'
    },
    price: {
      daily: 350,
      weekly: 2200,
      monthly: 8000,
      currency: 'AZN'
    },
    rooms: 4,
    area: 200,
    amenities: ['parking', 'wifi', 'ac', 'kitchen', 'tv', 'washer', 'gym', 'security'],
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800',
      'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=800'
    ],
    coordinates: { lat: 40.3699, lng: 49.8372 },
    owner: {
      name: 'Əhməd Rəhimov',
      phone: '+994518901234',
      email: 'ahmed@example.com'
    },
    rating: 4.8,
    reviews: 27
  },
  {
    id: '9',
    title: {
      az: 'Kiçik kottec - Pirşağı',
      ru: 'Небольшой коттедж - Пиршаги',
      en: 'Small Cottage - Pirshagi'
    },
    description: {
      az: 'Rahat kiçik kottec 2 nəfər üçün. Romantik istirahət üçün idealdır.',
      ru: 'Уютный небольшой коттедж для 2 человек. Идеально подходит для романтического отдыха.',
      en: 'Cozy small cottage for 2 people. Perfect for romantic getaway.'
    },
    type: 'cottage',
    district: 'pirshagi',
    address: {
      az: 'Pirşağı qəsəbəsi, Gül küçəsi 12',
      ru: 'поселок Пиршаги, улица Гюль 12',
      en: 'Pirshagi village, Gul street 12'
    },
    price: {
      daily: 80,
      weekly: 500,
      monthly: 1800,
      currency: 'AZN'
    },
    rooms: 2,
    area: 80,
    amenities: ['wifi', 'ac', 'kitchen', 'tv', 'garden'],
    images: [
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800',
      'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800',
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800'
    ],
    coordinates: { lat: 40.5089, lng: 50.2145 },
    owner: {
      name: 'Günel Əliyeva',
      phone: '+994559012345',
      email: 'gunel@example.com'
    },
    rating: 4.5,
    reviews: 9
  },
  {
    id: '10',
    title: {
      az: 'Böyük ailə villası - Zaqulba',
      ru: 'Большая семейная вилла - Загульба',
      en: 'Large Family Villa - Zagulba'
    },
    description: {
      az: 'Böyük ailələr üçün geniş villa. 7 yataq otağı, 2 hovuz, böyük bağ ərazisi.',
      ru: 'Просторная вилла для больших семей. 7 спален, 2 бассейна, большая садовая территория.',
      en: 'Spacious villa for large families. 7 bedrooms, 2 pools, large garden area.'
    },
    type: 'villa',
    district: 'zagulba',
    address: {
      az: 'Zaqulba qəsəbəsi, Yaşıl küçə 34',
      ru: 'поселок Загульба, улица Яшиль 34',
      en: 'Zagulba village, Yashil street 34'
    },
    price: {
      daily: 500,
      weekly: 3000,
      monthly: 11000,
      currency: 'AZN'
    },
    rooms: 7,
    area: 520,
    amenities: ['pool', 'parking', 'wifi', 'ac', 'kitchen', 'tv', 'washer', 'garden', 'bbq', 'security', 'gym'],
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'
    ],
    coordinates: { lat: 40.5567, lng: 50.0012 },
    owner: {
      name: 'Samir Quliyev',
      phone: '+994700123456',
      email: 'samir@example.com'
    },
    rating: 4.9,
    reviews: 35
  },
  {
    id: '11',
    title: {
      az: 'Studiya mənzil - Bakı',
      ru: 'Квартира-студия - Баку',
      en: 'Studio Apartment - Baku'
    },
    description: {
      az: 'Kompakt studiya mənzil iş səfərləri üçün. Metro yaxınlığında, tam təchiz olunmuş.',
      ru: 'Компактная квартира-студия для деловых поездок. Рядом с метро, полностью оборудована.',
      en: 'Compact studio apartment for business trips. Near metro, fully equipped.'
    },
    type: 'apartment',
    district: 'baku',
    address: {
      az: 'Bakı, 28 May küçəsi 33',
      ru: 'Баку, улица 28 Мая 33',
      en: 'Baku, 28 May street 33'
    },
    price: {
      daily: 60,
      weekly: 350,
      monthly: 1200,
      currency: 'AZN'
    },
    rooms: 1,
    area: 45,
    amenities: ['wifi', 'ac', 'kitchen', 'tv', 'washer'],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'
    ],
    coordinates: { lat: 40.3782, lng: 49.8486 },
    owner: {
      name: 'Aynur Həsənova',
      phone: '+994511234567',
      email: 'aynur@example.com'
    },
    rating: 4.2,
    reviews: 14
  },
  {
    id: '12',
    title: {
      az: 'Romantik kottec - Mərdəkan',
      ru: 'Романтический коттедж - Мардакян',
      en: 'Romantic Cottage - Mardakan'
    },
    description: {
      az: 'Cütlüklər üçün xüsusi dizayn edilmiş kottec. Şam yeməyi üçün veranda, jakuzi.',
      ru: 'Коттедж специально разработан для пар. Веранда для ужина при свечах, джакузи.',
      en: 'Cottage specially designed for couples. Veranda for candlelit dinner, jacuzzi.'
    },
    type: 'cottage',
    district: 'mardakan',
    address: {
      az: 'Mərdəkan qəsəbəsi, Ulduz küçəsi 7',
      ru: 'поселок Мардакян, улица Улдуз 7',
      en: 'Mardakan village, Ulduz street 7'
    },
    price: {
      daily: 200,
      weekly: 1200,
      monthly: 4500,
      currency: 'AZN'
    },
    rooms: 2,
    area: 120,
    amenities: ['pool', 'wifi', 'ac', 'kitchen', 'tv', 'garden', 'security'],
    images: [
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800',
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800',
      'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800'
    ],
    coordinates: { lat: 40.5298, lng: 50.1567 },
    owner: {
      name: 'Vüsal Cəfərov',
      phone: '+994702345678',
      email: 'vusal@example.com'
    },
    rating: 4.7,
    reviews: 19
  }
]

// Mock user listings for dashboard
export const mockUserListings: UserListing[] = [
  {
    id: '1',
    propertyId: '1',
    status: 'active',
    views: 245,
    inquiries: 12,
    createdAt: '2024-01-15',
    updatedAt: '2024-02-01'
  },
  {
    id: '2',
    propertyId: '3',
    status: 'active',
    views: 156,
    inquiries: 8,
    createdAt: '2024-01-20',
    updatedAt: '2024-01-28'
  },
  {
    id: '3',
    propertyId: '5',
    status: 'pending',
    views: 0,
    inquiries: 0,
    createdAt: '2024-02-05',
    updatedAt: '2024-02-05'
  }
]

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
  }
): Property[] => {
  return properties.filter(property => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = Object.values(property.title).some(t => t.toLowerCase().includes(searchLower))
      const matchesAddress = Object.values(property.address).some(a => a.toLowerCase().includes(searchLower))
      if (!matchesTitle && !matchesAddress) return false
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

    return true
  })
}

export const propertyTypes: PropertyType[] = ['villa', 'apartment', 'house', 'cottage', 'penthouse']

export const districts: District[] = [
  'mardakan', 'novkhani', 'buzovna', 'bilgah', 'zagulba',
  'pirshagi', 'shuvalan', 'baku', 'nabran', 'gabala'
]

export const amenitiesList: Amenity[] = [
  'pool', 'parking', 'wifi', 'ac', 'kitchen', 'tv',
  'washer', 'garden', 'bbq', 'security', 'beach', 'gym'
]
