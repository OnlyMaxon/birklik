'use client'

import React from 'react'
import {useAuth, useLanguage} from '@/components/providers'

/**
 * Полоса с причиной блокировки — то, что видит сам заблокированный человек.
 *
 * ⚠️ Без неё блокировка выглядит как поломка сайта: кнопки есть, нажатия ничего
 * не делают, объявления пропали с витрины. Человек звонит в поддержку с «у вас
 * всё сломалось», и разобраться с ним нечем. Поэтому причину решено
 * показывать — это выбор владельца площадки, а не техническая необходимость.
 *
 * ⚠️ Признак берётся из профиля в `AuthProvider`, а не из заявки в токене.
 * В заявке лежит только «да/нет» и попадает она туда с задержкой до часа, а
 * причина живёт в документе. Запрет при этом держится вовсе не на этой полосе:
 * его делают правила Firestore и проверка в `interactions.ts`. Полоса
 * ОБЪЯСНЯЕТ, а не запрещает, и спрятать её, подправив профиль, человек не
 * может — правила держат поля `blocked*` закрытыми.
 *
 * Показывается во всех закладках кабинета, а не в одной: человек приходит
 * туда, где у него перестало работать, и объяснение должно встретить его там.
 */
export const BlockedNotice: React.FC = () => {
  const {user} = useAuth()
  const {t} = useLanguage()

  if (!user?.blocked) return null

  return (
    <div className="blocked-notice" role="alert">
      <div className="blocked-notice-head">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <strong>{t.blocked.title}</strong>
      </div>

      <p className="blocked-notice-body">{t.blocked.body}</p>

      {user.blockedReason && (
        <p className="blocked-notice-reason">
          <span className="blocked-notice-label">{t.blocked.reasonLabel}:</span>{' '}
          {user.blockedReason}
        </p>
      )}

      <p className="blocked-notice-body">{t.blocked.listingsHidden}</p>

      <p className="blocked-notice-contact">
        {t.blocked.contact}{' '}
        <a href={`tel:${t.pages.contact.phoneNumber.replace(/\s/g, '')}`}>
          {t.pages.contact.phoneNumber}
        </a>
        {' · '}
        <a href={`mailto:${t.pages.contact.emailAddress}`}>{t.pages.contact.emailAddress}</a>
      </p>
    </div>
  )
}
