import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SearchBar({ value, onChange, className = '' }: Props) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor="event-search" className="sr-only">
        Search events by title
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" aria-hidden />
      <input
        id="event-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Find workshops, meetups, events near you..."
        className="input h-12 pl-11 pr-10 text-base"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-faint hover:text-white"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
