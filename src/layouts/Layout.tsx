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
          {children}
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  )
}
