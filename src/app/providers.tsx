'use client'

import {NextIntlClientProvider} from 'next-intl'
import {AuthProvider, LanguageProvider} from '@/components/providers'
import {FirebaseClientGate} from '@/components/providers/firebase-client-gate'
import {AppClientEffects} from '@/components/app-client-effects'
import {ErrorBoundary} from '@/components/error-boundary'
import type {AbstractIntlMessages} from 'next-intl'

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
}

export function Providers({children, locale, messages}: ProvidersProps) {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}
