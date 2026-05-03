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
        <div className="brand-loader" aria-label="Loading">
          <div className="brand-loader-top">
            <div className="brand-orbit">
              <div className="brand-core" />
            </div>
            <img
              className="brand-wordmark"
              src="/brand/generated/logo-1024x256.png"
              alt="Birklik.az"
            />
          </div>
          <div className="brand-progress-track">
            <div className="brand-progress-bar" />
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      ) : (
        <>
          <div className="loading-spinner">
            <div className="spinner-ring" />
            <div className="spinner-ring" />
            <div className="spinner-ring" />
          </div>
          {message && <p className="loading-message">{message}</p>}
        </>
      )}
    </div>
  )

  if (fullScreen) {
    return <div className="loading-overlay">{content}</div>
  }

  return <div className="loading-container">{content}</div>
}
