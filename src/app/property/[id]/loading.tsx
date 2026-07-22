import {Layout} from '@/components/app-layout'

export default function LoadingProperty() {
  return (
    <Layout>
      <div className="property-page">
        <div className="container">
          <div className="property-layout">
            <div className="property-main">
              <div className="gallery">
                <div className="gallery-main skeleton-shimmer" />
              </div>

              <div className="pp-title-card">
                <div className="skeleton-line skeleton-shimmer" style={{height: '1.6rem', width: '60%'}} />
                <div className="skeleton-line skeleton-shimmer" style={{height: '1rem', width: '35%'}} />
              </div>

              <div className="pp-section">
                <div className="pp-section-body">
                  <div className="skeleton-line skeleton-shimmer" style={{height: '0.9rem', width: '100%'}} />
                  <div className="skeleton-line skeleton-shimmer" style={{height: '0.9rem', width: '90%'}} />
                  <div className="skeleton-line skeleton-shimmer" style={{height: '0.9rem', width: '75%', marginBottom: 0}} />
                </div>
              </div>
            </div>

            <div className="property-sidebar">
              <div className="pp-price-card">
                <div className="skeleton-line skeleton-shimmer" style={{height: '1.5rem', width: '50%', marginBottom: 0}} />
              </div>

              <div className="booking-card card">
                <div className="skeleton-line skeleton-shimmer" style={{height: '1rem', width: '50%'}} />
                <div className="skeleton-line skeleton-shimmer" style={{height: '10rem', width: '100%', marginBottom: 0}} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
