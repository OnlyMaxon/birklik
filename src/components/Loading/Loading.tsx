import React from 'react'
import './Loading.css'

interface LoadingProps {
  fullScreen?: boolean
  message?: string
}

export const Loading: React.FC<LoadingProps> = ({ fullScreen = false, message }) => {
  const content = (
    <div className="loading-wrapper">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  )

  if (fullScreen) {
    return <div className="loading-overlay">{content}</div>
  }

  return <div className="loading-container">{content}</div>
}
