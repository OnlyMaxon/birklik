import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import './Header.css'

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()
  const { isAuthenticated, user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const isModerator = user?.email === 'calilorucli42@gmail.com'

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
    <header className="header bg-birklik-n-50/95 backdrop-blur-md border-b border-birklik-n-200/80">
      <div className="container">
        <div className="header-content gap-4">
          <Link to="/" className="logo shrink-0" onClick={() => setMenuOpen(false)}>
            <img className="logo-image" src="/brand/generated/logo-1024x256.png" alt="Birklik.az" />
            <span className="logo-tagline">{t.site.tagline}</span>
          </Link>

          <button
            type="button"
            className="hidden lg:flex header-search-pill items-center justify-between gap-4 rounded-full border border-birklik-n-200 bg-white px-5 py-2 text-sm text-birklik-n-700 shadow-airbnb"
          >
            <span className="font-semibold text-birklik-primary-dark">Where to?</span>
            <span className="h-4 w-px bg-birklik-n-300" />
            <span className="text-birklik-n-600">Add dates</span>
            <span className="h-4 w-px bg-birklik-n-300" />
            <span className="text-birklik-n-600">Guests</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-birklik-accent text-birklik-n-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </span>
          </button>

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
                {isModerator && (
                  <Link to="/dashboard/review" className="nav-link" onClick={() => setMenuOpen(false)}>
                    {language === 'en' ? 'Moderation' : 'Moderasiya'}
                  </Link>
                )}
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
