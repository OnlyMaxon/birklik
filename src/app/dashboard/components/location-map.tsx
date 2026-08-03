'use client'

import {MapContainer, TileLayer} from 'react-leaflet'
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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterUpdater coordinates={coordinates} />
      <LocationPicker
        coordinates={coordinates}
        onChange={onChange}
        onAddressReverse={onAddressReverse}
      />
    </MapContainer>
  )
}
