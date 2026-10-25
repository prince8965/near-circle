import type { EventWithMeta, RSVP } from '../types'
import { DEFAULT_LOCALITY_ID } from '../data/localities'
import { defaultFilters } from './eventService'
import {
  cancelRegistration,
  getMyRegistrations,
  registerForEvent,
} from './registrationService'

/**
 * Creates an RSVP / Event Registration.
 * Backend equivalent: POST /events/:id/rsvps or RPC register_for_event
 */
export async function createRSVP(eventId: string): Promise<RSVP> {
  const reg = await registerForEvent(eventId)
  return {
    id: reg.id,
    eventId: reg.eventId,
    userId: reg.userId,
    status: reg.status === 'confirmed' || reg.status === 'checked_in' ? 'going' : 'cancelled',
    createdAt: reg.createdAt,
    ticketCode: reg.ticketCode,
  }
}

/** Backend equivalent: DELETE /events/:id/rsvps/me */
export async function cancelRSVP(eventId: string): Promise<void> {
  await cancelRegistration(eventId)
}

export interface MyEventEntry {
  rsvp: RSVP
  event: EventWithMeta
  isPast: boolean
}

/** Backend equivalent: GET /me/rsvps */
export async function getMyEvents(
  localityId: string = DEFAULT_LOCALITY_ID,
  interests: string[] = defaultFilters.interests,
): Promise<{ upcoming: MyEventEntry[]; past: MyEventEntry[] }> {
  const { upcoming, past } = await getMyRegistrations(localityId, interests)
  return {
    upcoming: upcoming.map((e) => ({
      rsvp: {
        id: e.registration.id,
        eventId: e.registration.eventId,
        userId: e.registration.userId,
        status: e.registration.status === 'confirmed' || e.registration.status === 'checked_in' ? 'going' : 'cancelled',
        createdAt: e.registration.createdAt,
        ticketCode: e.registration.ticketCode,
      },
      event: e.event,
      isPast: e.isPast,
    })),
    past: past.map((e) => ({
      rsvp: {
        id: e.registration.id,
        eventId: e.registration.eventId,
        userId: e.registration.userId,
        status: e.registration.status === 'confirmed' || e.registration.status === 'checked_in' ? 'going' : 'cancelled',
        createdAt: e.registration.createdAt,
        ticketCode: e.registration.ticketCode,
      },
      event: e.event,
      isPast: e.isPast,
    })),
  }
}

