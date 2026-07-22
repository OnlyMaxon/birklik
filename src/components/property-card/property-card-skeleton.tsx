export function PropertyCardSkeleton() {
  return (
    <div className="property-card property-card-skeleton" aria-hidden="true">
      <div className="property-image skeleton-shimmer" />
      <div className="property-content">
        <div className="skeleton-line skeleton-shimmer skeleton-line--title" />
        <div className="skeleton-line skeleton-shimmer skeleton-line--location" />
        <div className="skeleton-line skeleton-shimmer skeleton-line--features" />
        <div className="skeleton-line skeleton-shimmer skeleton-line--price" />
      </div>
    </div>
  )
}
