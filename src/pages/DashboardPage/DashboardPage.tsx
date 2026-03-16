import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLanguage, useAuth } from '../../context'
import { Layout } from '../../layouts'
import { propertyTypes, districts, amenitiesList } from '../../data'
import { PropertyType, District, Amenity, Property } from '../../types'
import { createProperty, deleteProperty, getPropertiesByOwner } from '../../services'
import './DashboardPage.css'

type TabType = 'listings' | 'add' | 'profile'

export const DashboardPage: React.FC = () => {
  const { language, t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = React.useState<TabType>('listings')
  const [showAddSuccess, setShowAddSuccess] = React.useState(false)
  const [listings, setListings] = React.useState<Property[]>([])
  const [isLoadingListings, setIsLoadingListings] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const getLocalizedText = (text: Record<'az' | 'ru' | 'en', string>) => text[language]

  const loadListings = React.useCallback(async () => {
    if (!user) return

    setIsLoadingListings(true)
    setError('')
    const ownerListings = await getPropertiesByOwner(user.id)
    setListings(ownerListings)
    setIsLoadingListings(false)
  }, [user])

  React.useEffect(() => {
    if (activeTab === 'listings' && user) {
      loadListings()
    }
  }, [activeTab, user, loadListings])

  // Form state for adding listing
  const [newListing, setNewListing] = React.useState({
    title: '',
    description: '',
    type: '' as PropertyType | '',
    district: '' as District | '',
    address: '',
    price: '',
    rooms: '',
    area: '',
    amenities: [] as Amenity[]
  })

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !newListing.type || !newListing.district) {
      return
    }

    setIsSubmitting(true)
    setError('')

    const dailyPrice = Number(newListing.price)
    const rooms = Number(newListing.rooms)
    const area = Number(newListing.area || 0)

    const propertyPayload: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
      type: newListing.type,
      district: newListing.district,
      price: {
        daily: dailyPrice,
        weekly: dailyPrice * 6,
        monthly: dailyPrice * 24,
        currency: 'AZN'
      },
      rooms,
      area,
      amenities: newListing.amenities,
      images: [],
      coordinates: { lat: 40.4093, lng: 49.8671 },
      title: {
        az: newListing.title,
        ru: newListing.title,
        en: newListing.title
      },
      description: {
        az: newListing.description,
        ru: newListing.description,
        en: newListing.description
      },
      address: {
        az: newListing.address,
        ru: newListing.address,
        en: newListing.address
      },
      owner: {
        name: user.name,
        phone: user.phone,
        email: user.email
      },
      ownerId: user.id,
      isFeatured: false,
      isActive: true,
      city: 'Baku'
    }

    const created = await createProperty(propertyPayload, selectedFiles)
    if (!created) {
      setError(t.messages.error)
      setIsSubmitting(false)
      return
    }

    setShowAddSuccess(true)
    setTimeout(() => {
      setShowAddSuccess(false)
      setActiveTab('listings')
      setNewListing({
        title: '',
        description: '',
        type: '',
        district: '',
        address: '',
        price: '',
        rooms: '',
        area: '',
        amenities: []
      })
      setSelectedFiles([])
    }, 2000)

    setIsSubmitting(false)
  }

  const handleAmenityToggle = (amenity: Amenity) => {
    setNewListing(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const handleDeleteListing = async (id: string) => {
    const ok = window.confirm('Delete this listing?')
    if (!ok) return

    const deleted = await deleteProperty(id)
    if (!deleted) {
      setError(t.messages.error)
      return
    }

    await loadListings()
  }

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="user-info">
              <img src={user.avatar} alt={user.name} className="user-avatar" />
              <div>
                <h1>{t.dashboard.welcome}, {user.name}!</h1>
                <p>{user.email}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="dashboard-sidebar">
              <nav className="dashboard-nav">
                <button
                  className={`nav-item ${activeTab === 'listings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('listings')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  {t.dashboard.myListings}
                </button>
                <button
                  className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
                  onClick={() => setActiveTab('add')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v8"/>
                    <path d="M8 12h8"/>
                  </svg>
                  {t.dashboard.addListing}
                </button>
                <button
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t.dashboard.profile}
                </button>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="dashboard-content">
              {/* My Listings Tab */}
              {activeTab === 'listings' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.myListings}</h2>
                  {error && <div className="error-message">{error}</div>}
                  
                  {isLoadingListings ? (
                    <div className="empty-state">
                      <p>{t.messages.loading}</p>
                    </div>
                  ) : listings.length > 0 ? (
                    <div className="listings-list">
                      {listings.map((property) => {
                        return (
                          <div key={property.id} className="listing-item card">
                            <img 
                              src={property.images[0]} 
                              alt={getLocalizedText(property.title)}
                              className="listing-image"
                            />
                            <div className="listing-info">
                              <Link to={`/property/${property.id}`} className="listing-title">
                                {getLocalizedText(property.title)}
                              </Link>
                              <p className="listing-location">
                                {t.districts[property.district]}
                              </p>
                              <p className="listing-price">
                                {property.price.daily} {property.price.currency} / {t.property.perNight}
                              </p>
                            </div>
                            <div className="listing-actions">
                              <span className={`badge ${property.isActive ? 'badge-success' : 'badge-warning'}`}>
                                {property.isActive ? t.dashboard.active : t.dashboard.pending}
                              </span>
                              <div className="action-buttons">
                                <button className="btn btn-ghost btn-sm">{t.dashboard.edit}</button>
                                <button className="btn btn-ghost btn-sm text-error" onClick={() => handleDeleteListing(property.id)}>{t.dashboard.delete}</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      <p>{t.dashboard.noListings}</p>
                      <button 
                        className="btn btn-accent"
                        onClick={() => setActiveTab('add')}
                      >
                        {t.dashboard.addListing}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Add Listing Tab */}
              {activeTab === 'add' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.addListing}</h2>
                  {error && <div className="error-message">{error}</div>}

                  {showAddSuccess ? (
                    <div className="success-state">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <p>{t.dashboard.listingAdded}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleAddListing} className="add-listing-form card">
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label>{t.form.title} *</label>
                          <input
                            type="text"
                            value={newListing.title}
                            onChange={(e) => setNewListing({...newListing, title: e.target.value})}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>{t.search.propertyType} *</label>
                          <select
                            value={newListing.type}
                            onChange={(e) => setNewListing({...newListing, type: e.target.value as PropertyType})}
                            required
                          >
                            <option value="">{t.form.selectType}</option>
                            {propertyTypes.map(type => (
                              <option key={type} value={type}>{t.propertyTypes[type]}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>{t.search.district} *</label>
                          <select
                            value={newListing.district}
                            onChange={(e) => setNewListing({...newListing, district: e.target.value as District})}
                            required
                          >
                            <option value="">{t.form.selectDistrict}</option>
                            {districts.map(district => (
                              <option key={district} value={district}>{t.districts[district]}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.address} *</label>
                          <input
                            type="text"
                            value={newListing.address}
                            onChange={(e) => setNewListing({...newListing, address: e.target.value})}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>{t.form.price} (AZN) *</label>
                          <input
                            type="number"
                            value={newListing.price}
                            onChange={(e) => setNewListing({...newListing, price: e.target.value})}
                            required
                            min="0"
                          />
                        </div>

                        <div className="form-group">
                          <label>{t.form.rooms} *</label>
                          <input
                            type="number"
                            value={newListing.rooms}
                            onChange={(e) => setNewListing({...newListing, rooms: e.target.value})}
                            required
                            min="1"
                          />
                        </div>

                        <div className="form-group">
                          <label>{t.form.area}</label>
                          <input
                            type="number"
                            value={newListing.area}
                            onChange={(e) => setNewListing({...newListing, area: e.target.value})}
                            min="0"
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.description}</label>
                          <textarea
                            value={newListing.description}
                            onChange={(e) => setNewListing({...newListing, description: e.target.value})}
                            rows={4}
                          />
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.selectAmenities}</label>
                          <div className="amenities-checkboxes">
                            {amenitiesList.map(amenity => (
                              <label key={amenity} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={newListing.amenities.includes(amenity)}
                                  onChange={() => handleAmenityToggle(amenity)}
                                />
                                <span>{t.amenities[amenity]}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="form-group full-width">
                          <label>{t.form.photos}</label>
                          <div className="file-upload">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                            />
                            <p>Drag & drop or click to upload</p>
                            {selectedFiles.length > 0 && <p>{selectedFiles.length} file(s) selected</p>}
                          </div>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setActiveTab('listings')}>
                          {t.form.cancel}
                        </button>
                        <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
                          {isSubmitting ? t.messages.loading : t.form.submit}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="tab-content fade-in">
                  <h2>{t.dashboard.profile}</h2>
                  
                  <div className="profile-card card">
                    <div className="profile-header">
                      <img src={user.avatar} alt={user.name} className="profile-avatar" />
                      <div>
                        <h3>{user.name}</h3>
                        <p>{user.email}</p>
                      </div>
                    </div>

                    <form className="profile-form">
                      <div className="form-group">
                        <label>{t.auth.fullName}</label>
                        <input type="text" defaultValue={user.name} />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.email}</label>
                        <input type="email" defaultValue={user.email} />
                      </div>
                      <div className="form-group">
                        <label>{t.auth.phone}</label>
                        <input type="tel" defaultValue={user.phone} />
                      </div>
                      <button type="button" className="btn btn-accent">
                        {t.form.submit}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </Layout>
  )
}
