import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import {LOCALE_PREFIXED_STATIC_PATHS} from './src/lib/locale-routes'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @birklik/core лежит подмодулем в core/ и отдаётся ИСХОДНИКАМИ на TypeScript,
  // без сборки: тот же код читает мобильное приложение, а собирать его дважды
  // под две разные среды незачем. Значит компилировать его должен Next.
  transpilePackages: ['@birklik/core'],
  // Адреса азербайджанской версии остаются без префикса — они уже
  // проиндексированы, и переезд на /az/ обнулил бы накопленное. Снаружи
  // `/about`, внутри `/az/about`; перенаправления нет, сразу 200.
  //
  // Источники перечислены поимённо, а не шаблоном с исключениями: под шаблон
  // однажды попадёт что-нибудь лишнее вроде /api или /dashboard, и заметить
  // это будет нечем. Заводя страницу под [locale], добавить её в
  // LOCALE_PREFIXED_STATIC_PATHS — оттуда правило возьмётся само.
  async rewrites() {
    return {
      beforeFiles: [
        {source: '/', destination: '/az'},
        ...LOCALE_PREFIXED_STATIC_PATHS.map(path => ({source: path, destination: `/az${path}`})),
        {source: '/kiraye/:city', destination: '/az/kiraye/:city'}
      ],
      afterFiles: [],
      fallback: []
    }
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
}

export default createNextIntlPlugin('./src/messages/request.ts')(nextConfig)
