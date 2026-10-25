import { useState } from 'react'
import type { Event } from '../../types'
import { generatePoster } from '../../utils/poster'

interface Props {
  event: Pick<Event, 'posterUrl' | 'category' | 'title'>
  className?: string
}

/** Shows the uploaded poster, falling back to a generated one if it is missing or fails to load. */
export function EventPoster({ event, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const src = !event.posterUrl || failed ? generatePoster(event.category, event.title) : event.posterUrl
  return (
    <img
      src={src}
      alt={`Poster for ${event.title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-secondary object-cover ${className}`}
    />
  )
}
