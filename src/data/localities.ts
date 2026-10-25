import type { Locality } from '../types'

/**
 * Selectable localities — strictly Mumbai & Navi Mumbai.
 * Coordinates are approximate area centres used for distance calculation and map initializations.
 */
export const LOCALITIES: Locality[] = [
  // --- Mumbai Hubs ---
  { id: 'andheri', name: 'Andheri', city: 'Mumbai', lat: 19.1136, lng: 72.8697 },
  { id: 'bandra', name: 'Bandra', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  { id: 'bkc', name: 'BKC (Bandra Kurla Complex)', city: 'Mumbai', lat: 19.0662, lng: 72.8688 },
  { id: 'borivali', name: 'Borivali', city: 'Mumbai', lat: 19.2307, lng: 72.8567 },
  { id: 'dadar', name: 'Dadar', city: 'Mumbai', lat: 19.0178, lng: 72.8478 },
  { id: 'churchgate', name: 'Churchgate / SoBo', city: 'Mumbai', lat: 18.9322, lng: 72.8264 },
  { id: 'colaba', name: 'Colaba', city: 'Mumbai', lat: 18.9067, lng: 72.8147 },
  { id: 'lower-parel', name: 'Lower Parel', city: 'Mumbai', lat: 18.9938, lng: 72.8327 },
  { id: 'worli', name: 'Worli', city: 'Mumbai', lat: 18.998, lng: 72.8153 },
  { id: 'powai', name: 'Powai (IIT Bombay Hub)', city: 'Mumbai', lat: 19.1176, lng: 72.906 },
  { id: 'juhu', name: 'Juhu / Vile Parle', city: 'Mumbai', lat: 19.1026, lng: 72.8376 },
  { id: 'goregaon', name: 'Goregaon', city: 'Mumbai', lat: 19.1663, lng: 72.8526 },
  { id: 'malad', name: 'Malad', city: 'Mumbai', lat: 19.1871, lng: 72.8484 },
  { id: 'kandivali', name: 'Kandivali', city: 'Mumbai', lat: 19.2043, lng: 72.8562 },
  { id: 'ghatkopar', name: 'Ghatkopar', city: 'Mumbai', lat: 19.086, lng: 72.908 },
  { id: 'kurla', name: 'Kurla', city: 'Mumbai', lat: 19.0726, lng: 72.8797 },
  { id: 'chembur', name: 'Chembur', city: 'Mumbai', lat: 19.0622, lng: 72.8997 },
  { id: 'vikhroli', name: 'Vikhroli', city: 'Mumbai', lat: 19.104, lng: 72.925 },
  { id: 'mulund', name: 'Mulund', city: 'Mumbai', lat: 19.1726, lng: 72.9565 },
  { id: 'thane', name: 'Thane', city: 'Mumbai', lat: 19.2183, lng: 72.9781 },

  // --- Navi Mumbai Hubs ---
  { id: 'vashi', name: 'Vashi', city: 'Navi Mumbai', lat: 19.0771, lng: 72.9988 },
  { id: 'nerul', name: 'Nerul', city: 'Navi Mumbai', lat: 19.0313, lng: 73.0168 },
  { id: 'belapur', name: 'CBD Belapur', city: 'Navi Mumbai', lat: 19.0255, lng: 73.0344 },
  { id: 'kharghar', name: 'Kharghar', city: 'Navi Mumbai', lat: 19.0474, lng: 73.0659 },
  { id: 'seawoods', name: 'Seawoods / Sanpada', city: 'Navi Mumbai', lat: 19.0127, lng: 73.0129 },
  { id: 'airoli', name: 'Airoli', city: 'Navi Mumbai', lat: 19.1594, lng: 72.9981 },
  { id: 'ghansoli', name: 'Ghansoli', city: 'Navi Mumbai', lat: 19.1288, lng: 73.0013 },
  { id: 'kopar-khairane', name: 'Kopar Khairane', city: 'Navi Mumbai', lat: 19.1072, lng: 73.0065 },
  { id: 'panvel', name: 'Panvel', city: 'Navi Mumbai', lat: 18.9894, lng: 73.1175 },
  { id: 'ulwe', name: 'Ulwe', city: 'Navi Mumbai', lat: 18.9774, lng: 73.0238 },
]

export const DEFAULT_LOCALITY_ID = 'andheri'

/**
 * Bounds for Mumbai & Navi Mumbai region (approx lat: 18.80 to 19.38, lng: 72.70 to 73.22)
 */
export function isWithinMumbaiNaviMumbai(lat: number, lng: number): boolean {
  return lat >= 18.80 && lat <= 19.38 && lng >= 72.70 && lng <= 73.22
}

export const getLocality = (id: string): Locality =>
  LOCALITIES.find((l) => l.id.toLowerCase() === id.toLowerCase()) ?? LOCALITIES[0]
