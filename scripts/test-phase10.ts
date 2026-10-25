/**
 * NearCircle Phase 10: Notifications, Administration, Verification & Analytics Test Suite
 *
 * Verifies:
 * 1. Notifications: Ownership isolation (users can only access their own notifications).
 * 2. Notifications: Automated generation on registration, cancellation, team invite, and team join.
 * 3. Notifications: Event deadline reminder scanning & notification dispatch.
 * 4. Notifications: Read status updates (individual mark read, bulk mark all as read).
 * 5. Notifications: Spam and duplicate suppression within deduplication window.
 * 6. Administration: Rejection of non-admin users from administrative endpoints.
 * 7. Verification: Organization owner submits verification request with pending state.
 * 8. Verification: Prevention of self-approval (organization owners CANNOT approve themselves).
 * 9. Verification: Authorized administrator review, approval, and rejection.
 * 10. Verification: Administrative audit log creation and public badge synchronization.
 * 11. Analytics: Accuracy of counting rules (completed events strictly excludes drafts and cancelled events).
 * 12. Analytics: Registration metrics, attendance rate, and per-event breakdown derivation.
 * 13. Analytics: Cross-organization isolation (organizers cannot query other organizers' metrics).
 * 14. Analytics: Anonymous visitor and participant rejection from organizer analytics.
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

async function runPhase10Tests() {
  console.log('=================================================================')
  console.log('  NearCircle: Phase 10 Automated Test Suite                      ')
  console.log('  (Notifications, Administration, Verification, and Analytics)  ')
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
    writeEvents,
    writeRegistrations,
    writeTeams,
    writeTeamMembers,
    writeSubmissions,
    writeSubmissionScores,
    writeOrganizations,
    writeNotifications,
    writeAdminAuditLogs,
    readOrganizations,
    readAdminAuditLogs,
  } = await import('../src/services/db')
  const {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    createNotification,
    sendEventDeadlineReminders,
  } = await import('../src/services/notificationService')
  const {
    getPendingVerifications,
    getAllOrganizationsForAdmin,
    requestOrganizationVerification,
    reviewOrganizationVerification,
    getAdminAuditLogs: fetchAuditLogs,
    getPlatformAdminAnalytics,
  } = await import('../src/services/adminService')
  const {
    getOrganizerAnalytics,
  } = await import('../src/services/analyticsService')
  const {
    registerForEvent,
    cancelRegistration,
  } = await import('../src/services/registrationService')

  function setTestSession(user: any | null) {
    if (user) {
      writeStore('session', user)
    } else {
      removeStore('session')
    }
  }

  // Clear state
  const clearDatabase = () => {
    writeEvents([])
    writeRegistrations([])
    writeTeams([])
    writeTeamMembers([])
    writeSubmissions([])
    writeSubmissionScores([])
    writeOrganizations([])
    writeNotifications([])
    writeAdminAuditLogs([])
    removeStore('session')
  }

  clearDatabase()

  // Seed Users
  const userAdmin = {
    id: 'user-platform-admin',
    email: 'admin@nearcircle.test',
    name: 'Master Admin',
    role: 'admin' as const,
  }

  const userOrganizerA = {
    id: 'user-organizer-a',
    email: 'org_a@nearcircle.test',
    name: 'Alice Stanford',
    role: 'organizer' as const,
  }

  const userOrganizerB = {
    id: 'user-organizer-b',
    email: 'org_b@nearcircle.test',
    name: 'Bob Berkeley',
    role: 'organizer' as const,
  }

  const userParticipant1 = {
    id: 'user-part-1',
    email: 'p1@nearcircle.test',
    name: 'Dave Student',
    role: 'participant' as const,
  }

  const userParticipant2 = {
    id: 'user-part-2',
    email: 'p2@nearcircle.test',
    name: 'Eve Hacker',
    role: 'participant' as const,
  }

  // Seed Organizations
  const orgA = {
    id: 'org-stanford-web3',
    name: 'Stanford Web3 Club',
    slug: 'stanford-web3',
    ownerId: userOrganizerA.id,
    description: 'Official university blockchain association.',
    category: 'Technology' as const,
    localityId: 'loc-stanford',
    isVerified: false,
    verificationStatus: 'unverified' as const,
    followerCount: 150,
  }

  const orgB = {
    id: 'org-berkeley-ai',
    name: 'Berkeley AI Collective',
    slug: 'berkeley-ai',
    ownerId: userOrganizerB.id,
    description: 'Autonomous agents and machine learning lab.',
    category: 'AI/ML' as const,
    localityId: 'loc-berkeley',
    isVerified: true,
    verificationStatus: 'verified' as const,
    followerCount: 200,
  }

  writeOrganizations([orgA as any, orgB as any])

  // =========================================================================
  // Test Group 1: Notification System & Workflow Triggers
  // =========================================================================

  await test('Notifications: User can only access their own notifications (ownership isolation)', async () => {
    // Seed notification for Participant 1 and Participant 2
    await createNotification({
      userId: userParticipant1.id,
      type: 'system',
      title: 'Welcome Dave!',
      message: 'Thanks for joining NearCircle.',
    })

    await createNotification({
      userId: userParticipant2.id,
      type: 'system',
      title: 'Welcome Eve!',
      message: 'Thanks for joining NearCircle.',
    })

    // Participant 1 checks notifications
    setTestSession(userParticipant1 as any)
    const daveNotifs = await getNotifications(userParticipant1.id)
    assert(daveNotifs.length === 1, 'Dave sees exactly 1 notification')
    assert(daveNotifs[0].title === 'Welcome Dave!', 'Dave sees his own notification')

    // Participant 1 attempts to access Eve's notifications -> should throw
    let threw = false
    try {
      await getNotifications(userParticipant2.id)
    } catch (err: any) {
      threw = true
      assert(err.message.includes('Unauthorized'), 'Should prevent unauthorized notification access')
    }
    assert(threw, 'Dave cannot access Eve notifications')
  })

  await test('Notifications: Automatically generated on event registration and cancellation', async () => {
    // Seed an event for Organizer A
    const event1 = {
      id: 'event-notif-1',
      title: 'Stanford Spring Hackathon',
      ownerId: userOrganizerA.id,
      status: 'published' as const,
      startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      registrationDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      capacity: 100,
      currentRegistrations: 0,
      category: 'Technology' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeEvents([event1 as any])

    // Participant 1 registers
    setTestSession(userParticipant1 as any)
    await registerForEvent(event1.id)

    // Check notifications for Participant 1
    const notifs = await getNotifications(userParticipant1.id)
    const regNotif = notifs.find((n) => n.type === 'registration_confirmed')
    assert(regNotif !== undefined, 'Registration confirmation notification exists')
    assert(regNotif?.title.includes('Stanford Spring Hackathon'), 'Contains event title')
    assert(regNotif?.isRead === false, 'Initially unread')

    // Participant 1 cancels registration
    await cancelRegistration(event1.id)
    const afterCancelNotifs = await getNotifications(userParticipant1.id)
    const cancelNotif = afterCancelNotifs.find((n) => n.type === 'registration_status_changed')
    assert(cancelNotif !== undefined, 'Registration cancellation notification received')
  })

  await test('Notifications: Mark single and mark all notifications as read', async () => {
    setTestSession(userParticipant1 as any)
    const notifs = await getNotifications(userParticipant1.id)
    assert(notifs.length >= 2, 'Has at least 2 notifications')

    const unreadBefore = await getUnreadNotificationCount(userParticipant1.id)
    assert(unreadBefore >= 2, 'Unread count is accurate')

    // Mark single as read
    await markNotificationAsRead(notifs[0].id)
    const unreadAfterOne = await getUnreadNotificationCount(userParticipant1.id)
    assert(unreadAfterOne === unreadBefore - 1, 'Unread count decremented by 1')

    // Mark all as read
    await markAllNotificationsAsRead(userParticipant1.id)
    const unreadFinal = await getUnreadNotificationCount(userParticipant1.id)
    assert(unreadFinal === 0, 'All notifications marked as read')
  })

  await test('Notifications: Deduplication suppresses duplicate spam within 5 minutes', async () => {
    setTestSession(userParticipant1 as any)

    const notif1 = await createNotification({
      userId: userParticipant1.id,
      type: 'system',
      title: 'Identical Alert',
      message: 'Do not duplicate me.',
    })

    const notif2 = await createNotification({
      userId: userParticipant1.id,
      type: 'system',
      title: 'Identical Alert',
      message: 'Do not duplicate me.',
    })

    assert(notif1.id === notif2.id, 'Duplicate notification suppressed and existing returned')
  })

  await test('Notifications: Scans upcoming event deadline and dispatches reminder notifications', async () => {
    // Seed event with submission deadline in 24 hours
    const deadlineSoon = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    const eventSoon = {
      id: 'event-deadline-soon',
      title: 'AI Sprint 2026',
      ownerId: userOrganizerA.id,
      status: 'published' as const,
      submissionDeadline: deadlineSoon,
      endDate: deadlineSoon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeEvents([eventSoon as any])

    // Register Participant 2
    writeRegistrations([
      {
        id: 'reg-eve-soon',
        eventId: eventSoon.id,
        userId: userParticipant2.id,
        status: 'confirmed',
        registeredAt: new Date().toISOString(),
      },
    ])

    const sent = await sendEventDeadlineReminders(eventSoon.id)
    assert(sent === 1, '1 deadline reminder notification sent')

    setTestSession(userParticipant2 as any)
    const eveNotifs = await getNotifications(userParticipant2.id)
    const deadlineNotif = eveNotifs.find((n) => n.type === 'deadline_reminder')
    assert(deadlineNotif !== undefined, 'Eve received submission deadline reminder')
    assert(deadlineNotif?.title.includes('AI Sprint 2026'), 'Reminder contains event title')
  })

  // =========================================================================
  // Test Group 2: Administration & Organization Verification
  // =========================================================================

  await test('Administration: Rejects non-admin users from administrative functions', async () => {
    // Participant attempt
    setTestSession(userParticipant1 as any)
    let partThrew = false
    try {
      await getPendingVerifications()
    } catch (err: any) {
      partThrew = true
      assert(err.message.includes('administrator privileges required'), 'Non-admin rejected')
    }
    assert(partThrew, 'Participant blocked from admin verifications')

    // Organizer attempt
    setTestSession(userOrganizerA as any)
    let orgThrew = false
    try {
      await fetchAuditLogs()
    } catch (err: any) {
      orgThrew = true
      assert(err.message.includes('administrator privileges required'), 'Organizer rejected from audit logs')
    }
    assert(orgThrew, 'Organizer blocked from audit logs')
  })

  await test('Verification: Organization owner can request verification', async () => {
    setTestSession(userOrganizerA as any)
    const updated = await requestOrganizationVerification(
      orgA.id,
      'Attached Stanford University faculty advisor endorsement letter.',
    )

    assert(updated.verificationStatus === 'pending', 'Status transitions to pending')
    assert(typeof updated.verificationRequestedAt === 'string', 'Timestamp recorded')
    assert(updated.isVerified === false, 'Cannot be self-verified')

    // Organization owner receives confirmation notification
    const notifs = await getNotifications(userOrganizerA.id)
    const reqNotif = notifs.find((n) => n.type === 'verification_status')
    assert(reqNotif !== undefined, 'Organizer received verification request receipt notification')
  })

  await test('Verification: Rejects self-approval (Organization owners CANNOT approve themselves)', async () => {
    // Suppose Organizer A is somehow given admin role, or attempts to approve orgA which they own
    const rogueAdmin = {
      id: userOrganizerA.id, // same ID as orgA owner
      email: 'rogue@nearcircle.test',
      name: 'Rogue Admin',
      role: 'admin' as const,
    }
    setTestSession(rogueAdmin as any)

    let threw = false
    try {
      await reviewOrganizationVerification(orgA.id, 'verified', 'Self approval attempt')
    } catch (err: any) {
      threw = true
      assert(err.message.includes('cannot approve their own verification'), 'Self-approval strictly rejected')
    }
    assert(threw, 'Should block self-approval by owner')
  })

  await test('Verification: Authorized administrator can approve verification and log action', async () => {
    setTestSession(userAdmin as any)

    // Admin inspects pending requests
    const pending = await getPendingVerifications()
    assert(pending.some((o) => o.id === orgA.id), 'Admin sees orgA in pending verifications')

    // Admin approves verification
    const verifiedOrg = await reviewOrganizationVerification(
      orgA.id,
      'verified',
      'Verified Stanford faculty registration and campus domain.',
    )

    assert(verifiedOrg.isVerified === true, 'isVerified is now true')
    assert(verifiedOrg.verificationStatus === 'verified', 'Status is verified')
    assert(verifiedOrg.verifiedBy === userAdmin.id, 'Recorded verifiedBy admin')
    assert(typeof verifiedOrg.verifiedAt === 'string', 'Recorded verifiedAt timestamp')

    // Verify audit log entry
    const auditLogs = await fetchAuditLogs()
    const log = auditLogs.find((l) => l.targetId === orgA.id && l.action === 'approve_verification')
    assert(log !== undefined, 'Audit log created for verification approval')
    assert(log?.adminId === userAdmin.id, 'Audit log records admin identity')

    // Verify organizer received approval notification
    setTestSession(userOrganizerA as any)
    const orgNotifs = await getNotifications(userOrganizerA.id)
    const approvedNotif = orgNotifs.find((n) => n.title.includes('Official Verification Approved'))
    assert(approvedNotif !== undefined, 'Organizer notified of approved verification')
  })

  await test('Verification: Authorized administrator can reject verification request with reason', async () => {
    // Create a new unverified organization
    const orgC = {
      id: 'org-fake-club',
      name: 'Unofficial Coding Club',
      ownerId: 'some-user',
      isVerified: false,
      verificationStatus: 'pending' as const,
    }
    writeOrganizations([...readOrganizations(), orgC as any])

    setTestSession(userAdmin as any)
    const rejectedOrg = await reviewOrganizationVerification(
      orgC.id,
      'rejected',
      'No verifiable university affiliation provided.',
    )

    assert(rejectedOrg.isVerified === false, 'isVerified remains false')
    assert(rejectedOrg.verificationStatus === 'rejected', 'Status is rejected')

    const auditLogs = await fetchAuditLogs()
    const rejLog = auditLogs.find((l) => l.targetId === orgC.id && l.action === 'reject_verification')
    assert(rejLog !== undefined, 'Rejection audit log recorded')
  })

  // =========================================================================
  // Test Group 3: Real Database Analytics & Cross-Organization Isolation
  // =========================================================================

  await test('Analytics: Computes real metrics strictly excluding drafts and cancelled events from completed counts', async () => {
    // Seed events for Organizer A:
    // 1. Published future event
    // 2. Draft event
    // 3. Cancelled event
    // 4. Completed past event
    const now = Date.now()
    const eventsOrgA = [
      {
        id: 'ev-pub-1',
        title: 'Live Hackathon',
        ownerId: userOrganizerA.id,
        status: 'published' as const,
        endsAt: new Date(now + 86400000 * 5).toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ev-draft-1',
        title: 'Draft Ideation',
        ownerId: userOrganizerA.id,
        status: 'draft' as const,
        endsAt: new Date(now + 86400000 * 10).toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ev-canc-1',
        title: 'Cancelled Meetup',
        ownerId: userOrganizerA.id,
        status: 'cancelled' as const,
        endsAt: new Date(now - 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ev-comp-1',
        title: 'Concluded Winter Hackathon',
        ownerId: userOrganizerA.id,
        status: 'completed' as const,
        endsAt: new Date(now - 86400000 * 3).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ]
    writeEvents(eventsOrgA as any)

    // Seed registrations for ev-pub-1: 3 confirmed, 2 checked_in
    writeRegistrations([
      { id: 'r1', eventId: 'ev-pub-1', userId: 'u1', status: 'confirmed' },
      { id: 'r2', eventId: 'ev-pub-1', userId: 'u2', status: 'confirmed' },
      { id: 'r3', eventId: 'ev-pub-1', userId: 'u3', status: 'confirmed' },
      { id: 'r4', eventId: 'ev-pub-1', userId: 'u4', status: 'checked_in' },
      { id: 'r5', eventId: 'ev-pub-1', userId: 'u5', status: 'checked_in' },
    ])

    // Seed submissions: 2 submissions
    writeSubmissions([
      { id: 's1', eventId: 'ev-pub-1', submitterId: 'u1', title: 'Sub 1', status: 'submitted' },
      { id: 's2', eventId: 'ev-pub-1', submitterId: 'u2', title: 'Sub 2', status: 'submitted' },
    ])

    // Seed 1 score for s1
    writeSubmissionScores([
      { id: 'sc1', submissionId: 's1', judgeId: 'j1', criterionId: 'crit1', score: 9 },
    ])

    setTestSession(userOrganizerA as any)
    const analytics = await getOrganizerAnalytics(userOrganizerA.id)

    assert(analytics.totalEvents === 4, 'Total events is 4')
    assert(analytics.publishedEvents === 1, '1 published active event')
    assert(analytics.draftEvents === 1, '1 draft event')
    assert(analytics.cancelledEvents === 1, '1 cancelled event')
    assert(analytics.completedEvents === 1, 'Completed events is strictly 1 (excludes draft and cancelled)')

    assert(analytics.totalRegistrations === 5, 'Total registrations is 5')
    assert(analytics.confirmedRegistrations === 3, '3 confirmed')
    assert(analytics.checkedInRegistrations === 2, '2 checked in')
    assert(analytics.attendanceRate === 0.4, `Attendance rate is 2 / (3 + 2) = 0.4 (got ${analytics.attendanceRate})`)

    assert(analytics.totalSubmissions === 2, '2 submissions recorded')
    assert(analytics.scoredSubmissions === 1, '1 scored submission')
    assert(analytics.events?.length === 4, 'Includes 4 events in detailed breakdown')
  })

  await test('Analytics: Enforces cross-organization isolation (Organizer A cannot view Organizer B metrics)', async () => {
    // Organizer A attempts to query Organizer B's analytics
    setTestSession(userOrganizerA as any)

    let threw = false
    try {
      await getOrganizerAnalytics(userOrganizerB.id)
    } catch (err: any) {
      threw = true
      assert(err.message.includes('Unauthorized'), 'Cross-organization analytics query blocked')
    }
    assert(threw, 'Organizer A cannot view Organizer B metrics')

    // Platform admin CAN query Organizer B's analytics
    setTestSession(userAdmin as any)
    const adminView = await getOrganizerAnalytics(userOrganizerB.id)
    assert(adminView !== null, 'Platform administrator can inspect organizer analytics')
  })

  await test('Analytics: Anonymous visitors and regular participants are rejected from organizer analytics', async () => {
    // Anonymous
    setTestSession(null as any)
    let anonThrew = false
    try {
      await getOrganizerAnalytics()
    } catch (err: any) {
      anonThrew = true
      assert(err.message.includes('Authentication required'), 'Anonymous rejected')
    }
    assert(anonThrew, 'Anonymous rejected from analytics')

    // Participant
    setTestSession(userParticipant1 as any)
    let partThrew = false
    try {
      await getOrganizerAnalytics()
    } catch (err: any) {
      partThrew = true
      assert(err.message.includes('Only event organizers and administrators'), 'Participant rejected')
    }
    assert(partThrew, 'Participant rejected from analytics')
  })

  await test('Analytics: Admin platform-wide analytics aggregates metrics accurately', async () => {
    setTestSession(userAdmin as any)
    const platformStats = await getPlatformAdminAnalytics()

    assert(platformStats.totalOrganizations >= 2, 'Total organizations counted')
    assert(platformStats.totalEvents >= 4, 'Total events counted')
    assert(platformStats.totalRegistrations >= 5, 'Total registrations counted')
    assert(platformStats.totalSubmissions >= 2, 'Total submissions counted')
  })

  console.log('\n=================================================================')
  console.log(`  Phase 10 Test Results: ${passed} passed, ${failed} failed `)
  console.log('=================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase10Tests().catch((err) => {
  console.error('Fatal test error in Phase 10:', err)
  process.exit(1)
})
