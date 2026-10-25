import { Award, CalendarClock, Globe, RotateCcw, SlidersHorizontal, Users2 } from 'lucide-react'
import {
  CATEGORIES,
  POPULAR_TECHNOLOGIES,
  type Category,
  type DateFilter,
  type EventFilters,
  type EventModeFilter,
  type PriceFilter,
  type SortKey,
  type TeamSizeFilter,
} from '../../types'
import { CategoryChip } from '../ui/CategoryChip'

interface Props {
  filters: EventFilters
  onChange: (patch: Partial<EventFilters>) => void
  onClear: () => void
  onToggleInterest: (c: Category) => void
  activeCount: number
}

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'any', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'weekend', label: 'Weekends' },
  { value: 'custom', label: 'Pick a date' },
]

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

const MODE_OPTIONS: { value: EventModeFilter; label: string }[] = [
  { value: 'all', label: 'All Modes' },
  { value: 'in-person', label: 'In-Person' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
]

const TEAM_SIZE_OPTIONS: { value: TeamSizeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'solo', label: 'Solo (1)' },
  { value: 'team', label: 'Teams (2+)' },
]

const RADIUS_OPTIONS = [
  { value: 0, label: 'Any distance' },
  { value: 2, label: 'Within 2 km' },
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 20, label: 'Within 20 km' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'soonest', label: 'Soonest' },
  { value: 'deadline', label: 'Registration deadline' },
  { value: 'nearest', label: 'Nearest' },
]

export function FilterPanel({ filters, onChange, onClear, onToggleInterest, activeCount }: Props) {
  const currentMode = filters.mode ?? 'all'
  const currentTeamSize = filters.teamSize ?? 'all'

  return (
    <aside className="card p-5" aria-label="Filters">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <SlidersHorizontal className="h-4 w-4 text-brand" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-[#0B0F19] shadow-cyber">
              {activeCount}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onClear}
          disabled={activeCount === 0}
          className="flex items-center gap-1 text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear all
        </button>
      </div>

      <div className="space-y-5">
        {/* Sort by */}
        <div>
          <label htmlFor="sort" className="label">
            Sort by
          </label>
          <select
            id="sort"
            className="input"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey, page: 1 })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-secondary text-white">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Event Mode (In-person / Online / Hybrid) */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-brand" aria-hidden /> Event Mode
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0F172A] border border-[#334155] p-1">
            {MODE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={currentMode === o.value}
                onClick={() => onChange({ mode: o.value, page: 1 })}
                className={`rounded-lg py-1.5 text-xs font-medium transition ${
                  currentMode === o.value
                    ? 'bg-[#334155] text-white shadow-card font-semibold'
                    : 'text-ink-muted hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="label">
            Category / Domain
          </label>
          <select
            id="category"
            className="input"
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value as Category | 'all', page: 1 })}
          >
            <option value="all" className="bg-secondary text-white">
              All categories
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-secondary text-white">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Technologies / Tags Filter */}
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Technologies &amp; Tags</label>
            {filters.technology && (
              <button
                type="button"
                onClick={() => onChange({ technology: undefined, page: 1 })}
                className="text-xs text-brand hover:underline"
              >
                Clear tech
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {POPULAR_TECHNOLOGIES.map((tech) => {
              const isSelected = filters.technology?.toLowerCase() === tech.toLowerCase()
              return (
                <button
                  key={tech}
                  type="button"
                  onClick={() => onChange({ technology: isSelected ? undefined : tech, page: 1 })}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    isSelected
                      ? 'border-brand bg-brand/15 text-brand font-semibold shadow-cyber'
                      : 'border-[#334155] bg-[#0F172A] text-ink-muted hover:border-brand/40 hover:text-white'
                  }`}
                >
                  {tech}
                </button>
              )
            })}
          </div>
        </div>

        {/* Team-Size Limits */}
        <fieldset>
          <legend className="label flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5 text-brand" aria-hidden /> Team Size Limits
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#0F172A] border border-[#334155] p-1">
            {TEAM_SIZE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={currentTeamSize === o.value}
                onClick={() => onChange({ teamSize: o.value, page: 1 })}
                className={`rounded-lg py-1.5 text-xs font-medium transition ${
                  currentTeamSize === o.value
                    ? 'bg-[#334155] text-white shadow-card font-semibold'
                    : 'text-ink-muted hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Deadlines & Prizes Checkboxes */}
        <div className="space-y-2.5 rounded-xl border border-[#334155] bg-[#0F172A]/70 p-3">
          <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(filters.openRegistrationOnly)}
              onChange={(e) => onChange({ openRegistrationOnly: e.target.checked, page: 1 })}
              className="h-4 w-4 rounded border-[#334155] bg-[#1E293B] text-brand focus:ring-brand"
            />
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-brand" />
              Open Registrations Only
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(filters.hasPrizes)}
              onChange={(e) => onChange({ hasPrizes: e.target.checked, page: 1 })}
              className="h-4 w-4 rounded border-[#334155] bg-[#1E293B] text-brand focus:ring-brand"
            />
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              With Cash Prizes &amp; Rewards
            </span>
          </label>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date-filter" className="label">
            Date
          </label>
          <select
            id="date-filter"
            className="input"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value as DateFilter, page: 1 })}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-secondary text-white">
                {o.label}
              </option>
            ))}
          </select>
          {filters.date === 'custom' && (
            <div className="mt-2">
              <label htmlFor="custom-date" className="sr-only">
                Choose a date
              </label>
              <input
                id="custom-date"
                type="date"
                className="input"
                value={filters.customDate ?? ''}
                onChange={(e) => onChange({ customDate: e.target.value || undefined, page: 1 })}
              />
            </div>
          )}
        </div>

        {/* Price */}
        <fieldset>
          <legend className="label">Price</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#0F172A] border border-[#334155] p-1">
            {PRICE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={filters.price === o.value}
                onClick={() => onChange({ price: o.value, page: 1 })}
                className={`rounded-lg py-1.5 text-sm font-medium transition ${
                  filters.price === o.value
                    ? 'bg-[#334155] text-white shadow-card font-semibold'
                    : 'text-ink-muted hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Distance (Location) */}
        <div>
          <label htmlFor="radius" className="label">
            Distance Radius
          </label>
          <select
            id="radius"
            className="input"
            value={filters.radiusKm}
            disabled={filters.mode === 'online'}
            onChange={(e) => onChange({ radiusKm: Number(e.target.value), page: 1 })}
          >
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-faint">
            {filters.mode === 'online'
              ? 'Online events are accessible anywhere without travel.'
              : 'Measured from your selected locality.'}
          </p>
        </div>

        {/* Interests */}
        <fieldset>
          <legend className="label">My interests</legend>
          <p className="mb-2 text-xs text-ink-faint">Used to rank “Recommended” events.</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c}
                category={c}
                size="sm"
                selected={filters.interests.includes(c)}
                onClick={() => onToggleInterest(c)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </aside>
  )
}

