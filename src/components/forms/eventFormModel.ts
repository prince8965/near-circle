import { LOCALITIES, getLocality } from '../../data/localities'
import { CATEGORIES, type Category, type Event, type EventInput, type EventStatus } from '../../types'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '../../utils/format'

export interface EventFormValues {
  title: string
  description: string
  category: Category | ''
  posterUrl?: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  venueName: string
  address: string
  localityId: string
  lat: number
  lng: number
  isFree: boolean
  price: string
  capacity: string
  registrationUrl: string

  // Hackathon & advanced configuration
  mode: 'in-person' | 'online' | 'hybrid'
  eligibility: string
  minTeamSize: string
  maxTeamSize: string
  registrationDeadline: string
  submissionDeadline: string
  rules: string
  prizesSummary: string
  tracks: string
}

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>

export function emptyFormValues(localityId: string): EventFormValues {
  const loc = getLocality(localityId)
  return {
    title: '',
    description: '',
    category: '',
    posterUrl: undefined,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    venueName: '',
    address: '',
    localityId,
    lat: loc.lat,
    lng: loc.lng,
    isFree: true,
    price: '',
    capacity: '50',
    registrationUrl: '',

    mode: 'in-person',
    eligibility: 'Open to all students and enthusiasts',
    minTeamSize: '1',
    maxTeamSize: '4',
    registrationDeadline: '',
    submissionDeadline: '',
    rules: '',
    prizesSummary: '',
    tracks: '',
  }
}

export function eventToFormValues(e: Event): EventFormValues {
  return {
    title: e.title,
    description: e.description,
    category: e.category,
    posterUrl: e.posterUrl,
    startDate: toDateInput(e.startsAt),
    startTime: toTimeInput(e.startsAt),
    endDate: toDateInput(e.endsAt),
    endTime: toTimeInput(e.endsAt),
    venueName: e.venueName,
    address: e.address,
    localityId: e.localityId,
    lat: e.lat,
    lng: e.lng,
    isFree: e.price === 0,
    price: e.price > 0 ? String(e.price) : '',
    capacity: String(e.capacity),
    registrationUrl: e.registrationUrl ?? '',

    mode: e.mode ?? 'in-person',
    eligibility: e.eligibility ?? '',
    minTeamSize: e.minTeamSize ? String(e.minTeamSize) : '1',
    maxTeamSize: e.maxTeamSize ? String(e.maxTeamSize) : '4',
    registrationDeadline: e.registrationDeadline ? toDateInput(e.registrationDeadline) : '',
    submissionDeadline: e.submissionDeadline ? toDateInput(e.submissionDeadline) : '',
    rules: e.rules ?? '',
    prizesSummary: e.prizesSummary ?? '',
    tracks: e.tracks ? e.tracks.join(', ') : '',
  }
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Drafts only need a title; publishing requires a complete, consistent event. */
export function validateEventForm(v: EventFormValues, status: EventStatus, isEditing: boolean): EventFormErrors {
  const errors: EventFormErrors = {}
  if (!v.title.trim()) errors.title = 'Give your event a title.'
  else if (v.title.trim().length > 100) errors.title = 'Keep the title under 100 characters.'
  if (v.registrationUrl.trim() && !isValidUrl(v.registrationUrl.trim()))
    errors.registrationUrl = 'Enter a full link starting with https://'
  if (status === 'draft') return errors

  if (v.description.trim().length < 20) errors.description = 'Add a description of at least 20 characters.'
  if (!v.category || !CATEGORIES.includes(v.category)) errors.category = 'Choose a category.'
  if (!v.startDate) errors.startDate = 'Choose a start date.'
  if (!v.startTime) errors.startTime = 'Choose a start time.'
  if (!v.endDate) errors.endDate = 'Choose an end date.'
  if (!v.endTime) errors.endTime = 'Choose an end time.'

  let startTs = 0
  let endTs = 0
  if (v.startDate && v.startTime && v.endDate && v.endTime) {
    startTs = new Date(`${v.startDate}T${v.startTime}`).getTime()
    endTs = new Date(`${v.endDate}T${v.endTime}`).getTime()
    if (endTs <= startTs) errors.endTime = 'The event must end after it starts.'
    if (!isEditing && startTs < Date.now()) errors.startDate = 'Start time must be in the future.'
  }

  if (v.mode !== 'online') {
    if (!v.venueName.trim()) errors.venueName = 'Add the venue name.'
    if (!v.address.trim()) errors.address = 'Add the venue address.'
  }

  if (!v.isFree) {
    const p = Number(v.price)
    if (!v.price || Number.isNaN(p) || p <= 0) errors.price = 'Enter a ticket price above 0, or mark the event as free.'
  }

  const cap = Number(v.capacity)
  if (!v.capacity || !Number.isInteger(cap) || cap < 1) errors.capacity = 'Capacity must be a whole number of at least 1.'
  else if (cap > 100000) errors.capacity = 'Capacity looks too large. Please check it.'

  // Team size validation
  const minTeam = Number(v.minTeamSize)
  const maxTeam = Number(v.maxTeamSize)
  if (v.minTeamSize && (!Number.isInteger(minTeam) || minTeam < 1)) {
    errors.minTeamSize = 'Minimum team size must be at least 1.'
  }
  if (v.maxTeamSize && (!Number.isInteger(maxTeam) || maxTeam < 1)) {
    errors.maxTeamSize = 'Maximum team size must be at least 1.'
  } else if (minTeam && maxTeam && maxTeam < minTeam) {
    errors.maxTeamSize = 'Maximum team size must be greater than or equal to minimum team size.'
  }

  // Deadlines validation
  if (v.registrationDeadline && endTs) {
    const regTs = new Date(`${v.registrationDeadline}T23:59:59`).getTime()
    if (regTs > endTs) {
      errors.registrationDeadline = 'Registration deadline cannot be after the event end date.'
    }
  }

  if (v.submissionDeadline && startTs && endTs) {
    const subTs = new Date(`${v.submissionDeadline}T23:59:59`).getTime()
    if (subTs < startTs) {
      errors.submissionDeadline = 'Submission deadline cannot be before the event starts.'
    } else if (subTs > endTs + 86_400_000) {
      errors.submissionDeadline = 'Submission deadline cannot exceed the event conclusion.'
    }
  }

  return errors
}

export function formValuesToInput(v: EventFormValues, status: EventStatus): EventInput {
  const now = new Date()
  // Drafts may be incomplete, so fall back to sensible placeholders that the organizer completes before publishing.
  const startsAt =
    v.startDate && v.startTime ? fromDateTimeInputs(v.startDate, v.startTime) : new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const endsAt =
    v.endDate && v.endTime ? fromDateTimeInputs(v.endDate, v.endTime) : new Date(new Date(startsAt).getTime() + 2 * 3600_000).toISOString()

  const tracks = v.tracks
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  let resolvedLocalityId = v.localityId
  if (resolvedLocalityId === 'custom' || !resolvedLocalityId) {
    const nearest = LOCALITIES.reduce((best, l) => {
      const d = Math.hypot(v.lat - l.lat, v.lng - l.lng)
      return d < best.d ? { id: l.id, d } : best
    }, { id: 'andheri', d: Infinity })
    resolvedLocalityId = nearest.id
  }

  return {
    title: v.title.trim(),
    description: v.description.trim(),
    category: (v.category || 'Technology') as Category,
    posterUrl: v.posterUrl,
    startsAt,
    endsAt,
    venueName: v.mode === 'online' ? (v.venueName.trim() || 'Online / Virtual') : v.venueName.trim(),
    address: v.mode === 'online' ? (v.address.trim() || 'Online Event Platform') : v.address.trim(),
    localityId: resolvedLocalityId,
    lat: v.lat,
    lng: v.lng,
    price: v.isFree ? 0 : Number(v.price) || 0,
    capacity: Number(v.capacity) || 1,
    registrationUrl: v.registrationUrl.trim() || undefined,
    status,
    tags: tracks,

    mode: v.mode,
    eligibility: v.eligibility.trim() || undefined,
    minTeamSize: Number(v.minTeamSize) || 1,
    maxTeamSize: Number(v.maxTeamSize) || 4,
    registrationDeadline: v.registrationDeadline ? new Date(`${v.registrationDeadline}T23:59:59Z`).toISOString() : undefined,
    submissionDeadline: v.submissionDeadline ? new Date(`${v.submissionDeadline}T23:59:59Z`).toISOString() : undefined,
    rules: v.rules.trim() || undefined,
    prizesSummary: v.prizesSummary.trim() || undefined,
    tracks: tracks.length > 0 ? tracks : undefined,
  } as EventInput
}
