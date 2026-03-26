import React from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Layout } from '../../layouts'
import { Loading } from '../../components'
import { useAuth, useLanguage } from '../../context'
import { approveProperty, getPendingProperties } from '../../services'
import { Property } from '../../types'
import './ModerationPage.css'

const MODERATOR_EMAIL = 'calilorucli42@gmail.com'

export const ModerationPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth()
  const { language, t } = useLanguage()
  const [pendingListings, setPendingListings] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isApprovingId, setIsApprovingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')

  const loadPendingListings = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    const rows = await getPendingProperties()
    setPendingListings(rows)
    setIsLoading(false)
  }, [])

  React.useEffect(() => {
    loadPendingListings()
  }, [loadPendingListings])

  if (!isAuthenticated || user?.email !== MODERATOR_EMAIL) {
    return <Navigate to="/dashboard" replace />
  }

  const approveListing = async (id: string) => {
    setIsApprovingId(id)
    setError('')

    const ok = await approveProperty(id)
    if (!ok) {
      setError(language === 'en' ? 'Could not approve listing.' : 'Elanı təsdiqləmək mümkün olmadı.')
      setIsApprovingId(null)
      return
    }

    await loadPendingListings()
    setIsApprovingId(null)
  }

  const getLocalizedText = (text: { az: string; en: string }) => text[language]

  return (
    <Layout>
      <section className="moderation-page">
        <div className="container moderation-container">
          <div className="moderation-header">
            <h1>{language === 'en' ? 'Listing moderation' : 'Elan moderasiyası'}</h1>
            <p>{language === 'en' ? 'Standard and Premium forms arrive here for approval.' : 'Standart və Premium elan formaları təsdiq üçün buraya gəlir.'}</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          {isLoading ? (
            <Loading message={t.messages.loading} />
          ) : pendingListings.length === 0 ? (
            <div className="moderation-empty card">
              <p>{language === 'en' ? 'No pending listings right now.' : 'Hazırda gözləyən elan yoxdur.'}</p>
              <Link to="/dashboard" className="btn btn-outline">{t.nav.dashboard}</Link>
            </div>
          ) : (
            <div className="moderation-list">
              {pendingListings.map((listing) => (
                <article key={listing.id} className="moderation-item card">
                  <img src={listing.images[0]} alt={getLocalizedText(listing.title)} className="moderation-image" />

                  <div className="moderation-content">
                    <h3>{getLocalizedText(listing.title)}</h3>
                    <p className="moderation-meta">{listing.price.daily} {listing.price.currency} / {t.property.perNight} · {t.districts[listing.district]}</p>
                    <p className="moderation-description">{getLocalizedText(listing.description)}</p>
                    <p className="moderation-owner">
                      <strong>{language === 'en' ? 'Owner:' : 'Sahib:'}</strong> {listing.owner?.name || '-'} · {listing.owner?.phone || '-'}
                    </p>
                    <p className="moderation-owner">
                      <strong>{language === 'en' ? 'Plan:' : 'Paket:'}</strong> {(listing.listingTier || 'standard').toUpperCase()}
                    </p>
                  </div>

                  <div className="moderation-actions">
                    <Link to={`/property/${listing.id}`} className="btn btn-ghost btn-sm">
                      {language === 'en' ? 'Preview' : 'Önizləmə'}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      onClick={() => approveListing(listing.id)}
                      disabled={isApprovingId === listing.id}
                    >
                      {isApprovingId === listing.id
                        ? t.messages.loading
                        : (language === 'en' ? 'Approve publication' : 'Yayıma icazə ver')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  )
}
