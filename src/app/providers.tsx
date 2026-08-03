'use client'

import {NextIntlClientProvider} from 'next-intl'
import {AuthProvider, LanguageProvider} from '@/components/providers'
import {FirebaseClientGate} from '@/components/providers/firebase-client-gate'
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
        <FirebaseClientGate>
          <AuthProvider>
            <AppClientEffects />
            {children}
          </AuthProvider>
        </FirebaseClientGate>
      </LanguageProvider>
    </NextIntlClientProvider>
  )
}
