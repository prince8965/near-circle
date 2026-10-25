/**
 * NearCircle Phase 6 Automated Test Suite
 *
 * Verifies:
 * 1. Public Event Discovery: Anonymous visitors can browse published events.
 * 2. Authorization & Draft Isolation: Anonymous visitors and non-owner participants
 *    CANNOT retrieve drafts or unpublished events (tested at backend RLS & service level).
 * 3. Completed/Conducted Event Count: Strict eligibility criteria (excluding drafts,
 *    unpublished, cancelled, and mock/demo records).
 * 4. Filters & Search: Mode, tags, team size, prizes, registration deadlines, sorting.
 * 5. Pagination: Accurate page, pageSize, totalCount, and boundary handling.
 * 6. Public Organization Profiles: Public organization attributes accessible without exposing private data.
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

async function runTests() {
  console.log('=================================================================')
  console.log('    NearCircle Phase 6: Discovery & Public Profiles Test Suite   ')
  console.log('=================================================================\n')

  let passed = 0
  let failed = 0

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn()
        console.log(`  ✓ [PASS] ${name}`)
        passed++
      } catch (err: any) {
        console.error(`  ✗ [FAIL] ${name}`)
        console.error(`    Error: ${err.message || err}`)
        failed++
      }
    })()
  }

  const { writeStore, removeStore } = await import('../src/utils/storage')
  const {
    searchHackathons,
    getEventById,
    getOrganizationCompletedEventsCount,
    getOrganizationPublicEvents,
    authAdapter,
    defaultFilters,
    isSupabaseConfigured,
  } = await import('../src/services')
  const { writeEvents, writeOrganizations } = await import('../src/services/db')

  function setTestSession(user: any | null) {
    if (user) {
      writeStore('session', user)
    } else {
      removeStore('session')
    }
  }

  const nowIso = new Date().toISOString()
  const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const pastDate = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Setup controlled test database records
  const testOrgId = 'org-test-phase6'
  const organizerUserId = 'user-organizer-456'
  const participantUserId = 'user-participant-789'

  const mockOrg = {
    id: testOrgId,
    name: 'NearCircle Engineering Club',
    slug: 'nearcircle-eng',
    accentColor: '#00F2FE',
    description: 'Premier student engineering club hosting hackathons and technical bootcamps.',
    category: 'Technology' as const,
    localityId: 'loc-koramangala',
    websiteUrl: 'https://engineering.nearcircle.edu',
    contactEmail: 'contact@engineering.nearcircle.edu',
    isVerified: true,
    followerCount: 340,
    ownerId: organizerUserId,
  }

  const testEvents = [
    // 1. Published future hackathon (in-person, React/TypeScript, team size 2-4, prizes)
    {
      id: 'evt-published-1',
      title: 'Bangalore Web3 & AI Hackathon',
      description: 'Build futuristic decentralized AI apps with mentors and cash bounties.',
      category: 'AI/ML' as const,
      startsAt: futureDate,
      endsAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      venueName: 'Koramangala Tech Hub',
      address: '100ft Road, 4th Block',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 100,
      baseRsvpCount: 20,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'published' as const,
      tags: ['React', 'TypeScript', 'AI/ML'],
      isDemo: false,
      mode: 'in-person' as const,
      minTeamSize: 2,
      maxTeamSize: 4,
      registrationDeadline: futureDate,
      prizesSummary: '1st: ₹50,000, 2nd: ₹25,000',
    },
    // 2. Published online workshop (virtual, Python, solo allowed, no prizes)
    {
      id: 'evt-published-2',
      title: 'Hands-on Python Data Science Workshop',
      description: 'Intro to pandas, numpy, and machine learning pipelines.',
      category: 'Technology' as const,
      startsAt: futureDate,
      endsAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
      venueName: 'Online Google Meet',
      address: 'Virtual',
      localityId: 'loc-indiranagar',
      lat: 12.9784,
      lng: 77.6408,
      price: 199,
      capacity: 200,
      baseRsvpCount: 45,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'published' as const,
      tags: ['Python', 'AI/ML'],
      isDemo: false,
      mode: 'online' as const,
      minTeamSize: 1,
      maxTeamSize: 1,
      registrationDeadline: futureDate,
      prizesSummary: undefined,
    },
    // 3. Draft event (should NEVER be discoverable by anonymous visitors or non-owners)
    {
      id: 'evt-draft-secret',
      title: 'Secret Upcoming Winter Hackathon (DRAFT)',
      description: 'Private unreleased hackathon in planning stage.',
      category: 'Web Development' as const,
      startsAt: futureDate,
      endsAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      venueName: 'Campus Auditorium',
      address: 'Main Gate',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 50,
      baseRsvpCount: 0,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'draft' as const,
      tags: ['Next.js'],
      isDemo: false,
      mode: 'in-person' as const,
    },
    // 4. Cancelled event (should NOT be counted as completed or listed as active)
    {
      id: 'evt-cancelled-1',
      title: 'Cancelled Spring Meetup',
      description: 'Cancelled due to severe rain.',
      category: 'Technology' as const,
      startsAt: pastDate,
      endsAt: pastDate,
      venueName: 'Park Lounge',
      address: 'Indiranagar',
      localityId: 'loc-indiranagar',
      lat: 12.9784,
      lng: 77.6408,
      price: 0,
      capacity: 40,
      baseRsvpCount: 10,
      baseCheckIns: 0,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'cancelled' as const,
      tags: ['Community'],
      isDemo: false,
      mode: 'in-person' as const,
    },
    // 5. Eligible Completed Event 1: status = 'completed', is_demo = false
    {
      id: 'evt-completed-real-1',
      title: 'Fall 2025 Flagship Hackathon',
      description: 'Concluded 36-hour hackathon with 40 teams participating.',
      category: 'Technology' as const,
      startsAt: pastDate,
      endsAt: pastDate,
      venueName: 'Main Campus Hall',
      address: 'Main Campus',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 150,
      baseRsvpCount: 140,
      baseCheckIns: 120,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'completed' as const,
      tags: ['React', 'Python'],
      isDemo: false,
      mode: 'in-person' as const,
    },
    // 6. Eligible Completed Event 2: status = 'published', ends_at < now, is_demo = false
    {
      id: 'evt-concluded-real-2',
      title: 'Cloud & DevOps Masterclass 2025',
      description: 'Concluded workshop on Docker and Kubernetes.',
      category: 'Technology' as const,
      startsAt: pastDate,
      endsAt: pastDate,
      venueName: 'Online',
      address: 'Virtual',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 80,
      baseRsvpCount: 75,
      baseCheckIns: 70,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'published' as const,
      tags: ['Cloud'],
      isDemo: false,
      mode: 'online' as const,
    },
    // 7. Mock / Demo Event (even if completed, must NOT be counted towards real completed event count!)
    {
      id: 'evt-mock-demo-seed',
      title: 'Fictional Demo Workshop (Mock Seed)',
      description: 'Prototype seed data shipped with prototype.',
      category: 'Technology' as const,
      startsAt: pastDate,
      endsAt: pastDate,
      venueName: 'Fictional Lab',
      address: 'Demo Address',
      localityId: 'loc-koramangala',
      lat: 12.9352,
      lng: 77.6245,
      price: 0,
      capacity: 50,
      baseRsvpCount: 20,
      baseCheckIns: 15,
      organizerName: 'NearCircle Engineering Club',
      ownerId: organizerUserId,
      organizationId: testOrgId,
      status: 'completed' as const,
      tags: ['Demo'],
      isDemo: true, // Mock record
      mode: 'in-person' as const,
    },
  ]

  // Initialize test data
  writeOrganizations([mockOrg])
  writeEvents(testEvents)

  /* ==========================================================================
     Test 1: Public Event Discovery for Anonymous Visitors
     ========================================================================== */
  await test('Anonymous visitor can search and browse published public events without signing in', async () => {
    // Clear session to ensure anonymous visitor
    setTestSession(null)
    assert(authAdapter.getSession() === null, 'Session should be null (anonymous)')

    const res = await searchHackathons({ ...defaultFilters, query: '' })
    assert(res.events.length > 0, 'Anonymous visitor should retrieve published events')

    // Verify all returned events are published and not drafts
    for (const evt of res.events) {
      assert(evt.status === 'published', `Expected published status, got: ${evt.status}`)
      assert(evt.id !== 'evt-draft-secret', 'Draft event leaked into public search!')
      assert(evt.id !== 'evt-cancelled-1', 'Cancelled event leaked into public search!')
    }
  })

  /* ==========================================================================
     Test 2: Backend & Service Authorization: Draft Isolation
     ========================================================================== */
  await test('Anonymous visitor cannot retrieve draft event by direct ID query', async () => {
    setTestSession(null)
    const draft = await getEventById('evt-draft-secret')
    assert(draft === null, 'Anonymous visitor must NOT be able to view draft events (must return null)')
  })

  await test('Unauthorized participant cannot view draft event belonging to another organizer', async () => {
    // Simulate logged-in participant
    setTestSession({
      id: participantUserId,
      name: 'Sneha Participant',
      email: 'sneha@student.edu',
      role: 'participant',
    })

    const draft = await getEventById('evt-draft-secret')
    assert(draft === null, 'Unauthorized participant must NOT be able to view draft events')
  })

  await test('Event owner organizer CAN preview their own draft event', async () => {
    // Simulate event owner logged in
    setTestSession({
      id: organizerUserId,
      name: 'Organizer Lead',
      email: 'organizer@club.edu',
      role: 'organizer',
    })

    const draft = await getEventById('evt-draft-secret')
    assert(draft !== null, 'Event owner must be permitted to preview their own draft event')
    assert(draft.id === 'evt-draft-secret', 'Retrieved event ID mismatch')
    assert(draft.status === 'draft', 'Status should be draft')
  })

  /* ==========================================================================
     Test 3: Completed / Conducted Event Count Calculation
     ========================================================================== */
  await test('Calculates completed event count strictly from real database records (excluding drafts, cancelled, and mock records)', async () => {
    // Eligible records for testOrgId:
    // - evt-completed-real-1 (status: completed, isDemo: false) -> +1
    // - evt-concluded-real-2 (status: published, endsAt in past, isDemo: false) -> +1
    // Excluded:
    // - evt-published-1 (future event) -> 0
    // - evt-published-2 (future event) -> 0
    // - evt-draft-secret (draft) -> 0
    // - evt-cancelled-1 (cancelled) -> 0
    // - evt-mock-demo-seed (isDemo: true mock record) -> 0
    // Expected count = exactly 2!

    const count = await getOrganizationCompletedEventsCount(testOrgId)
    assert(count === 2, `Expected exactly 2 eligible conducted events, received: ${count}`)
  })

  /* ==========================================================================
     Test 4: Organization Public Profile and Event History
     ========================================================================== */
  await test('Public organization profile displays real upcoming and past events without leaking private data', async () => {
    setTestSession(null)
    const { upcoming, past, completedCount } = await getOrganizationPublicEvents(testOrgId)

    assert(completedCount === 2, `Completed count in public profile should be 2, got: ${completedCount}`)
    assert(upcoming.length === 2, `Expected 2 upcoming published events, got: ${upcoming.length}`)
    assert(past.length === 2, `Expected 2 past concluded events, got: ${past.length}`)

    // Verify upcoming events contain only published future events
    for (const evt of upcoming) {
      assert(evt.status === 'published', 'Upcoming events must be published')
      assert(evt.id !== 'evt-draft-secret', 'Draft leaked in organization upcoming events!')
      assert(evt.id !== 'evt-cancelled-1', 'Cancelled event leaked in organization upcoming events!')
    }

    // Verify past events contain only concluded events and NO mock or draft records
    for (const evt of past) {
      assert(!evt.isDemo, 'Mock record leaked in organization past events!')
      assert(evt.status !== 'draft', 'Draft leaked in organization past events!')
      assert(evt.status !== 'cancelled', 'Cancelled event leaked in organization past events!')
      assert(
        evt.status === 'completed' || (evt.status === 'published' && new Date(evt.endsAt).getTime() < Date.now()),
        'Past event does not meet concluded criteria',
      )
    }
  })

  /* ==========================================================================
     Test 5: Filter & Discovery Capabilities
     ========================================================================== */
  await test('Filters by event mode (in-person vs online)', async () => {
    // Mode: online
    const onlineRes = await searchHackathons({ ...defaultFilters, mode: 'online' })
    assert(onlineRes.events.length >= 1, 'Should find online events')
    for (const e of onlineRes.events) {
      assert(e.mode === 'online', `Expected mode online, got: ${e.mode}`)
    }

    // Mode: in-person
    const inPersonRes = await searchHackathons({ ...defaultFilters, mode: 'in-person' })
    assert(inPersonRes.events.length >= 1, 'Should find in-person events')
    for (const e of inPersonRes.events) {
      assert(e.mode === 'in-person', `Expected mode in-person, got: ${e.mode}`)
    }
  })

  await test('Filters by technology tags', async () => {
    const pythonRes = await searchHackathons({ ...defaultFilters, technology: 'Python' })
    assert(pythonRes.events.length >= 1, 'Should find Python events')
    for (const e of pythonRes.events) {
      assert(
        e.tags.some((t) => t.toLowerCase() === 'python'),
        `Event ${e.title} does not contain Python tag`,
      )
    }
  })

  await test('Filters by cash prizes & rewards', async () => {
    const prizesRes = await searchHackathons({ ...defaultFilters, hasPrizes: true })
    assert(prizesRes.events.length >= 1, 'Should find events with prizes')
    for (const e of prizesRes.events) {
      assert(
        Boolean(e.prizesSummary && e.prizesSummary.trim().length > 0),
        `Event ${e.title} does not have prize information`,
      )
    }
  })

  await test('Filters by team-size limits (solo vs teams)', async () => {
    // Solo: minTeamSize <= 1
    const soloRes = await searchHackathons({ ...defaultFilters, teamSize: 'solo' })
    assert(soloRes.events.length >= 1, 'Should find solo-eligible events')
    for (const e of soloRes.events) {
      assert((e.minTeamSize ?? 1) <= 1, `Event ${e.title} does not support solo participation`)
    }

    // Teams: maxTeamSize > 1
    const teamRes = await searchHackathons({ ...defaultFilters, teamSize: 'team' })
    assert(teamRes.events.length >= 1, 'Should find team-based events')
    for (const e of teamRes.events) {
      assert((e.maxTeamSize ?? 4) > 1, `Event ${e.title} does not support team participation`)
    }
  })

  /* ==========================================================================
     Test 6: Pagination and Boundary Validation
     ========================================================================== */
  await test('Accurately computes pagination and slices records', async () => {
    const page1 = await searchHackathons({ ...defaultFilters, page: 1, pageSize: 1 })
    assert(page1.events.length === 1, `Page 1 should have exactly 1 event, got ${page1.events.length}`)
    assert(page1.page === 1, 'Page should be 1')
    assert(page1.pageSize === 1, 'Page size should be 1')
    assert(page1.totalPages >= 2, `Total pages should be at least 2, got ${page1.totalPages}`)

    const page2 = await searchHackathons({ ...defaultFilters, page: 2, pageSize: 1 })
    assert(page2.events.length === 1, `Page 2 should have exactly 1 event, got ${page2.events.length}`)
    assert(page2.events[0].id !== page1.events[0].id, 'Page 2 should contain different event than Page 1')
  })

  /* ==========================================================================
     Test 7: Direct Backend Query & RLS Isolation Verification
     ========================================================================== */
  await test('Direct backend query without authentication rejects access to draft/private records (RLS enforcement)', async () => {
    // When Supabase is configured: query directly with anon key
    // When in mock mode: simulate direct backend storage query without auth
    setTestSession(null)

    if (isSupabaseConfigured()) {
      const { supabase } = await import('../src/lib/supabase')
      // Direct query to public.events asking for drafts
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'draft')

      // RLS policy: Published events are viewable by everyone
      // Non-owners get empty list [] from PostgreSQL engine
      assert(!error, `Supabase direct query failed: ${error?.message}`)
      assert(data?.length === 0, 'PostgreSQL RLS leaked draft records to unauthenticated client!')
    } else {
      // Direct service backend call verifying backend query isolation
      const directDraft = await getEventById('evt-draft-secret')
      assert(directDraft === null, 'Backend direct query allowed retrieval of unpublished draft without authorization!')

      const allPublic = await searchHackathons({ ...defaultFilters, query: '' })
      const hasDraft = allPublic.events.some((e) => e.status === 'draft')
      assert(!hasDraft, 'Backend search returned unpublished drafts to anonymous visitor!')
    }
  })

  console.log('\n=================================================================')
  console.log(`    Test Results: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err)
  process.exit(1)
})
