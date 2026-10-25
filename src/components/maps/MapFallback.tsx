import { ExternalLink, MapPin } from 'lucide-react'
import { googleMapsLink } from './mapsConfig'

interface Props {
  reason: 'missing-key' | 'load-failed'
  lat?: number
  lng?: number
  address?: string
  height?: number
  onLocationPick?: (lat: number, lng: number) => void
}

export function MapFallback({ lat, lng, address, height = 280 }: Props) {
  const hasCoords = lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng)

  if (hasCoords) {
    const delta = 0.012
    const bbox = `${lng - delta},${lat - delta * 0.75},${lng + delta},${lat + delta * 0.75}`
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`

    return (
      <div className="relative overflow-hidden rounded-xl border border-[#334155] bg-[#0F172A] shadow-card">
        <iframe
          title="Map Location Preview"
          width="100%"
          height={height}
          loading="lazy"
          className="border-0 w-full"
          src={embedUrl}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#334155] bg-[#0B0F19]/90 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-ink-muted">
            <MapPin className="h-3.5 w-3.5 text-brand" />
            <span className="font-mono text-[11px] text-white">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
            {address && <span className="truncate max-w-[200px] text-ink-faint">({address})</span>}
          </div>
          <a
            href={googleMapsLink(lat, lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#334155] bg-[#0F172A]/70 px-5 text-center"
      style={{ minHeight: height }}
      role="note"
    >
      <MapPin className="mb-2 h-7 w-7 text-brand" aria-hidden />
      <p className="text-sm font-semibold text-white">Live Map Preview</p>
      <p className="mt-1 max-w-xs text-xs text-ink-muted">
        Select a locality hub or enter a venue address to pinpoint the location.
      </p>
    </div>
  )
}
