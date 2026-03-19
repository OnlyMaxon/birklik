import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LanguageProvider, AuthProvider } from './context'
import './styles/globals.css'
import './styles/mobile-overrides.css'

const ua = window.navigator.userAgent
const isIOS = /iPhone|iPad|iPod/i.test(ua)
const isGoogleShell = /GSA|CriOS/i.test(ua)

if (isIOS && isGoogleShell) {
  document.documentElement.classList.add('ios-google')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
