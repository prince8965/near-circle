import { useEffect, useState } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { MapFallback } from './MapFallback'
import { MAPS_API_KEY, MAPS_LOADER_ID } from './mapsConfig'

export interface LatLng {
  lat: number
  lng: number
}

interface Props {
  value: LatLng
  onChange: (value: LatLng) => void
  height?: number
  address?: string
}

function LoadedPicker({ value, onChange, height }: { value: LatLng; onChange: (v: LatLng) => void; height: number; address?: string }) {
  const { isLoaded, loadError } = useJsApiLoader({ id: MAPS_LOADER_ID, googleMapsApiKey: MAPS_API_KEY ?? '' })
  const [authFailed, setAuthFailed] = useState(false)

  useEffect(() => {
    window.gm_authFailure = () => setAuthFailed(true)
    return () => {
      window.gm_authFailure = undefined
    }
  }, [])

  if (loadError || authFailed) return <MapFallback reason="load-failed" lat={value.lat} lng={value.lng} height={height} />
  if (!isLoaded)
    return <div className="animate-pulse rounded-xl bg-secondary/50" style={{ height }} role="status" aria-label="Loading map" />

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height, borderRadius: 12 }}
      center={value}
      zoom={14}
      onClick={(e) => e.latLng && onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
      options={{ streetViewControl: false, mapTypeControl: false }}
    >
      <MarkerF
        position={value}
        draggable
        onDragEnd={(e) => e.latLng && onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
      />
    </GoogleMap>
  )
}

/** Click or drag the pin to choose the venue location. Falls back to the locality centre without a Maps key. */
export function MapPicker({ value, onChange, height = 260, address }: Props) {
  if (!MAPS_API_KEY) return <MapFallback reason="missing-key" lat={value.lat} lng={value.lng} address={address} height={height} />
  return <LoadedPicker value={value} onChange={onChange} height={height} address={address} />
}
