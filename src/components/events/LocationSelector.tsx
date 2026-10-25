import { useState } from 'react'
import { Check, LocateFixed, MapPin, Search } from 'lucide-react'
import { LOCALITIES } from '../../data/localities'
import { useApp } from '../../hooks/AppContext'
import { useToast } from '../../hooks/ToastContext'
import { geocodeMumbaiAddress } from '../../services'
import { distanceKm } from '../../utils/geo'

/**
 * Manual locality selection for Mumbai & Navi Mumbai.
 * Supports choosing from Mumbai / Navi Mumbai hubs or typing any custom road/area within the region.
 */
export function LocationSelector({ className = '' }: { className?: string }) {
  const { localityId, setLocalityId, detectLocation, isDetectingLocation } = useApp()
  const { notify } = useToast()
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const [searching, setSearching] = useState(false)

  const useMyLocation = () => {
    void detectLocation(false)
  }

  const handleCustomSearch = async () => {
    if (!customText.trim()) return
    setSearching(true)
    try {
      const res = await geocodeMumbaiAddress(customText.trim())
      if (res.error) {
        notify(res.error, 'error')
      } else if (!res.isWithinBounds) {
        notify('Only areas within Mumbai and Navi Mumbai are supported.', 'error')
      } else {
        // Find closest hub to user's typed road / landmark
        const nearest = LOCALITIES.reduce(
          (best, l) => {
            const d = distanceKm(res.lat, res.lng, l.lat, l.lng)
            return d < best.d ? { id: l.id, d } : best
          },
          { id: LOCALITIES[0].id, d: Infinity }
        )
        setLocalityId(nearest.id)
        setShowCustomInput(false)
        setCustomText('')
        notify(`Location set near ${nearest.id.toUpperCase()} based on "${customText}".`, 'success')
      }
    } catch {
      notify('Could not geocode this location. Please try a major road or hub name.', 'error')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showCustomInput ? (
        <div className="flex flex-1 items-center gap-1.5">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
            <input
              type="text"
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCustomSearch()
                if (e.key === 'Escape') setShowCustomInput(false)
              }}
              placeholder="Road / Area (Mumbai & Navi Mumbai only)"
              className="input pl-9 pr-3 text-xs w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCustomSearch()}
            disabled={searching || !customText.trim()}
            className="btn-primary py-2 px-3 text-xs shrink-0"
            title="Search custom location in Mumbai / Navi Mumbai"
          >
            {searching ? <LocateFixed className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="btn-secondary py-2 px-2 text-xs shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="relative flex-1">
          <label htmlFor="locality-select" className="sr-only">
            Your locality
          </label>
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <select
            id="locality-select"
            value={localityId}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setShowCustomInput(true)
              } else {
                setLocalityId(e.target.value)
              }
            }}
            className="input appearance-none pl-9 pr-8"
          >
            <optgroup label="Mumbai Hubs">
              {LOCALITIES.filter((l) => l.city === 'Mumbai').map((l) => (
                <option key={l.id} value={l.id} className="bg-secondary text-white">
                  {l.name}, Mumbai
                </option>
              ))}
            </optgroup>
            <optgroup label="Navi Mumbai Hubs">
              {LOCALITIES.filter((l) => l.city === 'Navi Mumbai').map((l) => (
                <option key={l.id} value={l.id} className="bg-secondary text-white">
                  {l.name}, Navi Mumbai
                </option>
              ))}
            </optgroup>
            <option value="custom" className="bg-secondary text-brand font-semibold">
              + Type custom road or area...
            </option>
          </select>
        </div>
      )}

      {!showCustomInput && (
        <>
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="btn-secondary shrink-0 px-2.5"
            title="Type custom road or landmark in Mumbai / Navi Mumbai"
            aria-label="Search custom location"
          >
            <Search className="h-4 w-4 text-ink-muted hover:text-white" />
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={isDetectingLocation}
            className="btn-secondary shrink-0 px-3"
            title="Use my location (picks closest Mumbai / Navi Mumbai hub)"
            aria-label="Use my location"
          >
            <LocateFixed className={`h-4 w-4 text-brand ${isDetectingLocation ? 'animate-pulse' : ''}`} aria-hidden />
          </button>
        </>
      )}
    </div>
  )
}
