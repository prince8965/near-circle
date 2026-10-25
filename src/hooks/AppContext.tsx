import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_LOCALITY_ID, LOCALITIES } from '../data/localities'
import { defaultFilters } from '../services'
import type { Category } from '../types'
import { distanceKm } from '../utils/geo'
import { readStore, writeStore } from '../utils/storage'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

interface AppValue {
  localityId: string
  setLocalityId: (id: string) => void
  interests: Category[]
  toggleInterest: (c: Category) => void
  detectLocation: (silent?: boolean) => Promise<string | null>
  isDetectingLocation: boolean
}

const AppContext = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [localityId, setLocalityState] = useState<string>(() =>
    readStore('locality', DEFAULT_LOCALITY_ID)
  )
  const [interests, setInterests] = useState<Category[]>(() =>
    readStore('interests', defaultFilters.interests)
  )
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)

  const { isAuthenticated, user } = useAuth()
  const { notify } = useToast()
  const hasAutoDetectedRef = useRef<string | null>(null)

  const setLocalityId = useCallback((id: string) => {
    setLocalityState(id)
    writeStore('locality', id)
  }, [])

  const toggleInterest = useCallback((c: Category) => {
    setInterests((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
      writeStore('interests', next)
      return next
    })
  }, [])

  const detectLocation = useCallback(
    async (silent = false): Promise<string | null> => {
      if (!('geolocation' in navigator)) {
        if (!silent) {
          notify('Location is not available in this browser.', 'info')
        }
        return null
      }

      setIsDetectingLocation(true)

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsDetectingLocation(false)
            const { latitude, longitude } = pos.coords

            // Pick closest Mumbai or Navi Mumbai hub from coordinates
            const nearest = LOCALITIES.reduce(
              (best, l) => {
                const d = distanceKm(latitude, longitude, l.lat, l.lng)
                return d < best.d ? { id: l.id, d, name: l.name, city: l.city } : best
              },
              { id: LOCALITIES[0].id, d: Infinity, name: LOCALITIES[0].name, city: LOCALITIES[0].city }
            )

            setLocalityState(nearest.id)
            writeStore('locality', nearest.id)

            if (!silent) {
              notify(`📍 Location detected: ${nearest.name}, ${nearest.city}`, 'success')
            }
            resolve(nearest.id)
          },
          () => {
            setIsDetectingLocation(false)
            if (!silent) {
              notify('Location permission was not granted. Pick your locality from the list instead.', 'info')
            }
            resolve(null)
          },
          { maximumAge: 300_000, timeout: 9000, enableHighAccuracy: true }
        )
      })
    },
    [notify]
  )

  // Automatically fetch location when user logs in or authenticated session is active
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      if (hasAutoDetectedRef.current !== user.id) {
        hasAutoDetectedRef.current = user.id
        void detectLocation(false)
      }
    }
  }, [isAuthenticated, user?.id, detectLocation])

  const value = useMemo(
    () => ({
      localityId,
      setLocalityId,
      interests,
      toggleInterest,
      detectLocation,
      isDetectingLocation,
    }),
    [localityId, setLocalityId, interests, toggleInterest, detectLocation, isDetectingLocation]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
