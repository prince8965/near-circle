import type {
  Team,
  TeamInvite,
  TeamMember,
  TeamWithMembers,
} from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readEvents,
  readRegistrations,
  readTeamInvites,
  readTeamMembers,
  readTeams,
  writeTeamInvites,
  writeTeamMembers,
  writeTeams,
} from './db'

function generateInviteCode(): string {
  return `TEAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/**
 * Creates a new team for an event.
 * Enforces:
 * - Authentication
 * - Event allows teams (maxTeamSize > 1)
 * - User is registered for the event
 * - User does not already belong to any team for this event
 * - Unique team name within the event
 */
export async function createTeam(eventId: string, name: string): Promise<TeamWithMembers> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to create a team.')
  }

  const cleanedName = name.trim()
  if (!cleanedName) {
    throw new Error('Team name cannot be empty.')
  }

  // 1. Supabase RPC if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('create_event_team', {
        p_event_id: eventId,
        p_team_name: cleanedName,
      })

      if (error) throw new Error(error.message)
      if (data) {
        return {
          id: data.id,
          eventId: data.event_id,
          name: data.name,
          inviteCode: data.invite_code,
          leaderId: data.leader_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          members: [
            {
              id: `tm-${Date.now()}`,
              teamId: data.id,
              userId: sessionUser.id,
              role: 'leader',
              joinedAt: new Date().toISOString(),
              user: {
                id: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                avatarUrl: sessionUser.avatarUrl,
              },
            },
          ],
          isLeader: true,
          isMember: true,
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase create_event_team fallback:', err.message)
    }
  }

  // 2. Strict local operations
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  if (event.maxTeamSize !== undefined && event.maxTeamSize <= 1) {
    throw new Error('This event is configured for solo participation only.')
  }

  // Check confirmed registration
  const registrations = readRegistrations()
  const isRegistered = registrations.some(
    (r) => r.eventId === eventId && r.userId === sessionUser.id && (r.status === 'confirmed' || r.status === 'checked_in'),
  )
  if (!isRegistered) {
    throw new Error('You must be registered for this event before creating a team.')
  }

  const teams = readTeams()
  const teamMembers = readTeamMembers()

  // Check duplicate team name in same event
  const duplicateName = teams.some(
    (t) => t.eventId === eventId && t.name.toLowerCase() === cleanedName.toLowerCase(),
  )
  if (duplicateName) {
    throw new Error('A team with this name already exists for this event.')
  }

  // Check duplicate membership across teams in this event
  const alreadyInTeam = teamMembers.some(
    (m) => m.userId === sessionUser.id && teams.some((t) => t.id === m.teamId && t.eventId === eventId),
  )
  if (alreadyInTeam) {
    throw new Error('You are already a member of a team for this event.')
  }

  const nowIso = new Date().toISOString()
  const newTeam: Team = {
    id: `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    name: cleanedName,
    inviteCode: generateInviteCode(),
    leaderId: sessionUser.id,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const leaderMember: TeamMember = {
    id: `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    teamId: newTeam.id,
    userId: sessionUser.id,
    role: 'leader',
    joinedAt: nowIso,
    user: {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      avatarUrl: sessionUser.avatarUrl,
    },
  }

  writeTeams([...teams, newTeam])
  writeTeamMembers([...teamMembers, leaderMember])

  return {
    ...newTeam,
    members: [leaderMember],
    isLeader: true,
    isMember: true,
  }
}

/**
 * Joins a team using an invite code.
 * Enforces:
 * - Authentication
 * - Valid invite code
 * - Registered for event
 * - Team max size limit
 * - No duplicate membership in this or any other team for the event
 */
export async function joinTeamByInviteCode(inviteCode: string): Promise<TeamWithMembers> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to join a team.')
  }

  const cleanCode = inviteCode.trim().toUpperCase()
  if (!cleanCode) {
    throw new Error('Please enter a team invite code.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('join_team_by_code', {
        p_invite_code: cleanCode,
      })
      if (error) throw new Error(error.message)
      if (data) {
        return getTeamById(data.id) as Promise<TeamWithMembers>
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase join_team_by_code fallback:', err.message)
    }
  }

  const teams = readTeams()
  const team = teams.find((t) => t.inviteCode.toUpperCase() === cleanCode)
  if (!team) {
    throw new Error('Invalid invite code. No team found with this code.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === team.eventId)
  if (!event) {
    throw new Error('Event not found for this team.')
  }

  // Registration check
  const registrations = readRegistrations()
  const isRegistered = registrations.some(
    (r) => r.eventId === team.eventId && r.userId === sessionUser.id && (r.status === 'confirmed' || r.status === 'checked_in'),
  )
  if (!isRegistered) {
    throw new Error('You must be registered for this event before joining a team.')
  }

  const teamMembers = readTeamMembers()

  // Check if user is already in any team for this event
  const existingMembership = teamMembers.find(
    (m) => m.userId === sessionUser.id && teams.some((t) => t.id === m.teamId && t.eventId === team.eventId),
  )
  if (existingMembership) {
    if (existingMembership.teamId === team.id) {
      throw new Error('You are already a member of this team.')
    }
    throw new Error('You are already a member of another team for this event.')
  }

  // Check team capacity / max team size limit
  const currentMembers = teamMembers.filter((m) => m.teamId === team.id)
  const maxSize = event.maxTeamSize ?? 4
  if (currentMembers.length >= maxSize) {
    throw new Error(`Team is full. Maximum team size of ${maxSize} members reached.`)
  }

  const newMember: TeamMember = {
    id: `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    teamId: team.id,
    userId: sessionUser.id,
    role: 'member',
    joinedAt: new Date().toISOString(),
    user: {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      avatarUrl: sessionUser.avatarUrl,
    },
  }

  writeTeamMembers([...teamMembers, newMember])

  return {
    ...team,
    members: [...currentMembers, newMember],
    isLeader: team.leaderId === sessionUser.id,
    isMember: true,
  }
}

/**
 * Gets the current user's team for an event.
 */
export async function getTeamForEvent(
  eventId: string,
  userId?: string,
): Promise<TeamWithMembers | null> {
  const targetUserId = userId ?? authAdapter.getSession()?.id
  if (!targetUserId) return null

  const teams = readTeams()
  const teamMembers = readTeamMembers()

  const membership = teamMembers.find(
    (m) => m.userId === targetUserId && teams.some((t) => t.id === m.teamId && t.eventId === eventId),
  )
  if (!membership) return null

  const team = teams.find((t) => t.id === membership.teamId)
  if (!team) return null

  const members = teamMembers
    .filter((m) => m.teamId === team.id)
    .map((m) => ({
      ...m,
      user: {
        id: m.userId,
        name: m.userId === targetUserId ? (authAdapter.getSession()?.name ?? 'Member') : `Participant (${m.userId.slice(0, 6)})`,
        email: m.userId === targetUserId ? (authAdapter.getSession()?.email ?? '') : `${m.userId.slice(0, 6)}@example.com`,
      },
    }))

  return {
    ...team,
    members,
    isLeader: team.leaderId === targetUserId,
    isMember: true,
  }
}

/**
 * Gets a team by ID.
 */
export async function getTeamById(teamId: string): Promise<TeamWithMembers | null> {
  const sessionUser = authAdapter.getSession()
  const teams = readTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) return null

  const teamMembers = readTeamMembers()
  const members = teamMembers
    .filter((m) => m.teamId === team.id)
    .map((m) => ({
      ...m,
      user: {
        id: m.userId,
        name: m.userId === sessionUser?.id ? sessionUser.name : `Participant (${m.userId.slice(0, 6)})`,
        email: m.userId === sessionUser?.id ? sessionUser.email : `${m.userId.slice(0, 6)}@example.com`,
      },
    }))

  return {
    ...team,
    members,
    isLeader: team.leaderId === sessionUser?.id,
    isMember: members.some((m) => m.userId === sessionUser?.id),
  }
}

/**
 * Team leader invites a member via email.
 */
export async function inviteTeamMember(teamId: string, email: string): Promise<TeamInvite> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const teams = readTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) {
    throw new Error('Team not found.')
  }

  if (team.leaderId !== sessionUser.id) {
    throw new Error('Unauthorized: Only the team leader can invite members.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === team.eventId)
  const maxSize = event?.maxTeamSize ?? 4

  const teamMembers = readTeamMembers().filter((m) => m.teamId === team.id)
  if (teamMembers.length >= maxSize) {
    throw new Error(`Team has already reached the maximum limit of ${maxSize} members.`)
  }

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.')
  }

  const invites = readTeamInvites()
  const existing = invites.find(
    (i) => i.teamId === teamId && i.invitedEmail.toLowerCase() === cleanEmail && i.status === 'pending',
  )
  if (existing) {
    throw new Error('An invitation has already been sent to this email.')
  }

  const newInvite: TeamInvite = {
    id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    teamId,
    teamName: team.name,
    eventId: team.eventId,
    eventTitle: event?.title,
    invitedEmail: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  writeTeamInvites([...invites, newInvite])
  return newInvite
}

/**
 * Gets pending invites for the signed-in user.
 */
export async function getMyPendingInvites(): Promise<TeamInvite[]> {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) return []

  const invites = readTeamInvites()
  return invites.filter(
    (i) => (i.invitedEmail.toLowerCase() === sessionUser.email.toLowerCase() || i.invitedUserId === sessionUser.id) && i.status === 'pending',
  )
}

/**
 * Responds to a team invitation (accept or decline).
 */
export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const invites = readTeamInvites()
  const invite = invites.find((i) => i.id === inviteId)
  if (!invite) {
    throw new Error('Invitation not found.')
  }

  if (invite.status !== 'pending') {
    throw new Error('This invitation has already been processed.')
  }

  if (accept) {
    const teams = readTeams()
    const team = teams.find((t) => t.id === invite.teamId)
    if (!team) {
      throw new Error('Team no longer exists.')
    }
    // Join team using the invite code
    await joinTeamByInviteCode(team.inviteCode)
  }

  writeTeamInvites(
    invites.map((i) => (i.id === inviteId ? { ...i, status: accept ? 'accepted' as const : 'declined' as const } : i)),
  )
}

/**
 * Team leader removes a member from the team.
 */
export async function removeTeamMember(teamId: string, memberUserId: string): Promise<void> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const teams = readTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) {
    throw new Error('Team not found.')
  }

  if (team.leaderId !== sessionUser.id) {
    throw new Error('Unauthorized: Only the team leader can remove team members.')
  }

  if (memberUserId === sessionUser.id) {
    throw new Error('Team leader cannot be removed. Disband the team instead.')
  }

  const teamMembers = readTeamMembers()
  const targetMember = teamMembers.find((m) => m.teamId === teamId && m.userId === memberUserId)
  if (!targetMember) {
    throw new Error('Member not found in this team.')
  }

  writeTeamMembers(teamMembers.filter((m) => !(m.teamId === teamId && m.userId === memberUserId)))
}

/**
 * Member leaves a team.
 */
export async function leaveTeam(teamId: string): Promise<void> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const teams = readTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) {
    throw new Error('Team not found.')
  }

  if (team.leaderId === sessionUser.id) {
    // If leader wants to leave, they should disband the team
    throw new Error('As team leader, you must disband the team or transfer leadership to leave.')
  }

  const teamMembers = readTeamMembers()
  writeTeamMembers(teamMembers.filter((m) => !(m.teamId === teamId && m.userId === sessionUser.id)))
}

/**
 * Team leader disbands the team.
 */
export async function disbandTeam(teamId: string): Promise<void> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const teams = readTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) {
    throw new Error('Team not found.')
  }

  if (team.leaderId !== sessionUser.id) {
    throw new Error('Unauthorized: Only the team leader can disband the team.')
  }

  // Remove team and all members
  writeTeams(teams.filter((t) => t.id !== teamId))
  const teamMembers = readTeamMembers()
  writeTeamMembers(teamMembers.filter((m) => m.teamId !== teamId))
}
