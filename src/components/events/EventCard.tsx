import { Link } from 'react-router-dom'
import { Award, CalendarDays, MapPin, Navigation, Sparkles, Users } from 'lucide-react'
import type { EventWithMeta } from '../../types'
import { formatDate, formatDistance, formatPrice, formatTime } from '../../utils/format'
import { CategoryChip } from '../ui/CategoryChip'
import { EventPoster } from './EventPoster'
import { RSVPButton } from './RSVPButton'

export function EventCard({ event }: { event: EventWithMeta }) {
  const distance = formatDistance(event.distanceKm)
  const almostFull = event.seatsLeft > 0 && event.seatsLeft <= Math.max(5, event.capacity * 0.1)

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/events/${event.id}`} className="relative block overflow-hidden" aria-label={`View details for ${event.title}`}>
        <EventPoster event={event} className="aspect-[16/10] w-full transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <CategoryChip category={event.category} size="sm" />
          {event.mode && (
            <span className="rounded-full bg-black/75 border border-[#334155] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand backdrop-blur-md">
              {event.mode}
            </span>
          )}
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-[#0B0F19]/90 border border-[#334155] px-2.5 py-1 text-xs font-bold text-white shadow-card backdrop-blur-md">
          {formatPrice(event.price)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          {event.recommendation ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
              <Sparkles className="h-3 w-3 text-brand" aria-hidden />
              {event.recommendation}
            </p>
          ) : (
            <span className="text-xs text-ink-faint truncate">by {event.organizerName}</span>
          )}
          {event.prizesSummary && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 shrink-0">
              <Award className="h-3.5 w-3.5" /> Prizes
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white">
          <Link to={`/events/${event.id}`} className="hover:text-brand">
            {event.title}
          </Link>
        </h3>

        <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span className="truncate">{event.venueName}</span>
          </li>
          {distance && event.mode !== 'online' && (
            <li className="flex items-center gap-2">
              <Navigation className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              {distance}
            </li>
          )}
        </ul>

        {event.tags && event.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {event.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-md bg-[#0F172A] border border-[#334155]/60 px-1.5 py-0.5 text-[10px] text-ink-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className={`flex items-center gap-1.5 text-xs ${almostFull ? 'font-semibold text-amber-400' : 'text-ink-faint'}`}>
            <Users className="h-3.5 w-3.5" aria-hidden />
            {event.seatsLeft > 0 ? `${event.seatsLeft} seats left` : 'Full'}
          </p>
          <RSVPButton event={event} />
        </div>
      </div>
    </article>
  )
}
