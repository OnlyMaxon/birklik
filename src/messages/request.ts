import {getRequestConfig} from 'next-intl/server'
import {cookies} from 'next/headers'
import {routing, type AppLocale} from './routing'

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const candidateLocale = requestedLocale ?? cookieLocale
  const locale = (routing.locales.includes(candidateLocale as never)
    ? candidateLocale!
    : routing.defaultLocale) as AppLocale

  // Переводы переехали в общий пакет — их же читает мобильное приложение.
  // Путь относительный, а не через `@birklik/core/messages/...`: внутри пути
  // стоит переменная, и сборщику нужно видеть каталог, чтобы собрать все три
  // языка. Через имя пакета с подстановкой он этого не умеет.
  const [common, dashboard, app] = await Promise.all([
    import(`../../core/src/messages/${locale}/common.json`).then(module => module.default),
    import(`../../core/src/messages/${locale}/dashboard.json`).then(module => module.default),
    import(`../../core/src/messages/${locale}/app.json`).then(module => module.default)
  ])

  return {locale, messages: {...common, ...dashboard, ...app}}
})
