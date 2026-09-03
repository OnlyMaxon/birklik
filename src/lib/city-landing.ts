import {cities, type CityOption} from '@birklik/core/data'
import type {Language} from '@birklik/core/types'

// Азербайджанское «kirayə» — аренда. Сегмент участвует в самом запросе, ради
// которого страницы и заводятся, поэтому латиницей и без диакритики: адреса
// с ə ломаются при копировании и в мессенджерах.
export const CITY_LANDING_SEGMENT = 'kiraye'

/** Адрес посадочной страницы города: Gabala → /kiraye/gabala. */
export const citySlug = (cityValue: string): string => cityValue.toLowerCase()

export const cityLandingPath = (cityValue: string): string =>
  `/${CITY_LANDING_SEGMENT}/${citySlug(cityValue)}`

/** Обратное преобразование. Неизвестный адрес — это 404, а не пустая страница. */
export const cityFromSlug = (slug: string): CityOption | undefined =>
  cities.find(city => citySlug(city.value) === slug.toLowerCase())

/** Название города на языке посетителя, с откатом на азербайджанский. */
export const localizedCityName = (city: CityOption, language: Language): string =>
  (language === 'en' ? city.en : language === 'ru' ? city.ru : city.az) || city.az
