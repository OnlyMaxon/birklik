import { Translations } from '../types'

export const ru: Translations = {
  site: {
    name: 'Birklik.az',
    tagline: 'Аренда домов в Азербайджане'
  },
  nav: {
    home: 'Главная',
    search: 'Поиск',
    login: 'Войти',
    register: 'Регистрация',
    dashboard: 'Кабинет',
    logout: 'Выйти',
    myListings: 'Мои объявления',
    addListing: 'Добавить объявление'
  },
  search: {
    placeholder: 'Введите локацию, район или адрес...',
    button: 'Искать',
    filters: 'Фильтры',
    priceRange: 'Диапазон цен',
    rooms: 'Комнаты',
    pool: 'Бассейн',
    propertyType: 'Тип жилья',
    district: 'Район',
    minPrice: 'Мин. цена',
    maxPrice: 'Макс. цена',
    any: 'Любой',
    yes: 'Да',
    no: 'Нет',
    clearFilters: 'Сбросить фильтры'
  },
  property: {
    perNight: 'ночь',
    perWeek: 'неделя',
    perMonth: 'месяц',
    rooms: 'комнат',
    description: 'Описание',
    amenities: 'Удобства',
    location: 'Локация',
    contact: 'Контакты',
    book: 'Забронировать',
    gallery: 'Галерея',
    address: 'Адрес',
    area: 'Площадь',
    sqm: 'м²'
  },
  amenities: {
    pool: 'Бассейн',
    parking: 'Парковка',
    wifi: 'Wi-Fi',
    ac: 'Кондиционер',
    kitchen: 'Кухня',
    tv: 'Телевизор',
    washer: 'Стиральная машина',
    garden: 'Сад',
    bbq: 'Мангал',
    security: 'Охрана',
    beach: 'Пляж',
    gym: 'Спортзал'
  },
  propertyTypes: {
    villa: 'Вилла',
    apartment: 'Квартира',
    house: 'Баг эви',
    cottage: 'Коттедж',
    penthouse: 'Пентхаус'
  },
  districts: {
    mardakan: 'Мардакан',
    novkhani: 'Новханы',
    buzovna: 'Бузовна',
    bilgah: 'Бильгя',
    zagulba: 'Загульба',
    pirshagi: 'Пиршаги',
    shuvalan: 'Шувалан',
    baku: 'Баку',
    nabran: 'Набрань',
    gabala: 'Габала'
  },
  auth: {
    login: 'Войти',
    register: 'Регистрация',
    email: 'Email',
    password: 'Пароль',
    confirmPassword: 'Подтвердите пароль',
    fullName: 'Имя и фамилия',
    phone: 'Телефон',
    rememberMe: 'Запомнить меня',
    forgotPassword: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?',
    loginSuccess: 'Вы успешно вошли!',
    registerSuccess: 'Регистрация успешно завершена!'
  },
  dashboard: {
    welcome: 'Добро пожаловать',
    myListings: 'Мои объявления',
    addListing: 'Добавить объявление',
    profile: 'Профиль',
    settings: 'Настройки',
    noListings: 'Вы еще не добавили объявления',
    listingAdded: 'Объявление успешно добавлено',
    edit: 'Редактировать',
    delete: 'Удалить',
    active: 'Активно',
    pending: 'На модерации'
  },
  form: {
    title: 'Заголовок',
    description: 'Описание',
    price: 'Цена',
    address: 'Адрес',
    rooms: 'Количество комнат',
    minGuests: 'Мин гостей',
    maxGuests: 'Макс гостей',
    area: 'Площадь (м²)',
    photos: 'Фото',
    selectType: 'Выберите тип',
    selectDistrict: 'Выберите район',
    selectAmenities: 'Выберите удобства',
    submit: 'Отправить',
    cancel: 'Отмена',
    required: 'Обязательное поле'
  },
  footer: {
    about: 'О нас',
    contact: 'Контакты',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    copyright: '© 2026 Birklik.az. Все права защищены.'
  },
  messages: {
    contactSuccess: 'Заявка получена! Мы скоро свяжемся с вами.',
    noResults: 'Ничего не найдено',
    loading: 'Загрузка...',
    error: 'Произошла ошибка'
  },
  hero: {
    title: 'Идеальный отдых в Азербайджане начинается здесь',
    subtitle: 'Виллы, коттеджи и апартаменты по лучшим ценам'
  },
  pricing: {
    free: 'Бесплатный',
    standard: 'Стандарт',
    premium: 'Премиум',
    freeDesc: 'Для старта',
    standardDesc: 'Для малого бизнеса',
    premiumDesc: 'Профессиональный уровень',
    perMonth: '/месяц'
  },
  validation: {
    emailInvalid: 'Введите корректный email',
    phoneRequired: 'Требуется номер телефона',
    photoLimit: 'Максимум 4 фото для бесплатного тарифа',
    descriptionTooLong: 'Описание не более 35 слов',
    addressRequired: 'Для Standard и Premium требуется адрес',
    typeRequired: 'Выберите тип жилья',
    districtRequired: 'Выберите район',
    priceRequired: 'Укажите цену',
    roomsRequired: 'Укажите количество комнат'
  },
  pricing_info: {
    free_features: '4 фото, короткое описание, скрытая локация',
    standard_features: '20 фото, полное описание, видимая локация',
    premium_features: 'Безлимит фото, приоритет 3 недели на главной',
    premium_highlight: '✓ 3 недели в приоритете на главной'
  },
  support: {
    waitingForReview: 'Объявление на проверке, с вами свяжется поддержка',
    listed: 'Ваше объявление активно',
    contactSupport: 'Связаться с поддержкой'
  },
  testData: {
    addTest: 'Добавить тестовые данные',
    removeTest: 'Удалить тестовые данные',
    testListings: 'Тестовые объявления'
  },
  home: {
    showMap: 'Показать карту',
    hideMap: 'Скрыть карту',
    topListingsTitle: 'Лучшие виллы и дома для отдыха',
    plansTitle: '3 тарифных плана',
    plansSubtitle: 'Выберите план под ваш бюджет и размещайте объявления эффективнее.',
    plansNote: 'Условия планов могут обновляться в зависимости от рынка.',
    ctaTitle: 'Все готово в один клик',
    ctaSubtitle: 'Разместите жилье сегодня и начните получать бронирования.'
  }
}
