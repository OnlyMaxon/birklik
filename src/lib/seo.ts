import type {Metadata} from 'next'

/**
 * Общая картинка для превью ссылки. Та же, что в шапке главной: своей
 * специально нарисованной обложки у сайта нет, а без картинки ссылка в
 * мессенджере разворачивается голой строкой.
 */
const OG_IMAGE = {url: '/hero.jpeg', width: 1920, height: 1080, alt: 'Birklik.az'}

/**
 * Собирает блок OpenGraph для страницы.
 *
 * Существует ради одной ловушки: Next объединяет метаданные не по полям, а по
 * верхнеуровневым ключам. Стоит странице объявить свой `openGraph`, и весь
 * родительский из корневого layout отбрасывается целиком — вместе с og:image,
 * og:site_name и og:type. На это уже наступили: главная получила свой заголовок
 * с описанием и осталась без картинки и названия сайта, хотя в layout они
 * заданы. Поэтому неизменная часть повторяется здесь, а не наследуется.
 */
export function openGraphFor({
  title,
  description,
  path,
  locale
}: {
  title: string
  description: string
  path: string
  locale: string
}): Metadata['openGraph'] {
  return {
    type: 'website',
    siteName: 'Birklik.az',
    images: [OG_IMAGE],
    title: `${title} | Birklik.az`,
    description,
    url: path,
    locale
  }
}
