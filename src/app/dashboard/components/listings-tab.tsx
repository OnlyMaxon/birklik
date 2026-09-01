'use client'

import {useState} from 'react'
import {Link} from '@/lib/navigation'
import {useLanguage} from '@/components/providers'
import {InlineSpinner, ListingRowsSkeleton} from '@/components'
import {cities, districtLabel} from '@/data'
import {deleteProperty, updateProperty} from '@/services'
import {isTierActive, isTierExpired, tierExpiresAt} from '@/utils/premium-helper'
import type {Language, Property} from '@/types'
import type {PaymentNotification} from './dashboard-types'

interface ListingsTabProps {
  listings: Property[]
  isLoading: boolean
  paymentNotification: PaymentNotification
  onAdd: () => void
  onEdit: (property: Property) => void
  onReload: () => Promise<void>
}

const getTodayISO = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const isOccupationExpired = (property: Property) => Boolean(property.unavailableTo && property.unavailableTo < getTodayISO())

/** Платный тариф объявления, если он вообще платный. */
const paidTierOf = (property: Property): 'vip' | 'premium' | null =>
  property.listingTier === 'vip' || property.listingTier === 'premium' ? property.listingTier : null

const tierLabel = (tier: 'vip' | 'premium') => (tier === 'vip' ? '👑 VIP' : '⭐ Premium')

export function ListingsTab({listings, isLoading, paymentNotification, onAdd, onEdit, onReload}: ListingsTabProps) {
  const {language, t} = useLanguage()
  const [actionError, setActionError] = useState('')
  const [busyListingId, setBusyListingId] = useState<string | null>(null)
  const [busyFrom, setBusyFrom] = useState('')
  const [busyTo, setBusyTo] = useState('')
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const isEnglish = language === 'en'
  const isRussian = language === 'ru'
  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const closeBusyModal = () => {
    setBusyListingId(null)
    setBusyFrom('')
    setBusyTo('')
  }

  const handleDelete = async (id: string) => {
    const question = isEnglish
      ? 'Delete this listing? This cannot be undone.'
      : isRussian
        ? 'Удалить объявление? Отменить это будет нельзя.'
        : 'Elanı silmək istəyirsiniz? Bunu geri qaytarmaq olmayacaq.'
    if (!window.confirm(question)) return
    if (!await deleteProperty(id)) {
      setActionError(t.messages.error)
      return
    }
    await onReload()
  }

  const handleOpenBusyModal = (property: Property) => {
    setBusyListingId(property.id)
    setBusyFrom(property.unavailableFrom || '')
    setBusyTo(property.unavailableTo || '')
  }

  const handleSetInactive = async () => {
    if (!busyListingId) return
    if (!busyFrom || !busyTo) {
      setActionError(t.dashboard.selectBothDates)
      return
    }
    if (busyFrom > busyTo) {
      setActionError(t.dashboard.startBeforeEnd)
      return
    }
    setIsSavingAvailability(true)
    setActionError('')
    const updated = await updateProperty(busyListingId, {isActive: false, unavailableFrom: busyFrom, unavailableTo: busyTo})
    setIsSavingAvailability(false)
    if (!updated) {
      setActionError(t.messages.error)
      return
    }
    closeBusyModal()
    await onReload()
  }

  const handleSetActive = async (id: string) => {
    setActionError('')
    if (!await updateProperty(id, {isActive: true, unavailableFrom: '', unavailableTo: ''})) {
      setActionError(t.messages.error)
      return
    }
    await onReload()
  }

  return (
    <>
      <div className="tab-content fade-in">
        <h2>{t.dashboard.myListings}</h2>
        {paymentNotification === 'success' && <div className="success-banner">{isEnglish ? '✅ Payment successful! Your listing has been sent for moderation.' : isRussian ? '✅ Оплата прошла! Объявление отправлено на модерацию.' : '✅ Ödəniş uğurlu oldu! Elan moderasiyaya göndərildi.'}</div>}
        {(paymentNotification === 'failed' || paymentNotification === 'error') && <div className="error-message">{isEnglish ? '❌ Payment failed. Your listing was not saved. Please try again.' : isRussian ? '❌ Оплата не прошла. Объявление не сохранено. Попробуйте снова.' : '❌ Ödəniş uğursuz oldu. Elan saxlanmadı. Yenidən cəhd edin.'}</div>}
        {actionError && <div className="error-message">{actionError}</div>}

        {isLoading ? (
          <ListingRowsSkeleton />
        ) : listings.filter(property => property.status !== 'draft').length > 0 ? (
          <div className="listings-list">
            {listings.filter(property => property.status !== 'draft').map(property => {
              const status = property.status || 'active'
              // Тарифная колонка раньше была написана целиком под premium: у VIP
              // не показывалось ни срока, ни предупреждения, ни кнопки продления —
              // продлить VIP из кабинета было попросту нечем.
              const paidTier = paidTierOf(property)
              const tierEndsAt = tierExpiresAt(property)
              const tierEndsLabel = tierEndsAt
                ? new Date(tierEndsAt).toLocaleDateString(isEnglish ? 'en-GB' : isRussian ? 'ru-RU' : 'az-Latn-AZ')
                : ''
              const isCurrentlyActive = property.isActive !== false || isOccupationExpired(property)
              const isPendingModeration = status === 'pending'
              const isInactivePremium = status === 'inactive'
              const statusLabel = isPendingModeration
                ? (isEnglish ? 'Pending moderation' : isRussian ? 'На модерации' : 'Moderasiyada gözləyir')
                : isInactivePremium
                  ? (isEnglish ? 'Hidden — premium expired' : isRussian ? 'Скрыто — истёк премиум' : 'Gizli — premium bitdi')
                  : isCurrentlyActive
                    ? (isEnglish ? 'Active' : isRussian ? 'Активно' : 'Aktiv')
                    : (isEnglish ? 'Temporarily hidden' : isRussian ? 'Временно скрыто' : 'Müvəqqəti gizli')
              const city = cities.find(item => item.value === property.city)
              const location = city
                ? (isEnglish ? city.en : isRussian ? city.ru || city.az : city.az)
                : property.city || districtLabel(property.district, t)

              return (
                <div key={property.id} className="listing-item card">
                  <img src={property.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} alt={getLocalizedText(property.title)} className="listing-image" />
                  <div className="listing-info">
                    <div className="listing-title-row">
                      <Link to={`/property/${property.id}`} className="listing-title">{getLocalizedText(property.title)}</Link>
                      <span className={`badge ${isPendingModeration || isInactivePremium || !isCurrentlyActive ? 'badge-warning' : 'badge-success'}`}>{statusLabel}</span>
                    </div>
                    <p className="listing-location">{location}</p>
                    <p className="listing-price">{property.price.daily} {property.price.currency} / {t.property.perNight}</p>
                    <div className="listing-meta">
                      {Boolean(property.views) && (
                        <span className="listing-meta-views">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          <strong>{property.views}</strong> {isEnglish ? 'views' : isRussian ? 'просмотров' : 'baxış'}
                        </span>
                      )}
                      {property.unavailableFrom && property.unavailableTo && <span className="listing-busy-dates">{isEnglish ? 'Dates:' : isRussian ? 'Даты:' : 'Tarix:'} {property.unavailableFrom} — {property.unavailableTo}</span>}
                      {paidTier && isTierExpired(property) && (
                        <span className="listing-premium-expired">
                          {/* Обратного отсчёта «дней до удаления» здесь больше нет:
                              истёкшее объявление не удаляется вовсе — оно ждёт
                              продления сколько угодно долго, просто не показываясь. */}
                          ⏰ {isEnglish
                            ? `${tierLabel(paidTier)} expired — hidden until you extend`
                            : isRussian
                              ? `${tierLabel(paidTier)} истёк — объявление скрыто до продления`
                              : `${tierLabel(paidTier)} bitdi — uzadılana qədər gizlidir`}
                        </span>
                      )}
                      {paidTier && isTierActive(property, paidTier) && (
                        <span className="listing-premium-active">
                          {isEnglish ? `${tierLabel(paidTier)} until ${tierEndsLabel}` : isRussian ? `${tierLabel(paidTier)} до ${tierEndsLabel}` : `${tierLabel(paidTier)} ${tierEndsLabel} qədər`}
                        </span>
                      )}
                      {!isPendingModeration && !isCurrentlyActive && property.unavailableTo && <span className="listing-inactive-hint">{isEnglish ? 'Click Activate to restore.' : isRussian ? 'Нажмите Активировать для восстановления.' : '"Aktiv et" düyməsinə klik edin.'}</span>}
                    </div>
                  </div>
                  <div className="listing-actions"><div className="action-buttons">
                    {!isPendingModeration && (isCurrentlyActive
                      ? <button className="btn btn-ghost btn-sm" onClick={() => handleOpenBusyModal(property)}>{isEnglish ? 'Hide' : isRussian ? 'Скрыть' : 'Qeyri-aktiv et'}</button>
                      : <button className="btn btn-accent btn-sm" onClick={() => handleSetActive(property.id)}>{isEnglish ? 'Activate' : isRussian ? 'Активировать' : 'Aktiv et'}</button>)}
                    {paidTier && isTierExpired(property) && <Link className="btn btn-primary btn-sm" to={`/dashboard/payment?propertyId=${encodeURIComponent(property.id)}`}>{tierLabel(paidTier).slice(0, 2)} {isEnglish ? 'Extend' : isRussian ? 'Продлить' : 'Uzat'}</Link>}
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(property)}>{t.dashboard.edit}</button>
                    <button className="btn btn-ghost btn-sm text-error" onClick={() => handleDelete(property.id)}>{t.dashboard.delete}</button>
                  </div></div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p>{t.dashboard.noListings}</p>
            <button className="btn btn-accent" onClick={onAdd}>{t.dashboard.addListing}</button>
          </div>
        )}
      </div>

      {busyListingId && (
        <div className="availability-modal-overlay" onClick={closeBusyModal}>
          <div className="availability-modal card" onClick={(event) => event.stopPropagation()}>
            <h3>{isEnglish ? 'Set as inactive' : isRussian ? 'Отметить как неактивное' : 'Qeyri-aktiv et'}</h3>
            <p>{isEnglish ? 'This listing will be marked as inactive until the selected end date.' : isRussian ? 'Это объявление будет неактивным до выбранной даты окончания.' : 'Bu elan seçdiyiniz bitmə tarixinə qədər qeyri-aktiv olacaq.'}</p>
            <div className="availability-grid">
              <div className="form-group"><label>{isEnglish ? 'Start date' : isRussian ? 'Дата начала' : 'Başlama tarixi'}</label><input type="date" value={busyFrom} onChange={(event) => setBusyFrom(event.target.value)} /></div>
              <div className="form-group"><label>{isEnglish ? 'End date' : isRussian ? 'Дата окончания' : 'Bitmə tarixi'}</label><input type="date" value={busyTo} min={busyFrom || undefined} onChange={(event) => setBusyTo(event.target.value)} /></div>
            </div>
            <div className="availability-actions">
              <button type="button" className="btn btn-ghost" onClick={closeBusyModal}>{t.form.cancel}</button>
              <button type="button" className="btn btn-accent" onClick={handleSetInactive} disabled={isSavingAvailability} aria-busy={isSavingAvailability}>{isSavingAvailability && <InlineSpinner label={t.messages.loading} />}{isSavingAvailability ? t.messages.loading : isEnglish ? 'Set non active' : isRussian ? 'Сделать неактивным' : 'Qeyri-aktiv et'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
