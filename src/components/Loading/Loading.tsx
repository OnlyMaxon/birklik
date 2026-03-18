import React from 'react'
import './Loading.css'

interface LoadingProps {
  fullScreen?: boolean
  message?: string
  brand?: boolean
}

export const Loading: React.FC<LoadingProps> = ({ fullScreen = false, message, brand = false }) => {
  const content = (
    <div className="loading-wrapper">
      {brand ? (
        <div className="brand-loader" aria-label="Brand loading animation">
          <div className="brand-orbit">
            <div className="brand-core"></div>
          </div>
          <img className="brand-wordmark" src="/brand/generated/logo-1024x256.png" alt="Birklik.az" />
        </div>
      ) : (
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
      )}
      {message && <p className="loading-message">{message}</p>}
    </div>
  )

  if (fullScreen) {
    return <div className="loading-overlay">{content}</div>
  }

  return <div className="loading-container">{content}</div>
}
