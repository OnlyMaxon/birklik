import React from 'react'
import { CircleMarker, useMap, useMapEvents } from 'react-leaflet'

/**
 * Props for the LocationPicker component
 * @typedef {Object} LocationPickerProps
 * @property {Object} coordinates - Current map coordinates
 * @property {number} coordinates.lat - Latitude
 * @property {number} coordinates.lng - Longitude
 * @property {Function} onChange - Callback when user clicks on map
 * @property {Function} [onAddressReverse] - Optional callback for reverse geocoding result
 */
interface LocationPickerProps {
  coordinates: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
  onAddressReverse?: (address: string) => void
}

/**
 * Default coordinates for Baku city center
 * @type {Object}
 * @readonly
 */
export const DEFAULT_COORDINATES = { lat: 40.4093, lng: 49.8671 }

/**
 * Sanitize API response to prevent XSS attacks
 * Removes HTML tags, javascript: protocols, and event handlers
 * @param {string} input - Raw API response string
 * @returns {string} Sanitized string (max 255 chars)
 */
export const sanitizeApiResponse = (input: string): string => {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/javascript:/gi, '')  // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')  // Remove event handlers
    .trim()
    .slice(0, 255)
}

/**
 * MapCenterUpdater - Updates map center when coordinates change
 * Hook-based component that works with react-leaflet useMap
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.coordinates - Map center coordinates
 * @param {number} props.coordinates.lat - Latitude
 * @param {number} props.coordinates.lng - Longitude
 * @returns {null} No rendered output
 * @example
 * <MapCenterUpdater coordinates={{lat: 40.4, lng: 49.9}} />
 */
export const MapCenterUpdater: React.FC<{ coordinates: { lat: number; lng: number } }> = ({ coordinates }) => {
  const map = useMap()

  React.useEffect(() => {
    map.setView([coordinates.lat, coordinates.lng], map.getZoom(), { animate: true })
  }, [coordinates, map])

  return null
}

/**
 * LocationPicker - Interactive map marker for selecting property locations
 * Handles map clicks to update coordinates and performs reverse geocoding
 * to get address from coordinates. Uses OpenStreetMap Nominatim API.
 *
 * @component
 * @param {LocationPickerProps} props - Component properties
 * @param {Object} props.coordinates - Current marker position
 * @param {number} props.coordinates.lat - Latitude
 * @param {number} props.coordinates.lng - Longitude
 * @param {Function} props.onChange - Callback with new coordinates when map is clicked
 * @param {Function} [props.onAddressReverse] - Optional callback with reverse-geocoded address
 * @returns {React.ReactElement} Rendered circle marker
 * 
 * @example
 * const [coords, setCoords] = useState({lat: 40.4, lng: 49.9})
 * <LocationPicker 
 *   coordinates={coords}
 *   onChange={setCoords}
 *   onAddressReverse={(addr) => setAddress(addr)}
 * />
 *
 * @note Requires parent MapContainer from react-leaflet
 * @note Only geocodes locations in Azerbaijan
 * @note API requests timeout after 5 seconds
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({ coordinates, onChange, onAddressReverse }) => {
  useMapEvents({
    click: (event) => {
      const newCoords = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      }
      onChange(newCoords)
      
      // Reverse geocode to get address
      if (onAddressReverse) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}&zoom=18&addressdetails=1`, {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'az,en;q=0.9'
          }
        })
          .then(res => res.json())
          .then(data => {
            clearTimeout(timeoutId)
            let address = ''
            
            if (data && typeof data === 'object' && data.address && typeof data.address === 'object') {
              address = [
                data.address.village,
                data.address.suburb,
                data.address.city_district,
                data.address.county,
                data.address.city,
                data.address.town,
                data.display_name ? data.display_name.split(',')[0] : ''
              ]
                .find(a => typeof a === 'string' && a.length > 0) || ''
            }
            
            const sanitizedAddress = sanitizeApiResponse(address)
            
            if (
              data &&
              typeof data.address === 'object' &&
              (data.address.country === 'Azerbaijan' || data.address.country_code === 'az') &&
              sanitizedAddress.length > 0
            ) {
              onAddressReverse(sanitizedAddress)
            }
          })
          .catch(() => {
            clearTimeout(timeoutId)
          })
      }
    }
  })

  return (
    <CircleMarker
      center={[coordinates.lat, coordinates.lng]}
      radius={10}
      pathOptions={{ color: '#1f62c7', fillColor: '#ffb703', fillOpacity: 0.95, weight: 3 }}
    />
  )
}
