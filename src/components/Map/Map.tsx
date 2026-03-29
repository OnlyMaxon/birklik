import React from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useLanguage } from '../../context'
import { Property, Language } from '../../types'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './Map.css'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})

interface PropertyMapProps {
  properties: Property[]
  center?: [number, number]
  zoom?: number
  singleProperty?: boolean
}

export const PropertyMap: React.FC<PropertyMapProps> = ({ 
  properties, 
  center = [40.4093, 49.8671], // Baku center
  zoom = 10,
  singleProperty = false
}) => {
  const { language, t } = useLanguage()

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const mapActionLabels = {
    google: language === 'en' ? 'Google Maps' : language === 'ru' ? 'Google Maps' : 'Google Maps',
    waze: language === 'en' ? 'Waze' : language === 'ru' ? 'Waze' : 'Waze',
    apple: language === 'en' ? 'Apple Maps' : language === 'ru' ? 'Apple Maps' : 'Apple Maps'
  }

  const mapCenter: [number, number] = singleProperty && properties.length === 1 
    ? [properties[0].coordinates.lat, properties[0].coordinates.lng]
    : center

  const mapZoom = singleProperty ? 14 : zoom

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
        center={mapCenter} 
        zoom={mapZoom} 
        scrollWheelZoom={false}
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
                  src={property.images[0]} 
                  alt={getLocalizedText(property.title)} 
                  className="popup-image"
                />
                <div className="popup-content">
                  <h4 className="popup-title">{getLocalizedText(property.title)}</h4>
                  <p className="popup-location">{t.districts[property.district]}</p>
                  <p className="popup-price">
                    <strong>{property.price.daily} {property.price.currency}</strong> / {t.property.perNight}
                  </p>
                  <div className="popup-map-actions">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${property.coordinates.lat},${property.coordinates.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Google Maps' : language === 'ru' ? 'Открыть в Google Maps' : 'Google Maps-də aç'}
                    >
                      📍 {mapActionLabels.google}
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${property.coordinates.lat}%2C${property.coordinates.lng}&navigate=yes`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Waze' : language === 'ru' ? 'Открыть в Waze' : 'Waze-də aç'}
                    >
                      🗺️ {mapActionLabels.waze}
                    </a>
                    <a
                      href={`maps://maps.apple.com/?ll=${property.coordinates.lat},${property.coordinates.lng}&q=${getLocalizedText(property.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="popup-map-link"
                      title={language === 'en' ? 'Open in Apple Maps' : language === 'ru' ? 'Открыть в Apple Maps' : 'Apple Maps-də aç'}
                    >
                      🗺️ {mapActionLabels.apple}
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
