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

  const [common, dashboard, app] = await Promise.all([
    import(`../messages/${locale}/common.json`).then(module => module.default),
    import(`../messages/${locale}/dashboard.json`).then(module => module.default),
    import(`../messages/${locale}/app.json`).then(module => module.default)
  ])

  return {locale, messages: {...common, ...dashboard, ...app}}
})
