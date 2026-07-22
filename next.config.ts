import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin (and its Google Cloud dependencies) must run as real Node modules,
  // not get bundled by Turbopack — bundling it breaks class inheritance in its
  // transitive deps (google-gax/protobufjs) with an opaque "Class extends value
  // undefined" error at build time.
  serverExternalPackages: ['firebase-admin'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
}

export default createNextIntlPlugin('./src/messages/request.ts')(nextConfig)
