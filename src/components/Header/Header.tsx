import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { isModerator } from '../../config/constants'
import { getUnreadNotificationsCount } from '../../services/notificationsService'
import './Header.css'

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()
  const { isAuthenticated, user, firebaseUser, logout } = useAuth()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0)

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
        console.error('Error loading unread notifications count:', error)
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

  const languages = [
    { code: 'az' as const, label: 'AZ' },
    { code: 'en' as const, label: 'EN' },
    { code: 'ru' as const, label: 'RU' }
  ]

  const getNavClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`
  
  const getNotificationClass = () => {
    const location = window.location.search
    const isNotificationsTab = location.includes('tab=notifications')
    return `nav-link${isNotificationsTab ? ' active' : ''} notification-link`
  }

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
          <img className="logo-image" src="/brand/generated/logo-1024x256.png" alt="Birklik.az" />
          <span className="logo-tagline">{t.site.tagline}</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
            <NavLink to="/" end className={getNavClass} onClick={() => setMenuOpen(false)}>
              {t.nav.home}
            </NavLink>
            <NavLink to="/dashboard/add" className={getNavClass} onClick={() => setMenuOpen(false)}>
              {t.nav.addListing}
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" end className={getNavClass} onClick={() => setMenuOpen(false)}>
                  {t.nav.dashboard}
                </NavLink>
                {isModeratorUser && (
                  <NavLink to="/dashboard/review" className={getNavClass} onClick={() => setMenuOpen(false)}>
                    {language === 'en' ? 'Moderation' : language === 'ru' ? 'Модерация' : 'Moderasiya'}
                  </NavLink>
                )}
                <NavLink to="/dashboard?tab=notifications" className={() => getNotificationClass()} onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadNotificationCount > 0 && (
                    <span className="notification-badge">{unreadNotificationCount}</span>
                  )}
                </NavLink>
                <div className="user-menu">
                  <span className="user-name">{user?.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    logout()
                    setMenuOpen(false)
                  }}>
                    {t.nav.logout}
                  </button>
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
            <div className="language-switcher">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`lang-btn ${language === lang.code ? 'active' : ''}`}
                  onClick={() => setLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
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
