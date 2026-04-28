import React, { ErrorInfo, ReactNode } from 'react'
import * as logger from '../services/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', error)
    logger.error('Error info:', errorInfo.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#2e241b',
          color: '#fff',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ marginBottom: '20px' }}>Something went wrong</h1>
          <p style={{ marginBottom: '20px', maxWidth: '500px' }}>
            An unexpected error occurred. Please try refreshing the page or return to home.
          </p>
          {this.state.error && (
            <pre style={{
              backgroundColor: '#1a0f0a',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '100%',
              overflow: 'auto',
              marginBottom: '20px',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6e5436',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Return to Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
