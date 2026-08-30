import {LOCALES} from '@/lib/locale-routes'

const SITE_URL = 'https://birklik.az'

/**
 * Разметка самой площадки: кто мы такие и что это за сайт.
 *
 * Ставится на каждой странице, потому что описывает не страницу, а организацию.
 * До неё разметка была только у объявлений — Google видел карточки жилья, но не
 * понимал, чьи они и что за сайт их показывает. Именно из Organization
 * собирается «панель знаний» с логотипом, телефоном и ссылками на соцсети, и
 * она же связывает домен с названием: без неё «Birklik» для поисковика просто
 * слово в заголовке, а не сущность.
 *
 * Тем же куском кормятся сборщики данных для ИИ-поиска. Ответ вида «Birklik.az —
 * это площадка посуточной аренды в Азербайджане» модель берёт из связного
 * описания, а не из вёрстки: разобрать сетку карточек ей несравнимо труднее.
 *
 * @id у обоих узлов не случаен: он позволяет ссылаться на организацию из
 * разметки объявлений, не повторяя её целиком.
 */
export function SiteJsonLd() {
  const organizationId = `${SITE_URL}/#organization`

  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'Birklik.az',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/brand/generated/logo-512x128.png`,
        width: 512,
        height: 128
      },
      // Идентификатор налогоплательщика — сильный сигнал, что за сайтом стоит
      // зарегистрированное лицо, а не однодневка. Тот же номер напечатан в
      // подвале, расхождения быть не должно.
      taxID: '2906348882',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Cəfər Xəndan küçəsi 54B, 3068-ci məhəllə',
        addressLocality: 'Bakı',
        addressRegion: 'Binəqədi',
        addressCountry: 'AZ'
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: '+994998888226',
        email: 'info@birklik.az',
        areaServed: 'AZ',
        availableLanguage: ['az', 'ru', 'en']
      },
      // Только те профили, в которых уверены. Ссылка на несуществующую страницу
      // в sameAs хуже её отсутствия: она рвёт связь сущности вместо того, чтобы
      // её подтвердить.
      sameAs: ['https://www.facebook.com/Birklik.az/']
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Birklik.az',
      publisher: {'@id': organizationId},
      inLanguage: [...LOCALES]
    }
  ]

  return (
    <script
      type="application/ld+json"
      // Экранируем < по той же причине, что и в разметке объявления: строка
      // вида </script> внутри значения закрыла бы тег раньше времени.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({'@context': 'https://schema.org', '@graph': graph}).replace(
          /</g,
          '\\u003c'
        )
      }}
    />
  )
}
