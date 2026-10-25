import { useEffect, useState } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { MapFallback } from './MapFallback'
import { MAPS_API_KEY, MAPS_LOADER_ID } from './mapsConfig'

interface Props {
  lat: number
  lng: number
  title: string
  address?: string
  height?: number
}

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

function LoadedMap({ lat, lng, title, address, height }: Required<Omit<Props, 'address'>> & { address?: string }) {
  const { isLoaded, loadError } = useJsApiLoader({ id: MAPS_LOADER_ID, googleMapsApiKey: MAPS_API_KEY ?? '' })
  const [authFailed, setAuthFailed] = useState(false)

  useEffect(() => {
    // Google calls this global when the key is rejected (wrong referrer, API not enabled, billing, etc.).
    window.gm_authFailure = () => setAuthFailed(true)
    return () => {
      window.gm_authFailure = undefined
    }
  }, [])

  if (loadError || authFailed) return <MapFallback reason="load-failed" lat={lat} lng={lng} address={address} height={height} />
  if (!isLoaded)
    return <div className="animate-pulse rounded-xl bg-secondary/50" style={{ height }} role="status" aria-label="Loading map" />

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height, borderRadius: 12 }}
      center={{ lat, lng }}
      zoom={15}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
    >
      <MarkerF position={{ lat, lng }} title={title} />
    </GoogleMap>
  )
}

/** Read-only map of a venue. Falls back gracefully when the key is missing or Maps fails to load. */
export function MapView({ lat, lng, title, address, height = 280 }: Props) {
  if (!MAPS_API_KEY) return <MapFallback reason="missing-key" lat={lat} lng={lng} address={address} height={height} />
  return <LoadedMap lat={lat} lng={lng} title={title} address={address} height={height} />
}
