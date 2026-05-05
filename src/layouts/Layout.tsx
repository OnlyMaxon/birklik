import React from 'react'
import { Header, Footer, ErrorBoundary, OfflineNotifier } from '../components'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <div className="layout">
        <Header />
        <OfflineNotifier />
        <main className="main-content">
          <aside className="ad-slot ad-slot--left" aria-hidden="true">
            <div className="ad-placeholder">
              <span className="ad-placeholder-label">Reklam</span>
              <span className="ad-placeholder-size">160 × 600</span>
            </div>
          </aside>
          {children}
          <aside className="ad-slot ad-slot--right" aria-hidden="true">
            <div className="ad-placeholder">
              <span className="ad-placeholder-label">Reklam</span>
              <span className="ad-placeholder-size">160 × 600</span>
            </div>
          </aside>
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  )
}
