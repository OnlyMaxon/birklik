import React from 'react'

export interface EmptyState {
  title: string
  description: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export const EmptyStateComponent: React.FC<EmptyState> = ({ title, description, icon, action }) => (
  <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
    {icon && <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>}
    <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        style={{
          padding: '0.5rem 1.5rem',
          backgroundColor: '#1f62c7',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        {action.label}
      </button>
    )}
  </div>
)

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
    <div
      style={{
        display: 'inline-block',
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #1f62c7',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    />
    <p style={{ marginTop: '1rem' }}>{message}</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div style={{ textAlign: 'center', padding: '2rem', color: '#d32f2f' }}>
    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
    <h3 style={{ marginBottom: '0.5rem' }}>Something went wrong</h3>
    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#666' }}>{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: '0.5rem 1.5rem',
          backgroundColor: '#1f62c7',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Try Again
      </button>
    )}
  </div>
)
