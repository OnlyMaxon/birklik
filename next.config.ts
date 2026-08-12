import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
}

export default createNextIntlPlugin('./src/messages/request.ts')(nextConfig)
