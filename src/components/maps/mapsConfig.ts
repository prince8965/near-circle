/** Key comes from the environment only. It is never hardcoded or committed. */
export const MAPS_API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || undefined

export const MAPS_LOADER_ID = 'nearcircle-google-maps'

export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
