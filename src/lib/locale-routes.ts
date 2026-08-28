/**
 * Какие страницы живут под сегментом [locale], а какие нет.
 *
 * Локаль в адресе получили только те, где текст действительно переведён:
 * главная, разделы регионов и информационные страницы — там переведён
 * интерфейс, и это настоящий контент. Страницы объявлений оставлены снаружи
 * намеренно: их текст владельцы вводят один раз, во всех трёх языках он
 * одинаков, и три адреса дали бы дубликат. Личный кабинет, вход и оплата
 * закрыты в robots.txt — локаль в адресе им не нужна.
 *
 * Список читают три разных места: rewrites в next.config, обёртка ссылок и
 * карта сайта. Заводя новую страницу под [locale], добавить сюда — иначе
 * ссылки на неё потеряют язык.
 */
export const LOCALE_PREFIXED_STATIC_PATHS = [
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/user-agreement'
] as const

/** Префиксы разделов, у которых локализованы и вложенные адреса. */
export const LOCALE_PREFIXED_SECTIONS = ['/kiraye'] as const

export const LOCALES = ['az', 'en', 'ru'] as const
export type LocaleCode = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: LocaleCode = 'az'

/** Локализована ли страница по этому адресу (адрес — без языкового префикса). */
export function isLocalePrefixedPath(path: string): boolean {
  const clean = path.split('?')[0].split('#')[0]
  if (clean === '/') return true
  if ((LOCALE_PREFIXED_STATIC_PATHS as readonly string[]).includes(clean)) return true
  return LOCALE_PREFIXED_SECTIONS.some(
    section => clean === section || clean.startsWith(`${section}/`)
  )
}

/** Отрезает языковой префикс: /ru/about → /about, /ru → / */
export function stripLocalePrefix(path: string): string {
  for (const locale of LOCALES) {
    if (path === `/${locale}`) return '/'
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1)
  }
  return path
}

/** Какой язык задан прямо в адресе, если задан. */
export function localeFromPath(path: string): LocaleCode | undefined {
  return LOCALES.find(locale => path === `/${locale}` || path.startsWith(`/${locale}/`))
}

/**
 * Адрес страницы на нужном языке.
 *
 * Азербайджанский — без префикса: его адреса уже проиндексированы, и переезд
 * на /az/ обнулил бы накопленное. Нелокализованные страницы возвращаются как
 * есть: язык для них по-прежнему берётся из куки.
 */
/**
 * Блок alternates для метаданных: canonical на текущем языке плюс hreflang на
 * все остальные. Без hreflang три адреса выглядят для поисковика как три
 * несвязанные страницы с похожим текстом, то есть как дубликаты.
 *
 * `path` — адрес БЕЗ языкового префикса, например `/kiraye/gabala`.
 */
export function localeAlternates(path: string, locale: LocaleCode) {
  return {
    canonical: localizePath(path, locale),
    languages: Object.fromEntries([
      ...LOCALES.map(code => [code, localizePath(path, code)] as const),
      // x-default — куда отправлять тех, чей язык не подошёл ни под один.
      ['x-default', localizePath(path, DEFAULT_LOCALE)] as const
    ])
  }
}

export function localizePath(path: string, locale: LocaleCode): string {
  const base = stripLocalePrefix(path.split('?')[0].split('#')[0])
  const tail = path.slice(path.split('?')[0].split('#')[0].length)
  if (!isLocalePrefixedPath(base)) return `${base}${tail}`
  if (locale === DEFAULT_LOCALE) return `${base}${tail}`
  return `/${locale}${base === '/' ? '' : base}${tail}`
}
