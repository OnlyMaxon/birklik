export type Language = 'az' | 'en' | 'ru'

export interface Translations {
  site: {
    name: string
    tagline: string
  }
  nav: {
    home: string
    search: string
    login: string
    register: string
    dashboard: string
    logout: string
    myListings: string
    addListing: string
  }
  search: {
    placeholder: string
    button: string
    filters: string
    priceRange: string
    rooms: string
    pool: string
    propertyType: string
    district: string
    minPrice: string
    maxPrice: string
    any: string
    yes: string
    no: string
    clearFilters: string
  }
  property: {
    perNight: string
    perWeek: string
    perMonth: string
    rooms: string
    description: string
    amenities: string
    location: string
    contact: string
    book: string
    gallery: string
    address: string
    area: string
    sqm: string
  }
  amenities: {
    pool: string
    parking: string
    wifi: string
    ac: string
    kitchen: string
    tv: string
    washer: string
    garden: string
    bbq: string
    security: string
    beach: string
    gym: string
  }
  propertyTypes: {
    villa: string
    apartment: string
    house: string
    cottage: string
    penthouse: string
  }
  districts: {
    mardakan: string
    novkhani: string
    buzovna: string
    bilgah: string
    zagulba: string
    pirshagi: string
    shuvalan: string
    baku: string
    nabran: string
    gabala: string
  }
  auth: {
    login: string
    register: string
    email: string
    password: string
    confirmPassword: string
    fullName: string
    phone: string
    rememberMe: string
    forgotPassword: string
    noAccount: string
    hasAccount: string
    loginSuccess: string
    registerSuccess: string
  }
  dashboard: {
    welcome: string
    myListings: string
    addListing: string
    profile: string
    settings: string
    noListings: string
    listingAdded: string
    edit: string
    delete: string
    active: string
    pending: string
  }
  form: {
    title: string
    description: string
    price: string
    address: string
    rooms: string
    guests: string
    area: string
    photos: string
    selectType: string
    selectDistrict: string
    selectAmenities: string
    submit: string
    cancel: string
    required: string
  }
  footer: {
    about: string
    contact: string
    terms: string
    privacy: string
    copyright: string
  }
  messages: {
    contactSuccess: string
    noResults: string
    loading: string
    error: string
  }
  hero: {
    title: string
    subtitle: string
  }
  pricing: {
    free: string
    standard: string
    premium: string
    freeDesc: string
    standardDesc: string
    premiumDesc: string
    perMonth: string
  }
  validation: {
    emailInvalid: string
    phoneRequired: string
    photoLimit: string
    descriptionTooLong: string
    addressRequired: string
    typeRequired: string
    districtRequired: string
    priceRequired: string
    roomsRequired: string
  }
  pricing_info: {
    free_features: string
    standard_features: string
    premium_features: string
    premium_highlight: string
  }
  support: {
    waitingForReview: string
    listed: string
    contactSupport: string
  }
  testData: {
    addTest: string
    removeTest: string
    testListings: string
  }
  home: {
    showMap: string
    hideMap: string
    topListingsTitle: string
    plansTitle: string
    plansSubtitle: string
    plansNote: string
    ctaTitle: string
    ctaSubtitle: string
  }
}
