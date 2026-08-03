'use client'

import {NextIntlClientProvider} from 'next-intl'
import {AuthProvider, LanguageProvider} from '@/components/providers'
import {AppClientEffects} from '@/components/app-client-effects'
import type {AbstractIntlMessages} from 'next-intl'

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
}

export function Providers({children, locale, messages}: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageProvider>
        <AuthProvider>
          <AppClientEffects />
          {children}
        </AuthProvider>
      </LanguageProvider>
    </NextIntlClientProvider>
  )
}
