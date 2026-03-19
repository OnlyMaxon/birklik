import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { ImageGallery, PropertyMap, Loading } from '../../components'
import { getPropertyById } from '../../services'
import { Language, Property } from '../../types'
import './PropertyPage.css'

export const PropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { language, t } = useLanguage()
  const [showContactForm, setShowContactForm] = React.useState(false)
  const [contactSent, setContactSent] = React.useState(false)
  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const modalSubtitle = language === 'en'
    ? 'Leave your contact details and we will call you shortly.'
    : 'Elaqe melumatlarinizi yazin, qisa muddetde sizinle elaqe saxlayaq.'

  React.useEffect(() => {
    const loadProperty = async () => {
      if (!id) {
        setProperty(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const data = await getPropertyById(id)
      setProperty(data)
      setIsLoading(false)
    }

    loadProperty()
  }, [id])

  const getLocalizedText = (text: Record<Language, string>) => text[language]

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setContactSent(true)
    setTimeout(() => {
      setShowContactForm(false)
      setContactSent(false)
    }, 2000)
  }

  if (isLoading) {
    return (
      <Layout>
        <Loading message={t.messages.loading} />
      </Layout>
    )
  }

  if (!property) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="not-found">
            <h2>{t.messages.error}</h2>
            <p>Property not found</p>
            <Link to="/" className="btn btn-primary">{t.nav.home}</Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="property-page">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link to="/">{t.nav.home}</Link>
            <span>/</span>
            <span>{t.districts[property.district]}</span>
            <span>/</span>
            <span>{getLocalizedText(property.title)}</span>
          </nav>

          {/* Main Content */}
          <div className="property-layout">
            {/* Left Column - Gallery & Details */}
            <div className="property-main">
              <ImageGallery 
                images={property.images} 
                alt={getLocalizedText(property.title)} 
              />

              <div className="property-info card">
                <h1 className="property-title">{getLocalizedText(property.title)}</h1>
                
                <div className="property-meta">
                  <span className="badge badge-primary">{t.propertyTypes[property.type]}</span>
                  <span className="location">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {t.districts[property.district]}
                  </span>
                  {property.rating && (
                    <span className="rating">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      {property.rating} ({property.reviews})
                    </span>
                  )}
                </div>

                <div className="property-features">
                  <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <div>
                      <span className="feature-value">{property.rooms}</span>
                      <span className="feature-label">{t.property.rooms}</span>
                    </div>
                  </div>
                  <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                    <div>
                      <span className="feature-value">{property.area}</span>
                      <span className="feature-label">{t.property.sqm}</span>
                    </div>
                  </div>
                </div>

                <div className="property-section">
                  <h3>{t.property.description}</h3>
                  <p>{getLocalizedText(property.description)}</p>
                </div>

                <div className="property-section">
                  <h3>{t.property.amenities}</h3>
                  <div className="amenities-grid">
                    {property.amenities.map((amenity) => (
                      <span key={amenity} className="amenity-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {t.amenities[amenity]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="property-section">
                  <h3>{t.property.address}</h3>
                  <p>{getLocalizedText(property.address)}</p>
                </div>

                <div className="property-section">
                  <h3>{t.property.location}</h3>
                  <PropertyMap 
                    properties={[property]} 
                    singleProperty={true}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Booking Card */}
            <div className="property-sidebar">
              <div className="booking-card card">
                <div className="price-section">
                  <div className="price-row">
                    <span className="price-label">{t.property.perNight}:</span>
                    <span className="price-value">{property.price.daily} {property.price.currency}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">{t.property.perWeek}:</span>
                    <span className="price-value">{property.price.weekly} {property.price.currency}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">{t.property.perMonth}:</span>
                    <span className="price-value">{property.price.monthly} {property.price.currency}</span>
                  </div>
                </div>

                <button 
                  className="btn btn-accent btn-lg w-full"
                  onClick={() => setShowContactForm(true)}
                >
                  {t.property.book}
                </button>

                <div className="owner-info">
                  <h4>{t.property.contact}</h4>
                  <p className="owner-name">{property.owner.name}</p>
                  <a href={`tel:${property.owner.phone}`} className="owner-phone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {property.owner.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactForm && (
        <div className="modal-overlay" onClick={() => setShowContactForm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowContactForm(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>

            {contactSent ? (
              <div className="success-message">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>{t.messages.contactSuccess}</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">{t.property.book}</h3>
                  <p className="modal-subtitle">{modalSubtitle}</p>
                </div>
                <form onSubmit={handleContactSubmit} className="modal-form">
                  <div className="form-group">
                    <label>{t.auth.fullName}</label>
                    <input type="text" required placeholder={language === 'en' ? 'Your full name' : 'Ad ve soyad'} />
                  </div>
                  <div className="form-group">
                    <label>{t.auth.phone}</label>
                    <input type="tel" required placeholder="+994 xx xxx xx xx" />
                  </div>
                  <div className="form-group">
                    <label>{t.auth.email}</label>
                    <input type="email" required placeholder="you@email.com" />
                  </div>
                  <div className="form-group">
                    <label>{t.form.description}</label>
                    <textarea rows={3} placeholder={language === 'en' ? 'Any extra details about your request' : 'Istekle bagli elave qeyd'}></textarea>
                  </div>
                  <button type="submit" className="btn btn-accent btn-lg w-full">
                    {t.form.submit}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
