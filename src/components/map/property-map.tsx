'use client'

import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from '@/lib/navigation'
import L from 'leaflet'
import { useLanguage } from '@/components/providers'
import { Property, Language } from '../../types'
import { cities } from '../../data'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})

const BAKU_CENTER: [number, number] = [40.4093, 49.8671]
const BAKU_ZOOM = 11

// Fits map view to all visible properties; falls back to Baku city area when empty
const FitBoundsOnChange: React.FC<{ properties: Property[] }> = ({ properties }) => {
  const map = useMap()

  React.useEffect(() => {
    if (properties.length === 0) {
      map.setView(BAKU_CENTER, BAKU_ZOOM)
      return
    }
    if (properties.length === 1) {
      map.setView([properties[0].coordinates.lat, properties[0].coordinates.lng], 14)
      return
    }
    const bounds = L.latLngBounds(
      properties.map(p => [p.coordinates.lat, p.coordinates.lng] as [number, number])
    )
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
  }, [properties, map])

  return null
}

interface PropertyMapProps {
  properties: Property[]
  center?: [number, number]
  zoom?: number
  singleProperty?: boolean
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  center = BAKU_CENTER,
  zoom = BAKU_ZOOM,
  singleProperty = false
}) => {
  const { language, t } = useLanguage()
  const navigate = useNavigate()

  React.useEffect(() => {
    import('leaflet/dist/leaflet.css')
  }, [])

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const mapActionLabels = {
    google: 'Google Maps',
    waze: 'Waze',
    apple: 'Apple Maps'
  }

  // For single property, center on the property itself; otherwise use Baku center
  // (FitBoundsOnChange handles dynamic re-centering for multi-property view)
  const initialCenter: [number, number] = React.useMemo(() => {
    if (singleProperty && properties.length > 0) {
      return [properties[0].coordinates.lat, properties[0].coordinates.lng]
    }
    return center
  }, [properties, singleProperty, center])

  const initialZoom = singleProperty ? 14 : zoom

  const markerIcons = React.useMemo(() => {
    return new Map(
      properties.map((property) => {
        const priceLabel = `${property.price.daily} ${property.price.currency}`
        const markerMarkup = `
          <div class="premium-price-marker">
            <span>${priceLabel}</span>
          </div>
        `

        const icon = L.divIcon({
          className: 'premium-price-marker-wrap',
          html: markerMarkup,
          iconSize: [96, 42],
          iconAnchor: [48, 42],
          popupAnchor: [0, -30]
        })

        return [property.id, icon] as const
      })
    )
  }, [properties])

  return (
    <div className="map-container">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        className="leaflet-map"
      >
        {!singleProperty && <FitBoundsOnChange properties={properties} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {properties.map((property) => (
          <Marker
            key={property.id}
            position={[property.coordinates.lat, property.coordinates.lng]}
            icon={markerIcons.get(property.id)}
          >
            <Popup>
              <div className="map-popup">
                <img
                  src={property.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                  alt={getLocalizedText(property.title)}
                  className="popup-image"
                />
                <div className="popup-content">
                  <h4 className="popup-title">{getLocalizedText(property.title)}</h4>
                  <p className="popup-location">{(() => {
                    if (property.city) {
                      const c = cities.find(x => x.value === property.city)
                      if (c) return language === 'en' ? c.en : language === 'ru' ? (c.ru || c.az) : c.az
                      return property.city
                    }
                    return t.districts[property.district] || ''
                  })()}</p>
                  <p className="popup-price">
                    <strong>{property.price.daily} {property.price.currency}</strong> / {t.property.perNight}
                  </p>
                  <button
                    onClick={() => navigate(`/property/${property.id}`)}
                    className="popup-view-button"
                  >
                    {language === 'en' ? 'View Listing' : language === 'ru' ? 'Просмотреть' : 'Elanı Göstər'}
                  </button>
                  <div className="popup-map-actions">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${property.coordinates.lat},${property.coordinates.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Google Maps' : language === 'ru' ? 'Открыть в Google Maps' : 'Google Maps-də aç'}
                    >
                      {mapActionLabels.google}
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${property.coordinates.lat}%2C${property.coordinates.lng}&navigate=yes`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Waze' : language === 'ru' ? 'Открыть в Waze' : 'Waze-də aç'}
                    >
                      {mapActionLabels.waze}
                    </a>
                    <a
                      href={`maps://maps.apple.com/?ll=${property.coordinates.lat},${property.coordinates.lng}&q=${getLocalizedText(property.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Apple Maps' : language === 'ru' ? 'Открыть в Apple Maps' : 'Apple Maps-də aç'}
                    >
                      {mapActionLabels.apple}
                    </a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
