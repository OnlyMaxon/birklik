'use client'

import {NextIntlClientProvider} from 'next-intl'
import {AuthProvider, LanguageProvider} from '@/components/providers'
import {AppClientEffects} from '@/components/app-client-effects'
import type {AbstractIntlMessages} from 'next-intl'
import type {User} from '@/types'

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
  /** Вошедший по данным сервера — чтобы шапка не мигала гостем. */
  initialUser?: User | null
  initialEmailVerified?: boolean
}

export function Providers({
  children,
  locale,
  messages,
  initialUser = null,
  initialEmailVerified = false
}: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageProvider>
        <AuthProvider initialUser={initialUser} initialEmailVerified={initialEmailVerified}>
          <AppClientEffects />
          {children}
        </AuthProvider>
      </LanguageProvider>
    </NextIntlClientProvider>
  )
}
