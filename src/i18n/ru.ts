import { Translations } from '../types'

export const ru: Translations = {
  site: {
    name: "Birklik.az",
    tagline: "Аренда жилья в Азербайджане"
  },
  nav: {
    home: "Главная",
    search: "Поиск",
    login: "Войти",
    register: "Регистрация",
    dashboard: "Личный кабинет",
    logout: "Выйти",
    myListings: "Мои объявления",
    addListing: "Добавить объявление"
  },
  search: {
    placeholder: "Введите местоположение, район или адрес...",
    button: "Искать",
    filters: "Фильтры",
    priceRange: "Диапазон цен",
    rooms: "Количество комнат",
    pool: "Бассейн",
    propertyType: "Тип жилья",
    district: "Район",
    minPrice: "Мин. цена",
    maxPrice: "Макс. цена",
    any: "Все",
    yes: "Есть",
    no: "Нет",
    clearFilters: "Сбросить фильтры"
  },
  property: {
    perNight: "ночь",
    perWeek: "неделя",
    perMonth: "месяц",
    rooms: "комнат",
    description: "Описание",
    amenities: "Удобства",
    location: "Расположение",
    contact: "Контакты",
    book: "Забронировать",
    gallery: "Галерея",
    address: "Адрес",
    area: "Площадь",
    sqm: "м²"
  },
  amenities: {
    pool: "Бассейн",
    parking: "Парковка",
    wifi: "Wi-Fi",
    ac: "Кондиционер",
    kitchen: "Кухня",
    tv: "Телевизор",
    washer: "Стиральная машина",
    garden: "Сад",
    bbq: "Мангал",
    security: "Охрана",
    beach: "Пляж",
    gym: "Спортзал"
  },
  propertyTypes: {
    villa: "Вилла",
    apartment: "Квартира",
    house: "Дом",
    cottage: "Коттедж",
    penthouse: "Пентхаус"
  },
  districts: {
    mardakan: "Мардакян",
    novkhani: "Новханы",
    buzovna: "Бузовна",
    bilgah: "Бильгях",
    zagulba: "Загульба",
    pirshagi: "Пиршаги",
    shuvalan: "Шувелан",
    baku: "Баку",
    nabran: "Набрань",
    gabala: "Габала"
  },
  auth: {
    login: "Войти",
    register: "Регистрация",
    email: "Эл. почта",
    password: "Пароль",
    confirmPassword: "Подтвердите пароль",
    fullName: "Полное имя",
    phone: "Телефон",
    rememberMe: "Запомнить меня",
    forgotPassword: "Забыли пароль?",
    noAccount: "Нет аккаунта?",
    hasAccount: "Уже есть аккаунт?",
    loginSuccess: "Вы успешно вошли!",
    registerSuccess: "Регистрация успешно завершена!"
  },
  dashboard: {
    welcome: "Добро пожаловать",
    myListings: "Мои объявления",
    addListing: "Добавить объявление",
    profile: "Профиль",
    settings: "Настройки",
    noListings: "Вы ещё не добавили объявлений",
    listingAdded: "Объявление успешно добавлено (mock)",
    edit: "Редактировать",
    delete: "Удалить",
    active: "Активно",
    pending: "На модерации"
  },
  form: {
    title: "Заголовок",
    description: "Описание",
    price: "Цена",
    address: "Адрес",
    rooms: "Количество комнат",
    area: "Площадь (м²)",
    photos: "Фотографии",
    selectType: "Выберите тип",
    selectDistrict: "Выберите район",
    selectAmenities: "Выберите удобства",
    submit: "Отправить",
    cancel: "Отмена",
    required: "Обязательное поле"
  },
  footer: {
    about: "О нас",
    contact: "Контакты",
    terms: "Правила",
    privacy: "Конфиденциальность",
    copyright: "© 2026 Birklik.az. Все права защищены."
  },
  messages: {
    contactSuccess: "Ваша заявка принята! Мы свяжемся с вами в ближайшее время (mock)",
    noResults: "Ничего не найдено",
    loading: "Загрузка...",
    error: "Произошла ошибка"
  },
  hero: {
    title: "Найдите идеальный дом для отдыха в Азербайджане",
    subtitle: "Виллы, коттеджи и квартиры — по лучшим ценам"
  },
  pricing: {
    free: "Бесплатно",
    standard: "Стандарт",
    premium: "Премиум",
    freeDesc: "Для начинающих",
    standardDesc: "Для малого бизнеса",
    premiumDesc: "Профессиональный сервис",
    perMonth: "/месяц"
  },
  validation: {
    emailInvalid: "Введите корректный адрес электронной почты",
    phoneRequired: "Требуется номер телефона",
    photoLimit: "Максимум 4 фото для бесплатного тарифа",
    descriptionTooLong: "Описание не должно превышать 35 слов",
    addressRequired: "Адрес обязателен для Стандарта и Премиума",
    typeRequired: "Выберите тип недвижимости",
    districtRequired: "Выберите район",
    priceRequired: "Введите цену",
    roomsRequired: "Укажите количество комнат"
  },
  pricing_info: {
    free_features: "4 фото, короткое описание, скрытое местоположение",
    standard_features: "20 фото, полное описание, видимое местоположение",
    premium_features: "Неограниченные фото, на главной странице 3 недели",
    premium_highlight: "✓ На главной странице 3 недели"
  },
  support: {
    waitingForReview: "Объявление на модерации - служба поддержки свяжется с вами",
    listed: "Ваше объявление активно",
    contactSupport: "Связаться с поддержкой"
  },
  testData: {
    addTest: "Добавить тестовые данные",
    removeTest: "Удалить тестовые данные",
    testListings: "Тестовые объявления"
  },
  home: {
    showMap: "Показать карту",
    hideMap: "Скрыть карту",
    topListingsTitle: "Популярные виллы и дома для отдыха",
    plansTitle: "3 тарифа размещения",
    plansSubtitle: "Выберите подходящий тариф и публикуйте объявления эффективнее.",
    plansNote: "Условия тарифов могут обновляться в зависимости от спроса на рынке.",
    ctaTitle: "Все готово в один клик",
    ctaSubtitle: "Разместите дом сегодня и начните получать бронирования."
  }
}
