import React from 'react'
import './ImageGallery.css'

interface ImageGalleryProps {
  images: string[]
  alt: string
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, alt }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const swipeStartX = React.useRef<number | null>(null)
  const swipeCurrentX = React.useRef<number | null>(null)
  const didSwipe = React.useRef(false)
  const isPointerDown = React.useRef(false)

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleSwipeStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX
    swipeCurrentX.current = e.touches[0].clientX
    didSwipe.current = false
  }

  const handleSwipeMove = (e: React.TouchEvent) => {
    swipeCurrentX.current = e.touches[0].clientX
  }

  const handleSwipeEnd = () => {
    if (swipeStartX.current == null || swipeCurrentX.current == null) return

    const deltaX = swipeCurrentX.current - swipeStartX.current
    const swipeThreshold = 45

    if (Math.abs(deltaX) >= swipeThreshold) {
      didSwipe.current = true
      if (deltaX > 0) {
        goToPrevious()
      } else {
        goToNext()
      }
    }

    swipeStartX.current = null
    swipeCurrentX.current = null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDown.current = true
    swipeStartX.current = e.clientX
    swipeCurrentX.current = e.clientX
    didSwipe.current = false
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current) return
    swipeCurrentX.current = e.clientX
  }

  const handlePointerUp = () => {
    if (!isPointerDown.current) return
    isPointerDown.current = false
    handleSwipeEnd()
  }

  const handleMainClick = () => {
    if (didSwipe.current) {
      window.setTimeout(() => {
        didSwipe.current = false
      }, 0)
      return
    }

    setIsModalOpen(true)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isModalOpen) return
    if (e.key === 'ArrowLeft') goToPrevious()
    if (e.key === 'ArrowRight') goToNext()
    if (e.key === 'Escape') setIsModalOpen(false)
  }

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  return (
    <>
      <div className="gallery">
        <div
          className="gallery-main"
          onClick={handleMainClick}
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img src={images[selectedIndex]} alt={`${alt} - Main`} />
          <button
            type="button"
            className="gallery-main-nav gallery-main-prev"
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
            aria-label="Previous image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <button
            type="button"
            className="gallery-main-nav gallery-main-next"
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            aria-label="Next image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
          <div className="gallery-zoom-hint">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
              <path d="M11 8v6"/>
              <path d="M8 11h6"/>
            </svg>
          </div>
        </div>
        
        <div className="gallery-thumbnails">
          {images.map((image, index) => (
            <button
              key={index}
              className={`thumbnail ${selectedIndex === index ? 'active' : ''}`}
              onClick={() => setSelectedIndex(index)}
            >
              <img src={image} alt={`${alt} - ${index + 1}`} />
            </button>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="gallery-modal" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
            
            <button className="modal-nav modal-prev" onClick={goToPrevious}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>

            <img 
              src={images[selectedIndex]} 
              alt={`${alt} - ${selectedIndex + 1}`} 
              className="modal-image"
            />

            <button className="modal-nav modal-next" onClick={goToNext}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>

            <div className="modal-counter">
              {selectedIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
