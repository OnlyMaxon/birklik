import {Layout} from '@/components/app-layout'
import {PropertyCardSkeleton} from '@/components'

export default function AppLoading() {
  return (
    <Layout>
      <section className="hero">
        <div className="hero-bg-img skeleton-shimmer" aria-hidden="true" />
      </section>

      <section className="section properties-section">
        <div className="container">
          <div className="properties-grid premium-properties-grid">
            {Array.from({length: 8}).map((_, index) => (
              <PropertyCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  )
}
