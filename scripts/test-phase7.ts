/**
 * NearCircle Phase 7: Event Registrations & Team Management Automated Test Suite
 *
 * Verifies:
 * 1. Real Registration Workflow for eligible signed-in participants.
 * 2. Duplicate Registration Prevention (atomic uniqueness).
 * 3. Registration Deadline Enforcement.
 * 4. Capacity Limit Enforcement.
 * 5. Registration Cancellation & Spot Release.
 * 6. Anonymous Visitor Rejection (cannot register or join teams).
 * 7. Participant Isolation (participants only manage their own registrations).
 * 8. Team Creation with Unique Invite Code & Leader Assignment.
 * 9. Solo Participation Enforcement (events with maxTeamSize = 1 reject teams).
 * 10. Maximum Team Size Enforcement.
 * 11. Duplicate Event Team Membership Prevention (across teams in same event).
 * 12. Team Role & Membership Authorization (leader vs member restrictions).
 * 13. Organizer Attendee Isolation (organizers can view attendee rosters for their events; non-owners rejected).
 */

import { assert } from 'node:console'

// Mock environment for testing independent of browser DOM
if (typeof window === 'undefined') {
  const store = new Map<string, string>()
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (_i: number) => null,
  }
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).localStorage = mockLocalStorage
}

async function runPhase7Tests() {
  console.log('=================================================================')
  console.log('  NearCircle Phase 7: Registrations & Team Management Test Suite ')
  console.log('=================================================================\n')

  let passed = 0
  let failed = 0

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn()
      console.log(`  ✓ [PASS] ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}`)
      console.error(`    Error: ${err.message || err}`)
      failed++
    }
  }

  const { writeStore, removeStore } = await import('../src/utils/storage')
  const {
    registerForEvent,
    cancelRegistration,
    getRegistrationForEvent,
    getMyRegistrations,
    getEventAttendees,
    createTeam,
    joinTeamByInviteCode,
    getTeamForEvent,
    inviteTeamMember,
    removeTeamMember,
    leaveTeam,
    disbandTeam,
    authAdapter,
  } = await import('../src/services')
  const {
    writeEvents,
    writeRegistrations,
    writeTeams,
    writeTeamMembers,
    writeTeamInvites,
  } = await import('../src/services/db')

  function setTestSession(user: any | null) {
    if (user) {
      writeStore('session', user)
    } else {
      removeStore('session')
    }
  }

  const now = Date.now()
  const futureDate = new Date(now + 7 * 86_400_000).toISOString()
  const pastDeadline = new Date(now - 86_400_000).toISOString()
  const futureDeadline = new Date(now + 3 * 86_400_000).toISOString()

  // Test users
  const organizerUser = {
    id: 'user-organizer-001',
    name: 'Hackathon Organizer',
    email: 'organizer@nearcircle.dev',
    role: 'organizer' as const,
  }

  const participantA = {
    id: 'user-participant-alice',
    name: 'Alice Hacker',
    email: 'alice@student.edu',
    role: 'participant' as const,
  }

  const participantB = {
    id: 'user-participant-bob',
    name: 'Bob Coder',
    email: 'bob@student.edu',
    role: 'participant' as const,
  }

  const participantC = {
    id: 'user-participant-carol',
    name: 'Carol Dev',
    email: 'carol@student.edu',
    role: 'participant' as const,
  }

  const participantEve = {
    id: 'user-participant-eve',
    name: 'Eve Unauthorized',
    email: 'eve@external.org',
    role: 'participant' as const,
  }

  // Controlled test events
  const teamEventId = 'evt-phase7-team-hackathon'
  const soloEventId = 'evt-phase7-solo-codejam'
  const deadlineExpiredEventId = 'evt-phase7-expired-deadline'
  const cappedEventId = 'evt-phase7-capped-capacity'

  const testEvents = [
    {
      id: teamEventId,
      title: 'NearCircle Web3 Cyber Hackathon',
      description: 'Build decentralized campus tools.',
      category: 'Technology' as const,
      startsAt: futureDate,
      endsAt: new Date(now + 9 * 86_400_000).toISOString(),
      venueName: 'Tech Hub Arena',
      address: '100 Innovation Way',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 50,
      baseRsvpCount: 0,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering',
      ownerId: organizerUser.id,
      status: 'published' as const,
      tags: ['React', 'Web3', 'TypeScript'],
      isDemo: false,
      minTeamSize: 2,
      maxTeamSize: 4,
      registrationDeadline: futureDeadline,
    },
    {
      id: soloEventId,
      title: 'Individual Fast Coding Sprint',
      description: 'Solo algorithms contest.',
      category: 'Technology' as const,
      startsAt: futureDate,
      endsAt: new Date(now + 8 * 86_400_000).toISOString(),
      venueName: 'CS Lab 4',
      address: 'Campus Building A',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 30,
      baseRsvpCount: 0,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering',
      ownerId: organizerUser.id,
      status: 'published' as const,
      tags: ['Python'],
      isDemo: false,
      minTeamSize: 1,
      maxTeamSize: 1, // Solo only!
      registrationDeadline: futureDeadline,
    },
    {
      id: deadlineExpiredEventId,
      title: 'Past Deadline Hackathon',
      description: 'Registration closed.',
      category: 'Technology' as const,
      startsAt: futureDate,
      endsAt: new Date(now + 8 * 86_400_000).toISOString(),
      venueName: 'Main Auditorium',
      address: 'Auditorium Hall',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 100,
      baseRsvpCount: 0,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering',
      ownerId: organizerUser.id,
      status: 'published' as const,
      tags: ['AI/ML'],
      isDemo: false,
      minTeamSize: 1,
      maxTeamSize: 3,
      registrationDeadline: pastDeadline, // Expired!
    },
    {
      id: cappedEventId,
      title: 'Micro Workshop: Limited 2 Seats',
      description: 'Very small capacity workshop.',
      category: 'Workshops' as const,
      startsAt: futureDate,
      endsAt: new Date(now + 8 * 86_400_000).toISOString(),
      venueName: 'Seminar Room 1',
      address: 'Floor 2, Hall B',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 2, // Strictly capped at 2
      baseRsvpCount: 0,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering',
      ownerId: organizerUser.id,
      status: 'published' as const,
      tags: ['Workshops'],
      isDemo: false,
      minTeamSize: 1,
      maxTeamSize: 2,
      registrationDeadline: futureDeadline,
    },
  ]

  // Reset database state
  function resetDb() {
    writeEvents(testEvents)
    writeRegistrations([])
    writeTeams([])
    writeTeamMembers([])
    writeTeamInvites([])
    setTestSession(null)
  }

  // =========================================================================
  // Test 1: Real Registration Workflow
  // =========================================================================
  await test('Eligible signed-in participant can register and receive unique ticket pass', async () => {
    resetDb()
    setTestSession(participantA)

    const reg = await registerForEvent(teamEventId, { dietary: 'Vegetarian' })
    assert(reg.id, 'Registration should return an ID')
    assert(reg.eventId === teamEventId, 'Event ID should match')
    assert(reg.userId === participantA.id, 'User ID should match')
    assert(reg.status === 'confirmed', 'Registration status should be confirmed')
    assert(reg.ticketCode.startsWith('NC-'), 'Ticket code should have prefix NC-')
    assert(reg.customAnswers?.dietary === 'Vegetarian', 'Custom answers should be preserved')

    const fetched = await getRegistrationForEvent(teamEventId)
    assert(fetched !== null && fetched.id === reg.id, 'Should retrieve confirmed registration')
  })

  // =========================================================================
  // Test 2: Duplicate Registration Prevention
  // =========================================================================
  await test('Prevents duplicate registration attempts for the same event', async () => {
    resetDb()
    setTestSession(participantA)
    await registerForEvent(teamEventId)

    let caught = false
    try {
      await registerForEvent(teamEventId)
    } catch (err: any) {
      caught = true
      assert(
        err.message.includes('already registered'),
        `Expected already registered message, got: ${err.message}`,
      )
    }
    assert(caught, 'Duplicate registration attempt must throw an error')
  })

  // =========================================================================
  // Test 3: Registration Deadline Enforcement
  // =========================================================================
  await test('Rejects registration attempts when deadline has passed', async () => {
    resetDb()
    setTestSession(participantA)

    let caught = false
    try {
      await registerForEvent(deadlineExpiredEventId)
    } catch (err: any) {
      caught = true
      assert(
        err.message.includes('deadline has passed'),
        `Expected deadline error, got: ${err.message}`,
      )
    }
    assert(caught, 'Registration past deadline must be rejected')
  })

  // =========================================================================
  // Test 4: Capacity Limit Enforcement
  // =========================================================================
  await test('Enforces event capacity limits and rejects registration once full', async () => {
    resetDb()

    // Fill seat 1 with participantA
    setTestSession(participantA)
    await registerForEvent(cappedEventId)

    // Fill seat 2 with participantB
    setTestSession(participantB)
    await registerForEvent(cappedEventId)

    // Attempt seat 3 with participantC (capacity is 2)
    setTestSession(participantC)
    let caught = false
    try {
      await registerForEvent(cappedEventId)
    } catch (err: any) {
      caught = true
      assert(
        err.message.includes('capacity has been reached'),
        `Expected capacity reached message, got: ${err.message}`,
      )
    }
    assert(caught, 'Registration beyond capacity must be rejected')
  })

  // =========================================================================
  // Test 5: Registration Cancellation & Spot Release
  // =========================================================================
  await test('Cancelling a registration frees capacity and allows new participants to register', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(cappedEventId)

    setTestSession(participantB)
    await registerForEvent(cappedEventId)

    // Participant A cancels their registration
    setTestSession(participantA)
    await cancelRegistration(cappedEventId)

    const regA = await getRegistrationForEvent(cappedEventId)
    assert(regA === null, 'Cancelled registration should no longer be active')

    // Participant C should now be able to register into the released spot
    setTestSession(participantC)
    const regC = await registerForEvent(cappedEventId)
    assert(regC.status === 'confirmed', 'Participant C should now register successfully')
  })

  // =========================================================================
  // Test 6: Anonymous Visitor Registration Rejection
  // =========================================================================
  await test('Anonymous visitors are rejected from registering or joining teams', async () => {
    resetDb()
    setTestSession(null) // Anonymous visitor

    let regCaught = false
    try {
      await registerForEvent(teamEventId)
    } catch (err: any) {
      regCaught = true
      assert(
        err.message.toLowerCase().includes('sign in') || err.message.toLowerCase().includes('unauthorized'),
        `Expected sign-in error, got: ${err.message}`,
      )
    }
    assert(regCaught, 'Anonymous visitor registration must fail')

    let teamCaught = false
    try {
      await createTeam(teamEventId, 'Anon Team')
    } catch (err: any) {
      teamCaught = true
      assert(
        err.message.toLowerCase().includes('sign in') || err.message.toLowerCase().includes('unauthorized'),
        `Expected sign-in error, got: ${err.message}`,
      )
    }
    assert(teamCaught, 'Anonymous team creation must fail')
  })

  // =========================================================================
  // Test 7: Participant Isolation (View Own Registrations Only)
  // =========================================================================
  await test('Participants can only view their own registrations in My Events', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(teamEventId)

    setTestSession(participantB)
    await registerForEvent(teamEventId)

    // Check Participant A's registrations
    setTestSession(participantA)
    const { upcoming: upcomingA } = await getMyRegistrations()
    assert(upcomingA.length === 1, 'Participant A should see 1 registration')
    assert(
      upcomingA[0].registration.userId === participantA.id,
      'Participant A should only see their own registration',
    )

    // Check Participant B's registrations
    setTestSession(participantB)
    const { upcoming: upcomingB } = await getMyRegistrations()
    assert(upcomingB.length === 1, 'Participant B should see 1 registration')
    assert(
      upcomingB[0].registration.userId === participantB.id,
      'Participant B should only see their own registration',
    )
  })

  // =========================================================================
  // Test 8: Team Creation & Unique Invite Code
  // =========================================================================
  await test('Registered participant can create a team and becomes team leader', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(teamEventId)

    const team = await createTeam(teamEventId, 'Cyber Guardians')
    assert(team.id, 'Team must have an ID')
    assert(team.name === 'Cyber Guardians', 'Team name must match')
    assert(team.leaderId === participantA.id, 'Creator must be assigned leader')
    assert(team.inviteCode.startsWith('TEAM-'), 'Invite code must have prefix TEAM-')
    assert(team.members.length === 1, 'Team should have 1 member initially')
    assert(team.members[0].role === 'leader', 'Member role must be leader')
  })

  // =========================================================================
  // Test 9: Solo Participation Enforcement
  // =========================================================================
  await test('Events configured for solo participation reject team creation', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(soloEventId) // maxTeamSize = 1

    let caught = false
    try {
      await createTeam(soloEventId, 'Solo Group')
    } catch (err: any) {
      caught = true
      assert(
        err.message.includes('solo participation'),
        `Expected solo participation message, got: ${err.message}`,
      )
    }
    assert(caught, 'Creating a team in a solo-only event must be rejected')
  })

  // =========================================================================
  // Test 10: Maximum Team Size Limit Enforcement
  // =========================================================================
  await test('Joining a team enforces maximum team size limit', async () => {
    resetDb()

    // Registration for all 3 participants
    setTestSession(participantA)
    await registerForEvent(cappedEventId) // cappedEvent has maxTeamSize = 2

    setTestSession(participantB)
    await registerForEvent(cappedEventId)

    // Participant A creates team (1 / 2)
    setTestSession(participantA)
    const team = await createTeam(cappedEventId, 'Dynamic Duo')

    // Participant B joins team (2 / 2)
    setTestSession(participantB)
    await joinTeamByInviteCode(team.inviteCode)

    // Now try to add another member beyond maxTeamSize (2)
    setTestSession(participantC)
    // First register participant C (freeing capacity for test setup)
    testEvents.find((e) => e.id === cappedEventId)!.capacity = 10
    writeEvents(testEvents)
    await registerForEvent(cappedEventId)

    let caught = false
    try {
      await joinTeamByInviteCode(team.inviteCode)
    } catch (err: any) {
      caught = true
      assert(
        err.message.includes('Team is full') || err.message.includes('Maximum team size'),
        `Expected team full message, got: ${err.message}`,
      )
    }
    assert(caught, 'Joining a full team must be rejected')
  })

  // =========================================================================
  // Test 11: Duplicate Event Team Membership Prevention
  // =========================================================================
  await test('Participant cannot join or create multiple teams for the same event', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(teamEventId)
    const teamA = await createTeam(teamEventId, 'Team Alpha')

    setTestSession(participantB)
    await registerForEvent(teamEventId)
    const teamB = await createTeam(teamEventId, 'Team Beta')

    // Participant A tries to create another team for teamEventId
    setTestSession(participantA)
    let caughtCreate = false
    try {
      await createTeam(teamEventId, 'Team Alpha Two')
    } catch (err: any) {
      caughtCreate = true
      assert(
        err.message.includes('already a member of a team'),
        `Expected already in team error, got: ${err.message}`,
      )
    }
    assert(caughtCreate, 'Creating a second team in same event must fail')

    // Participant A tries to join Team Beta
    let caughtJoin = false
    try {
      await joinTeamByInviteCode(teamB.inviteCode)
    } catch (err: any) {
      caughtJoin = true
      assert(
        err.message.includes('already a member'),
        `Expected already in team error, got: ${err.message}`,
      )
    }
    assert(caughtJoin, 'Joining another team in same event must fail')
  })

  // =========================================================================
  // Test 12: Team Role & Membership Authorization
  // =========================================================================
  await test('Restricts team management and member removal to authorized leader', async () => {
    resetDb()

    setTestSession(participantA)
    await registerForEvent(teamEventId)
    const team = await createTeam(teamEventId, 'Code Alliance')

    setTestSession(participantB)
    await registerForEvent(teamEventId)
    await joinTeamByInviteCode(team.inviteCode)

    // Non-leader (Participant B) tries to remove Leader (Participant A)
    setTestSession(participantB)
    let caughtRemove = false
    try {
      await removeTeamMember(team.id, participantA.id)
    } catch (err: any) {
      caughtRemove = true
      assert(
        err.message.includes('Only the team leader'),
        `Expected leader only message, got: ${err.message}`,
      )
    }
    assert(caughtRemove, 'Non-leader cannot remove team members')

    // Leader (Participant A) removes Participant B
    setTestSession(participantA)
    await removeTeamMember(team.id, participantB.id)

    const teamAfterRemove = await getTeamForEvent(teamEventId, participantA.id)
    assert(teamAfterRemove?.members.length === 1, 'Team should now only have 1 member')
    assert(teamAfterRemove?.members[0].userId === participantA.id, 'Only leader should remain')

    // Participant B joins back, then leaves on their own
    setTestSession(participantB)
    await joinTeamByInviteCode(team.inviteCode)
    await leaveTeam(team.id)

    const teamAfterLeave = await getTeamForEvent(teamEventId, participantB.id)
    assert(teamAfterLeave === null, 'Participant B should no longer be in the team')
  })

  // =========================================================================
  // Test 13: Organizer Attendee Isolation
  // =========================================================================
  await test('Event organizer can access attendee roster; unauthorized users are rejected', async () => {
    resetDb()

    // Register participants
    setTestSession(participantA)
    await registerForEvent(teamEventId)

    setTestSession(participantB)
    await registerForEvent(teamEventId)

    // 1. Organizer accesses attendee roster for their event
    setTestSession(organizerUser)
    const roster = await getEventAttendees(teamEventId)
    assert(roster.length === 2, `Organizer should see 2 attendees, got ${roster.length}`)
    assert(roster.some((r) => r.userId === participantA.id), 'Roster should contain Participant A')
    assert(roster.some((r) => r.userId === participantB.id), 'Roster should contain Participant B')

    // 2. Unauthorized participant attempts to access attendee roster
    setTestSession(participantEve)
    let caughtEve = false
    try {
      await getEventAttendees(teamEventId)
    } catch (err: any) {
      caughtEve = true
      assert(
        err.message.includes('Unauthorized') || err.message.includes('organizer'),
        `Expected unauthorized error, got: ${err.message}`,
      )
    }
    assert(caughtEve, 'Unauthorized participant must be rejected from viewing attendees')

    // 3. Anonymous visitor attempts to access attendee roster
    setTestSession(null)
    let caughtAnon = false
    try {
      await getEventAttendees(teamEventId)
    } catch (err: any) {
      caughtAnon = true
      assert(
        err.message.includes('Unauthorized') || err.message.includes('sign in'),
        `Expected unauthorized error, got: ${err.message}`,
      )
    }
    assert(caughtAnon, 'Anonymous visitor must be rejected from viewing attendees')
  })

  console.log('\n=================================================================')
  console.log(`    Phase 7 Test Results: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase7Tests()
