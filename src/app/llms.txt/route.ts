import {getCitiesWithListings} from '@/app/queries'
import {cityFromSlug, cityLandingPath, localizedCityName} from '@/lib/city-landing'

const SITE_URL = 'https://birklik.az'

// Собирается по запросу, как и карта сайта: список регионов и число объявлений
// меняются, а запечённый в сборку файл устарел бы к первому же новому региону.
// Ключ сервис-аккаунта на время сборки прячется (scripts/cf-build.mjs), так что
// пререндер тут всё равно дал бы пустой список.
export const dynamic = 'force-dynamic'

/**
 * llms.txt — краткая выжимка о сайте для языковых моделей.
 *
 * Соглашение молодое и обязательным ни для кого не является, но стоит дёшево, а
 * решает настоящую проблему: наши страницы — это сетки карточек, собранные
 * скриптами. Модель, которой досталась такая страница, тратит весь свой лимит
 * на разбор вёрстки и часто не добирается до сути. Здесь та же суть лежит
 * связным текстом: что за площадка, в каких регионах, куда идти за списком.
 *
 * Дополняет разметку Schema.org, а не заменяет её: разметку читают поисковые
 * роботы, этот файл — те, кто пришёл за текстом.
 */
export async function GET() {
  let regions: Array<{city: string; count: number}> = []
  try {
    regions = await getCitiesWithListings()
  } catch (error) {
    // Firestore недоступен — отдаём файл без списка регионов. Описание площадки
    // ценно и само по себе, а молчать об ошибке нельзя: ровно проглоченная
    // ошибка однажды скрыла, что карта сайта собирается пустой.
    console.error('[llms.txt] не удалось получить регионы:', error)
  }

  const regionLines = regions
    .map(entry => ({option: cityFromSlug(entry.city.toLowerCase()), count: entry.count}))
    .filter((entry): entry is {option: NonNullable<typeof entry.option>; count: number} =>
      entry.option !== undefined
    )
    .map(({option, count}) => {
      const az = localizedCityName(option, 'az')
      const ru = localizedCityName(option, 'ru')
      const url = `${SITE_URL}${cityLandingPath(option.value)}`
      return `- [${az} / ${ru}](${url}): ${count} active listings`
    })

  const total = regions.reduce((sum, entry) => sum + entry.count, 0)

  const body = `# Birklik.az

> Birklik.az is a marketplace for short-term and daily house rentals in Azerbaijan:
> country houses, villas, cottages and holiday venues. Guests browse listings and
> contact owners directly. The site is published in Azerbaijani (default), Russian
> and English.

Common names for what the site offers: "günlük kirayə ev", "günlük kirayə evlər",
"gunluk kiraye ev" (without diacritics), "аренда дома посуточно",
"аренда дома на день", "daily house rental", "house rental for one day".

Operated by Birklik.az, tax ID (VÖEN) 2906348882, Baku, Azerbaijan.
Contact: info@birklik.az, +994 99 888 82 26.

## Languages

- [Azerbaijani (default)](${SITE_URL}/)
- [Russian](${SITE_URL}/ru)
- [English](${SITE_URL}/en)

## Regions${total > 0 ? ` (${total} active listings)` : ''}

${regionLines.length > 0 ? regionLines.join('\n') : '- Listing data is temporarily unavailable.'}

## Key pages

- [All listings](${SITE_URL}/): search by region, dates, guests, price and amenities
- [About](${SITE_URL}/about): what the platform is and how it works
- [Contact](${SITE_URL}/contact): phone, email, address and social profiles
- [Terms](${SITE_URL}/terms) and [Privacy](${SITE_URL}/privacy)
- [Sitemap](${SITE_URL}/sitemap.xml): every indexable page, in all three languages

## Notes

- Each listing lives at /property/<id> and carries schema.org Accommodation markup
  with price, capacity, amenities and coordinates.
- Listing pages are not translated: the text is whatever the owner wrote. Only the
  interface and the landing pages exist in three languages.
- Prices are in AZN and quoted per night.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Меняется файл редко, а запрашивают его редкие гости — час на кромке
      // снимает нагрузку и при этом не даёт списку регионов устареть надолго.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  })
}
