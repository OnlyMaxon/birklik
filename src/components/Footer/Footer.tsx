import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import './Footer.css'

export const Footer: React.FC = () => {
  const { t } = useLanguage()

  const handleStoreClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
  }

  return (
    <footer className="footer">
      <div className="footer-bg">
        <div className="footer-overlay">
          <div className="container">
            <div className="footer-inner">

              <div className="footer-tagline-block">
                <h2 className="footer-headline">{t.footer.whatWeDo}</h2>
                <p className="footer-subline">{t.site.tagline}</p>
              </div>

              <nav className="footer-links" aria-label="Footer navigation">
                <Link to="/about" className="footer-link">{t.footer.about}</Link>
                <Link to="/contact" className="footer-link">{t.footer.contact}</Link>
                <Link to="/terms" className="footer-link">{t.footer.terms}</Link>
                <Link to="/privacy" className="footer-link">{t.footer.privacy}</Link>
              </nav>

              <div className="footer-social">
                <a href="#" className="social-link" aria-label="Facebook">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                </a>
                <a href="#" className="social-link" aria-label="Instagram">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
                <a href="#" className="social-link" aria-label="WhatsApp">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>

              <div className="footer-brand-row">
                <div className="footer-logo-wrap">
                  <picture>
                    <source srcSet="/brand/generated/logo-1024x256.webp" type="image/webp" />
                    <img
                      src="/brand/generated/logo-1024x256.png"
                      alt="Birklik.az"
                      className="footer-logo-img"
                      width="1024"
                      height="256"
                    />
                  </picture>
                </div>

                <div className="footer-store-wrap">
                  <p className="footer-store-label">{t.footer.ourApps}</p>
                  <div className="footer-store-btns">
                    <a
                      href="#"
                      className="store-btn"
                      aria-label="App Store"
                      aria-disabled="true"
                      onClick={handleStoreClick}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <div className="store-btn-text">
                        <span className="store-btn-sub">{t.footer.downloadOn}</span>
                        <span className="store-btn-main">App Store</span>
                      </div>
                    </a>

                    <a
                      href="#"
                      className="store-btn"
                      aria-label="Google Play"
                      aria-disabled="true"
                      onClick={handleStoreClick}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l242-242L47 0zM425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c17.2-9.3 17.2-31.3-.5-60.8h-.7zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                      </svg>
                      <div className="store-btn-text">
                        <span className="store-btn-sub">{t.footer.getItOn}</span>
                        <span className="store-btn-main">Google Play</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>

              <div className="footer-bottom">
                <p>{t.footer.copyright}</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
