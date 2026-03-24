import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import './Header.css'

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()
  const { isAuthenticated, user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = React.useState(false)

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
    { code: 'en' as const, label: 'EN' }
  ]

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
            <img className="logo-image" src="/brand/generated/logo-1024x256.png" alt="Birklik.az" />
            <span className="logo-tagline">{t.site.tagline}</span>
          </Link>

          <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
            <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>
              {t.nav.home}
            </Link>
            <Link to="/dashboard/add" className="nav-link nav-highlight" onClick={() => setMenuOpen(false)}>
              {t.nav.addListing}
            </Link>

            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}>
                  {t.nav.dashboard}
                </Link>
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
              <span className={`hamburger ${menuOpen ? 'open' : ''}`}></span>
            </button>
          </div>
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
