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

  const getLocalizedText = (text: Record<Language, string>) => text[language]

  const mapCenter: [number, number] = singleProperty && properties.length === 1 
    ? [properties[0].coordinates.lat, properties[0].coordinates.lng]
    : center

  const mapZoom = singleProperty ? 14 : zoom

  return (
    <div className="map-container">
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        scrollWheelZoom={false}
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map((property) => (
          <Marker 
            key={property.id} 
            position={[property.coordinates.lat, property.coordinates.lng]}
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
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
