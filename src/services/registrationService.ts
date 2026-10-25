import type {
  EventRegistration,
  EventRegistrationAttendee,
  EventRegistrationWithEvent,
  RegistrationStatus,
} from '../types'
import { DEFAULT_LOCALITY_ID } from '../data/localities'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readEvents,
  readFollowedIds,
  readRegistrations,
  readTeamMembers,
  readTeams,
  writeRegistrations,
  writeTeamMembers,
} from './db'
import { defaultFilters, enrichEvent } from './eventService'
import { createNotification } from './notificationService'

function generateTicketCode(): string {
  return `NC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/**
 * Registers the signed-in participant for an event.
 * Enforces authentication, publication status, registration deadlines, capacity, and uniqueness.
 */
export async function registerForEvent(
  eventId: string,
  customAnswers: Record<string, any> = {},
): Promise<EventRegistration> {
  await delay(250)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to register for an event.')
  }

  // 1. Try real Supabase database procedure if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('register_for_event', {
        p_event_id: eventId,
        p_custom_answers: customAnswers,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data) {
        return {
          id: data.id,
          eventId: data.event_id,
          userId: data.user_id,
          status: data.status as RegistrationStatus,
          ticketCode: data.ticket_code,
          customAnswers: data.custom_answers,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase register_for_event fallback to local storage:', err.message)
    }
  }

  // 2. Strict local database operations
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  if (event.status !== 'published') {
    throw new Error('Registration is only open for published events.')
  }

  // Registration deadline check
  if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() <= Date.now()) {
    throw new Error('Registration deadline has passed for this event.')
  }

  // Event completion / end check
  if (new Date(event.endsAt).getTime() < Date.now()) {
    throw new Error('This event has already ended.')
  }

  const registrations = readRegistrations()
  const existing = registrations.find((r) => r.eventId === eventId && r.userId === sessionUser.id)

  if (existing && existing.status === 'confirmed') {
    throw new Error('You are already registered for this event.')
  }

  // Enforce capacity limits atomically
  if (event.capacity > 0) {
    const activeCount = registrations.filter(
      (r) => r.eventId === eventId && (r.status === 'confirmed' || r.status === 'checked_in'),
    ).length
    const totalTaken = activeCount + (event.baseRsvpCount || 0)
    if (totalTaken >= event.capacity) {
      throw new Error('Event capacity has been reached. No more registrations allowed.')
    }
  }

  const nowIso = new Date().toISOString()

  if (existing) {
    // Reactivate previously cancelled registration
    const updated: EventRegistration = {
      ...existing,
      status: 'confirmed',
      customAnswers: { ...existing.customAnswers, ...customAnswers },
      updatedAt: nowIso,
    }
    writeRegistrations(registrations.map((r) => (r.id === existing.id ? updated : r)))
    return updated
  }

  const newReg: EventRegistration = {
    id: `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    userId: sessionUser.id,
    status: 'confirmed',
    ticketCode: generateTicketCode(),
    customAnswers,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  writeRegistrations([...registrations, newReg])

  void createNotification({
    userId: sessionUser.id,
    type: 'registration_confirmed',
    title: `Registration Confirmed: ${event.title}`,
    message: `You're all set! Your ticket pass is ${newReg.ticketCode}. Check your pass under My Events.`,
    link: `/events/${event.id}`,
    data: { eventId: event.id, ticketCode: newReg.ticketCode },
  }).catch(() => {})

  return newReg
}

/**
 * Cancels an existing active registration for the signed-in participant.
 */
export async function cancelRegistration(eventId: string): Promise<void> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to manage registrations.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.rpc('cancel_event_registration', {
        p_event_id: eventId,
      })
      if (error) throw new Error(error.message)
      return
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase cancel_event_registration fallback:', err.message)
    }
  }

  const registrations = readRegistrations()
  const target = registrations.find(
    (r) => r.eventId === eventId && r.userId === sessionUser.id && r.status === 'confirmed',
  )

  if (!target) {
    throw new Error('No active confirmed registration found for this event.')
  }

  const nowIso = new Date().toISOString()
  writeRegistrations(
    registrations.map((r) => (r.id === target.id ? { ...r, status: 'cancelled' as const, updatedAt: nowIso } : r)),
  )

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  void createNotification({
    userId: sessionUser.id,
    type: 'registration_status_changed',
    title: `Registration Cancelled: ${event?.title || 'Event'}`,
    message: `Your registration has been cancelled and your ticket released.`,
    link: `/events/${eventId}`,
    data: { eventId },
  }).catch(() => {})

  // Remove from any teams for this event
  const teams = readTeams()
  const eventTeamIds = new Set(teams.filter((t) => t.eventId === eventId).map((t) => t.id))
  const teamMembers = readTeamMembers()
  const updatedMembers = teamMembers.filter(
    (m) => !(m.userId === sessionUser.id && eventTeamIds.has(m.teamId)),
  )
  writeTeamMembers(updatedMembers)
}

/**
 * Gets the registration record for the specified event for the current user.
 */
export async function getRegistrationForEvent(
  eventId: string,
  userId?: string,
): Promise<EventRegistration | null> {
  const targetUserId = userId ?? authAdapter.getSession()?.id
  if (!targetUserId) return null

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', targetUserId)
        .single()

      if (!error && data) {
        return {
          id: data.id,
          eventId: data.event_id,
          userId: data.user_id,
          status: data.status as RegistrationStatus,
          ticketCode: data.ticket_code,
          customAnswers: data.custom_answers,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      }
    } catch {
      // Fallback
    }
  }

  const registrations = readRegistrations()
  const match = registrations.find(
    (r) => r.eventId === eventId && r.userId === targetUserId && r.status === 'confirmed',
  )
  return match ?? null
}

/**
 * Retrieves all registrations for the signed-in participant, sorted by event dates.
 */
export async function getMyRegistrations(
  localityId: string = DEFAULT_LOCALITY_ID,
  interests: string[] = defaultFilters.interests,
): Promise<{ upcoming: EventRegistrationWithEvent[]; past: EventRegistrationWithEvent[] }> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    return { upcoming: [], past: [] }
  }

  const events = readEvents()
  const registrations = readRegistrations().filter(
    (r) => r.userId === sessionUser.id && (r.status === 'confirmed' || r.status === 'checked_in'),
  )

  const teams = readTeams()
  const teamMembers = readTeamMembers()
  const followedIds = new Set(readFollowedIds())
  const goingIds = new Set(registrations.map((r) => r.eventId))

  const entries: EventRegistrationWithEvent[] = registrations.flatMap((reg) => {
    const event = events.find((e) => e.id === reg.eventId)
    if (!event) return []

    // Look up team membership for this event
    const userMembership = teamMembers.find(
      (m) => m.userId === sessionUser.id && teams.some((t) => t.id === m.teamId && t.eventId === event.id),
    )
    const teamRecord = userMembership ? teams.find((t) => t.id === userMembership.teamId) : null

    const team = teamRecord
      ? {
          ...teamRecord,
          members: teamMembers.filter((m) => m.teamId === teamRecord.id),
          isLeader: teamRecord.leaderId === sessionUser.id,
          isMember: true,
        }
      : null

    const isPast = new Date(event.endsAt).getTime() < Date.now()

    return [
      {
        registration: reg,
        event: enrichEvent(event, { localityId, interests, goingIds, followedIds }),
        isPast,
        team,
      },
    ]
  })

  return {
    upcoming: entries
      .filter((e) => !e.isPast)
      .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt)),
    past: entries
      .filter((e) => e.isPast)
      .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt)),
  }
}

/**
 * Retrieves the attendee roster for an event. Strictly isolated to the organizer of the event.
 */
export async function getEventAttendees(eventId: string): Promise<EventRegistrationAttendee[]> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to view event attendees.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('get_event_attendees', {
        p_event_id: eventId,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data) {
        return data.map((d: any) => ({
          registrationId: d.registration_id,
          userId: d.user_id,
          status: d.status as RegistrationStatus,
          ticketCode: d.ticket_code,
          createdAt: d.created_at,
          userFullName: d.user_full_name || 'Participant',
          userEmail: d.user_email || '',
          userAvatar: d.user_avatar,
          teamId: d.team_id,
          teamName: d.team_name,
          teamRole: d.team_role,
        }))
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase get_event_attendees fallback:', err.message)
    }
  }

  // Local authorization check
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  if (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Only the event organizer can access the attendee roster.')
  }

  const registrations = readRegistrations().filter(
    (r) => r.eventId === eventId && (r.status === 'confirmed' || r.status === 'checked_in'),
  )
  const teams = readTeams().filter((t) => t.eventId === eventId)
  const teamMembers = readTeamMembers()

  return registrations.map((r) => {
    const member = teamMembers.find(
      (m) => m.userId === r.userId && teams.some((t) => t.id === m.teamId),
    )
    const team = member ? teams.find((t) => t.id === member.teamId) : undefined

    return {
      registrationId: r.id,
      userId: r.userId,
      status: r.status,
      ticketCode: r.ticketCode,
      createdAt: r.createdAt,
      userFullName: r.userId === sessionUser.id ? sessionUser.name : `Participant (${r.userId.slice(0, 6)})`,
      userEmail: r.userId === sessionUser.id ? sessionUser.email : `${r.userId.slice(0, 6)}@example.com`,
      userAvatar: r.userId === sessionUser.id ? sessionUser.avatarUrl : undefined,
      teamId: team?.id,
      teamName: team?.name,
      teamRole: member?.role,
    }
  })
}

/**
 * Allows the organizer to update check-in status for an attendee.
 */
export async function updateAttendeeStatus(
  eventId: string,
  registrationId: string,
  newStatus: RegistrationStatus,
): Promise<void> {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event || (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin')) {
    throw new Error('Unauthorized: Only event organizers can update attendee status.')
  }

  const registrations = readRegistrations()
  const target = registrations.find((r) => r.id === registrationId && r.eventId === eventId)
  if (!target) {
    throw new Error('Registration not found.')
  }

  writeRegistrations(
    registrations.map((r) => (r.id === registrationId ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r)),
  )
}
