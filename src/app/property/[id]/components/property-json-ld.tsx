import type {Property} from '@/types'

const SITE_URL = 'https://birklik.az'

/**
 * Разметка Schema.org для страницы объявления.
 *
 * Даёт Google расширенный сниппет: цена за ночь, рейтинг и фото прямо в
 * выдаче. Тип Accommodation описывает жильё, вложенный Offer — условия аренды.
 *
 * Каждое поле выводится только когда данные действительно есть: разметка,
 * обещающая рейтинг которого нет, приводит к тому, что Google перестаёт
 * доверять ей целиком.
 */
export function PropertyJsonLd({property, title, description, cityName, cityPath}: {
  property: Property
  title: string
  description: string
  /** Название региона на языке страницы — для хлебных крошек. */
  cityName?: string
  /** Адрес посадочной страницы региона; без него крошки не строим. */
  cityPath?: string
}) {
  const url = `${SITE_URL}/property/${property.id}`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    '@id': url,
    url,
    name: title,
    numberOfRooms: property.rooms,
    occupancy: {
      '@type': 'QuantitativeValue',
      minValue: property.minGuests,
      maxValue: property.maxGuests,
      unitText: 'person'
    }
  }

  if (description) jsonLd.description = description
  if (property.images?.length) jsonLd.image = property.images.slice(0, 10)

  if (property.area) {
    jsonLd.floorSize = {'@type': 'QuantitativeValue', value: property.area, unitCode: 'MTK'}
  }

  if (property.city || property.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressCountry: 'AZ',
      ...(property.city ? {addressLocality: property.city} : {}),
      ...(property.address?.az ? {streetAddress: property.address.az} : {})
    }
  }

  if (property.coordinates?.lat && property.coordinates?.lng) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: property.coordinates.lat,
      longitude: property.coordinates.lng
    }
  }

  if (property.amenities?.length) {
    jsonLd.amenityFeature = property.amenities.map(amenity => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true
    }))
  }

  if (property.price?.daily) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: property.price.daily,
      priceCurrency: property.price.currency || 'AZN',
      availability: 'https://schema.org/InStock',
      url
    }
  }

  // Рейтинг показываем только при живых отзывах: Google отвергает разметку,
  // где ratingCount равен нулю.
  if (property.rating && property.reviews) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: property.rating,
      reviewCount: property.reviews,
      bestRating: 5,
      worstRating: 1
    }
  }

  // Хлебные крошки отдельным узлом: в выдаче они превращают голый адрес в
  // строку «birklik.az › Qəbələ › <объявление>» и показывают поисковику, что
  // объявление принадлежит региону. Без города цепочку не строим — крошки из
  // одного звена бессмысленны.
  const breadcrumbs = cityName && cityPath
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {'@type': 'ListItem', position: 1, name: 'Birklik.az', item: SITE_URL},
          {'@type': 'ListItem', position: 2, name: cityName, item: `${SITE_URL}${cityPath}`},
          {'@type': 'ListItem', position: 3, name: title, item: url}
        ]
      }
    : null

  return (
    <>
    {breadcrumbs && (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, '\\u003c')
        }}
      />
    )}
    <script
      type="application/ld+json"
      // Разметка собирается из наших же данных и сериализуется JSON.stringify,
      // но экранируем < на случай угловых скобок в заголовке или описании:
      // иначе строка вида </script> внутри текста закрыла бы тег раньше времени.
      dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')}}
    />
    </>
  )
}
