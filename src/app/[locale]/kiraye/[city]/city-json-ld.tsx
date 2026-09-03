import type {Language, Property} from '@birklik/core/types'
import {LOCALES, localizePath, type LocaleCode} from '@/lib/locale-routes'

const SITE_URL = 'https://birklik.az'

// Больше сотни узлов в разметке Google всё равно не разбирает, а вес страницы
// растёт заметно. Первых объявлений хватает, чтобы показать, что это список.
const MAX_ITEMS = 50

/**
 * Разметка посадочной страницы региона: хлебные крошки и список объявлений.
 *
 * Крошки дают в выдаче строку «birklik.az › Qəbələ» вместо голого адреса и
 * объясняют поисковику вложенность — без них страница региона выглядит
 * оторванной от главной, хотя ссылка на неё стоит в подвале каждой страницы.
 *
 * ItemList сообщает, что перед нами именно перечень предложений, и сколько их.
 * Сама сетка карточек об этом не говорит ничего: для разбора это просто набор
 * ссылок с картинками. Отсюда же ИИ-поиск берёт ответ на вопрос вида «что
 * сдаётся в Габале» — по связному списку, а не по вёрстке.
 */
export function CityJsonLd({
  properties,
  cityName,
  cityPath,
  locale
}: {
  properties: Property[]
  cityName: string
  cityPath: string
  locale: string
}) {
  const localeCode = (LOCALES as readonly string[]).includes(locale)
    ? (locale as LocaleCode)
    : undefined
  const pageUrl = `${SITE_URL}${localeCode ? localizePath(cityPath, localeCode) : cityPath}`

  const graph = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Birklik.az',
          item: `${SITE_URL}${localeCode ? localizePath('/', localeCode) : '/'}`
        },
        {'@type': 'ListItem', position: 2, name: cityName, item: pageUrl}
      ]
    },
    {
      '@type': 'ItemList',
      url: pageUrl,
      name: cityName,
      // Полное число, даже когда выведены не все: numberOfItems описывает
      // список целиком, itemListElement — показанную часть.
      numberOfItems: properties.length,
      itemListElement: properties.slice(0, MAX_ITEMS).map((property, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/property/${property.id}`,
        // Заголовок хранится сразу на трёх языках. Берём язык страницы, с
        // откатом на азербайджанский: у части старых объявлений переводов нет.
        name: property.title?.[(localeCode ?? 'az') as Language] || property.title?.az
      }))
    }
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({'@context': 'https://schema.org', '@graph': graph}).replace(
          /</g,
          '\\u003c'
        )
      }}
    />
  )
}
