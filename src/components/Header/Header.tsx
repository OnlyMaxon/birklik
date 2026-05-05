import React from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { isModerator } from '../../config/constants'
import { getUnreadNotificationsCount } from '../../services/notificationsService'
import { getPendingModerationCount } from '../../services/propertyService'
import './Header.css'
import * as logger from '../../services/logger'

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()
  const { isAuthenticated, user, firebaseUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [langOpen, setLangOpen] = React.useState(false)
  const langRef = React.useRef<HTMLDivElement>(null)
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0)
  const [moderationNotificationCount, setModerationNotificationCount] = React.useState(0)

  React.useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsModeratorUser(isModerator(token))
      }
    }
    checkModerator()
  }, [firebaseUser])

  React.useEffect(() => {
    const loadUnreadCount = async () => {
      if (!isAuthenticated || !user?.id) {
        setUnreadNotificationCount(0)
        return
      }

      try {
        const count = await getUnreadNotificationsCount(user.id)
        setUnreadNotificationCount(count)
      } catch (error) {
        logger.error('Error loading unread notifications count:', error)
      }
    }

    loadUnreadCount()
    // Reload count every 30 seconds when authenticated
    const interval = isAuthenticated ? setInterval(loadUnreadCount, 30000) : undefined
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAuthenticated, user?.id])

  React.useEffect(() => {
    const loadModerationCount = async () => {
      if (!isModeratorUser) {
        setModerationNotificationCount(0)
        return
      }

      try {
        const count = await getPendingModerationCount()
        setModerationNotificationCount(count)
      } catch (error) {
        logger.error('Error loading moderation count:', error)
      }
    }

    loadModerationCount()
    // Reload count every 30 seconds for moderators
    const interval = isModeratorUser ? setInterval(loadModerationCount, 30000) : undefined
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isModeratorUser])

  React.useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogoClick = () => {
    setMenuOpen(false)
    if (location.pathname === '/') {
      window.location.reload()
    } else {
      navigate('/')
    }
  }

  const languages = [
    { code: 'az' as const, label: 'AZ' },
    { code: 'en' as const, label: 'EN' },
    { code: 'ru' as const, label: 'RU' }
  ]

  const getNavClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`
  
  const getNotificationClass = () => {
    const isNotificationsTab = location.search.includes('tab=notifications')
    return `nav-link${isNotificationsTab ? ' active' : ''} notification-link`
  }

  const getAddListingClass = () => {
    const isAddTab = location.search.includes('tab=add')
    return `nav-link nav-link--add${isAddTab ? ' active' : ''}`
  }

  React.useEffect(() => {
    if (!langOpen) return
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [langOpen])

  const [headerHidden, setHeaderHidden] = React.useState(false)
  React.useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      if (menuOpen) return
      const y = window.scrollY
      if (y < 80) { setHeaderHidden(false) }
      else if (y > lastY + 4) { setHeaderHidden(true) }
      else if (y < lastY - 4) { setHeaderHidden(false) }
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [menuOpen])

  return (
    <header className={`header${headerHidden ? ' header--hidden' : ''}`}>
      <div className="header-content">
        <div className="logo" onClick={handleLogoClick} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <picture>
            <source srcSet="/brand/generated/logo-1024x256.webp" type="image/webp" />
            <img className="logo-image" src="/brand/generated/logo-1024x256.png" alt="Birklik.az" width="1024" height="256" />
          </picture>
          <span className="logo-tagline">{t.site.tagline}</span>
        </div>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
            <NavLink to="/" end className={getNavClass} onClick={() => setMenuOpen(false)}>
              {t.nav.home}
            </NavLink>
            <Link to="/dashboard?tab=add" className={getAddListingClass()} onClick={() => setMenuOpen(false)}>
              {t.nav.addListing}
            </Link>

            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" end className={getNavClass} onClick={() => setMenuOpen(false)}>
                  {t.nav.dashboard}
                </NavLink>
                {isModeratorUser && (
                  <div className="moderation-link-wrapper">
                    <NavLink to="/dashboard/review" className={getNavClass} onClick={() => setMenuOpen(false)}>
                      {t.moderation.moderateListings}
                    </NavLink>
                    {moderationNotificationCount > 0 && (
                      <span className="notification-badge">{moderationNotificationCount}</span>
                    )}
                  </div>
                )}
                
                <div className="nav-user-section">
                  <div 
                    className="user-profile"
                    onClick={() => {
                      navigate('/dashboard?tab=profile')
                      setMenuOpen(false)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate('/dashboard?tab=profile')
                        setMenuOpen(false)
                      }
                    }}
                  >
                    <div className="user-avatar">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <div className="avatar-placeholder">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
                      )}
                    </div>
                    <span className="user-name-nav">{user?.name}</span>
                  </div>
                  
                  <div className="nav-actions-right">
                    <NavLink to="/dashboard?tab=notifications" className={() => getNotificationClass()} onClick={() => setMenuOpen(false)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {unreadNotificationCount > 0 && (
                        <span className="notification-badge">{unreadNotificationCount}</span>
                      )}
                    </NavLink>
                    
                    <button 
                      className="logout-btn" 
                      onClick={() => {
                        logout()
                        setMenuOpen(false)
                      }}
                      title={t.nav.logout}
                      aria-label={t.nav.logout}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>
                  {t.nav.login}
                </Link>
                <Link to="/register" className="btn btn-accent btn-sm" onClick={() => setMenuOpen(false)}>
                  {t.nav.register}
                </Link>
              </>
            )}
          </nav>

          <div className="header-actions">
            <div className="language-switcher" ref={langRef}>
              <button
                className={`lang-current${langOpen ? ' open' : ''}`}
                onClick={() => setLangOpen(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={`Language: ${language.toUpperCase()}`}
              >
                <span>{language.toUpperCase()}</span>
                <svg className="lang-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {langOpen && (
                <div className="lang-dropdown" role="listbox" aria-label="Select language">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      className={`lang-option${language === lang.code ? ' active' : ''}`}
                      role="option"
                      aria-selected={language === lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false) }}
                    >
                      {lang.label}
                      {language === lang.code && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              <span className={`menu-icon ${menuOpen ? 'open' : ''}`} aria-hidden="true">
                <span className="menu-line menu-line-top"></span>
                <span className="menu-line menu-line-middle"></span>
                <span className="menu-line menu-line-bottom"></span>
              </span>
            </button>
          </div>
        </div>

        <button
        type="button"
        className={`mobile-menu-backdrop ${menuOpen ? 'show' : ''}`}
        aria-label="Close mobile menu"
        onClick={() => setMenuOpen(false)}
      />
    </header>
  )
}
