'use client'

import {MapContainer, TileLayer} from 'react-leaflet'
import {BASEMAP_ATTRIBUTION, BASEMAP_URL} from '@/components/map/basemap'
import {LocationPicker, MapCenterUpdater} from './location-picker'

export interface Coordinates {
  lat: number
  lng: number
}

interface LocationMapProps {
  coordinates: Coordinates
  onChange: (coordinates: Coordinates) => void
  onAddressReverse: (address: string) => void
}

export function LocationMap({coordinates, onChange, onAddressReverse}: LocationMapProps) {
  return (
    <MapContainer
      center={[coordinates.lat, coordinates.lng]}
      zoom={13}
      scrollWheelZoom
      className="listing-location-map"
    >
      <TileLayer attribution={BASEMAP_ATTRIBUTION} url={BASEMAP_URL} />
      <MapCenterUpdater coordinates={coordinates} />
      <LocationPicker
        coordinates={coordinates}
        onChange={onChange}
        onAddressReverse={onAddressReverse}
      />
    </MapContainer>
  )
}
