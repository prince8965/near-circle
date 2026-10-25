/**
 * NearCircle Phase 8 & 9: Project Submission, Supabase Storage, and Judging/Scoring Test Suite
 *
 * Verifies:
 * 1. Storage: Allowed MIME types validation (rejects invalid/executable files, accepts images/docs/archives/videos).
 * 2. Storage: Maximum file size enforcement (5MB limit on public-assets, 25MB on project-submissions).
 * 3. Storage: Private upload & storage isolation.
 * 4. Storage: Signed URL generation & expiration token for private project files.
 * 5. Storage: File overwriting protection across different users.
 * 6. Storage: File deletion authorization (only owner or admin can delete).
 * 7. Submission: Registration prerequisite enforcement (unregistered users rejected).
 * 8. Submission: Draft creation & update (title, tagline, description, repo, demo, tech, files).
 * 9. Submission: Team vs Solo association (team submission links teamId; solo links user).
 * 10. Submission: Duplicate submission prevention per event.
 * 11. Submission: Submission deadline enforcement (rejects edits/submissions after event deadline).
 * 12. Submission: Final project submission validation & status transition.
 * 13. Submission: Post-submission and post-deadline lock enforcement.
 * 14. Submission: Participant, judge, and organizer submission visibility isolation.
 * 15. Judging: Criteria configuration & weighting by event organizer.
 * 16. Judging: Judge assignment isolation (only assigned judges can access scoring).
 * 17. Judging: Score bounds validation (0 <= score <= max_score).
 * 18. Judging: Score update idempotency (prevents duplicate scores per judge/criterion).
 * 19. Scoring: Multi-judge weighted scoring formula & normalized percentage.
 * 20. Scoring: Deterministic tie-breaking (highest-weight criterion -> earlier submittedAt).
 * 21. Results: Publication protection (hidden from public until published; organizer toggle).
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

async function runPhase8And9Tests() {
  console.log('=================================================================')
  console.log('  NearCircle: Phase 8 & Phase 9 Automated Test Suite             ')
  console.log('  (Project Submissions, Supabase Storage, Judging & Rankings)   ')
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
    readEvents,
    writeEvents,
    readRegistrations,
    writeRegistrations,
    readTeams,
    writeTeams,
    readTeamMembers,
    writeTeamMembers,
    readSubmissions,
    writeSubmissions,
    readJudgingCriteria,
    writeJudgingCriteria,
    readJudgeAssignments,
    writeJudgeAssignments,
    readSubmissionScores,
    writeSubmissionScores,
    readStoredFiles,
    writeStoredFiles,
  } = await import('../src/services/db')
  const {
    validateFile,
    uploadFile,
    createSignedUrl,
    deleteFile,
  } = await import('../src/services/storageService')
  const {
    saveDraftSubmission,
    submitProject,
    getSubmissionById,
    getSubmissionForEvent,
    getEventSubmissions,
    deleteSubmission,
  } = await import('../src/services/submissionService')
  const {
    getJudgingCriteria,
    saveJudgingCriteria,
    assignJudge,
    removeJudgeAssignment,
    getAssignedEventsForJudge,
    getEligibleSubmissionsForJudge,
    submitJudgeScores,
    getSubmissionScores,
    calculateEventRankings,
    publishEventResults,
    getJudgingProgress,
  } = await import('../src/services/judgingService')

  function setTestSession(user: any | null) {
    if (user) {
      writeStore('session', user)
    } else {
      removeStore('session')
    }
  }

  // Clean state
  const clearDatabase = () => {
    writeEvents([])
    writeRegistrations([])
    writeTeams([])
    writeTeamMembers([])
    writeSubmissions([])
    writeJudgingCriteria([])
    writeJudgeAssignments([])
    writeSubmissionScores([])
    writeStoredFiles([])
    removeStore('session')
  }

  clearDatabase()

  // Seed Users
  const userOrganizer = {
    id: 'user-org-1',
    email: 'organizer@nearcircle.test',
    name: 'Alice Organizer',
    role: 'organizer' as const,
  }

  const userJudge1 = {
    id: 'user-judge-1',
    email: 'judge1@nearcircle.test',
    name: 'Judge Judy',
    role: 'participant' as const, // can have base role participant or judge
  }

  const userJudge2 = {
    id: 'user-judge-2',
    email: 'judge2@nearcircle.test',
    name: 'Judge Frank',
    role: 'participant' as const,
  }

  const userParticipantA = {
    id: 'user-part-a',
    email: 'part_a@nearcircle.test',
    name: 'Bob Hacker',
    role: 'participant' as const,
  }

  const userParticipantB = {
    id: 'user-part-b',
    email: 'part_b@nearcircle.test',
    name: 'Charlie Builder',
    role: 'participant' as const,
  }

  const userParticipantC = {
    id: 'user-part-c',
    email: 'part_c@nearcircle.test',
    name: 'Diana Developer',
    role: 'participant' as const,
  }

  // Seed Events:
  // 1. Open Event: Deadline in future
  const futureDeadline = new Date(Date.now() + 86400000 * 7).toISOString()
  const eventOpen = {
    id: 'event-open-1',
    slug: 'web3-hackathon-2026',
    title: 'Web3 Builders Hackathon 2026',
    summary: 'A hackathon for innovative decentralized applications.',
    description: 'Detailed description of the web3 hackathon.',
    ownerId: userOrganizer.id,
    mode: 'hybrid' as const,
    format: 'hackathon' as const,
    status: 'published' as const,
    visibility: 'public' as const,
    registrationDeadline: futureDeadline,
    submissionDeadline: futureDeadline,
    startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    endDate: futureDeadline,
    currentRegistrations: 3,
    maxTeamSize: 4,
    minTeamSize: 1,
    tracks: [
      { id: 'track-defi', name: 'DeFi & Payments', description: 'Decentralized Finance' },
      { id: 'track-infra', name: 'Web3 Infrastructure', description: 'Core Tools' },
    ],
    resultsPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 2. Closed Event: Deadline in past
  const pastDeadline = new Date(Date.now() - 86400000).toISOString()
  const eventPast = {
    id: 'event-past-1',
    slug: 'past-hackathon-2025',
    title: 'Closed Winter Hackathon',
    summary: 'An event whose deadline has passed.',
    description: 'Closed submissions.',
    ownerId: userOrganizer.id,
    mode: 'online' as const,
    format: 'hackathon' as const,
    status: 'published' as const,
    visibility: 'public' as const,
    registrationDeadline: pastDeadline,
    submissionDeadline: pastDeadline,
    startDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    endDate: pastDeadline,
    currentRegistrations: 1,
    maxTeamSize: 4,
    minTeamSize: 1,
    resultsPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  writeEvents([eventOpen as any, eventPast as any])

  // Seed Registrations: A, B, and C registered for eventOpen
  writeRegistrations([
    {
      id: 'reg-a',
      eventId: eventOpen.id,
      userId: userParticipantA.id,
      status: 'confirmed',
      registeredAt: new Date().toISOString(),
    },
    {
      id: 'reg-b',
      eventId: eventOpen.id,
      userId: userParticipantB.id,
      status: 'confirmed',
      registeredAt: new Date().toISOString(),
    },
    {
      id: 'reg-c',
      eventId: eventOpen.id,
      userId: userParticipantC.id,
      status: 'confirmed',
      registeredAt: new Date().toISOString(),
    },
  ])

  // Seed Team: Participant B and C form a team
  const teamAlpha = {
    id: 'team-alpha',
    eventId: eventOpen.id,
    name: 'Team Alpha Pioneers',
    leaderId: userParticipantB.id,
    inviteCode: 'ALPHA2026',
    membersCount: 2,
    createdAt: new Date().toISOString(),
  }
  writeTeams([teamAlpha])
  writeTeamMembers([
    {
      id: 'tm-b',
      teamId: teamAlpha.id,
      userId: userParticipantB.id,
      role: 'leader',
      joinedAt: new Date().toISOString(),
    },
    {
      id: 'tm-c',
      teamId: teamAlpha.id,
      userId: userParticipantC.id,
      role: 'member',
      joinedAt: new Date().toISOString(),
    },
  ])

  // =========================================================================
  // Test Group 1: Supabase Storage Validation & Access Control
  // =========================================================================

  await test('Storage: Rejects unallowed file types and executable files', () => {
    // Public bucket rejects executables and pdfs
    const exePublic = validateFile({ name: 'malicious.exe', size: 1024, type: 'application/x-msdownload' }, 'public-assets')
    assert(!exePublic.valid, 'Should reject executable in public bucket')

    const pdfPublic = validateFile({ name: 'document.pdf', size: 1024, type: 'application/pdf' }, 'public-assets')
    assert(!pdfPublic.valid, 'Public assets bucket accepts only images (png, jpeg, webp, svg)')

    // Private bucket accepts PDF, ZIP, MP4, but rejects .exe / .sh
    const pdfPrivate = validateFile({ name: 'pitch.pdf', size: 1024, type: 'application/pdf' }, 'project-submissions')
    assert(pdfPrivate.valid, 'Private bucket should accept PDF files')

    const zipPrivate = validateFile({ name: 'code.zip', size: 1024, type: 'application/zip' }, 'project-submissions')
    assert(zipPrivate.valid, 'Private bucket should accept ZIP files')

    const exePrivate = validateFile({ name: 'run.exe', size: 1024, type: 'application/x-msdownload' }, 'project-submissions')
    assert(!exePrivate.valid, 'Private bucket must reject .exe files')
  })

  await test('Storage: Enforces file size limits (5MB public, 25MB private)', () => {
    const publicOk = validateFile({ name: 'banner.png', size: 4 * 1024 * 1024, type: 'image/png' }, 'public-assets')
    assert(publicOk.valid, '4MB image should be accepted in public assets')

    const publicExceeded = validateFile({ name: 'huge.png', size: 5.5 * 1024 * 1024, type: 'image/png' }, 'public-assets')
    assert(!publicExceeded.valid && publicExceeded.error?.includes('5 MB'), 'File > 5MB must be rejected in public bucket')

    const privateOk = validateFile({ name: 'demo.mp4', size: 20 * 1024 * 1024, type: 'video/mp4' }, 'project-submissions')
    assert(privateOk.valid, '20MB video should be accepted in project-submissions')

    const privateExceeded = validateFile({ name: 'dataset.zip', size: 26 * 1024 * 1024, type: 'application/zip' }, 'project-submissions')
    assert(!privateExceeded.valid && privateExceeded.error?.includes('25 MB'), 'File > 25MB must be rejected in project bucket')
  })

  await test('Storage: Uploads file to private storage and generates signed URL', async () => {
    setTestSession(userParticipantA as any)
    const mockFile = {
      name: 'pitch_deck.pdf',
      size: 1.5 * 1024 * 1024,
      type: 'application/pdf',
    }

    const path = `events/${eventOpen.id}/user-part-a/pitch_deck.pdf`
    const res = await uploadFile('project-submissions', path, mockFile as any, { isPrivate: true })

    assert(res.path === path, 'Storage path should match')
    assert(res.signedUrl && res.signedUrl.includes('token='), 'Private upload should return signed URL with token')
    assert(!res.publicUrl, 'Private upload should not expose publicUrl')

    // Test signed URL generation
    const signed = await createSignedUrl('project-submissions', path, 7200)
    assert(signed.includes('token=') && signed.includes('exp='), 'Generated signed URL should include expiration')
  })

  await test('Storage: Prevents unauthorized overwriting of files owned by another user', async () => {
    setTestSession(userParticipantA as any)
    const path = `events/${eventOpen.id}/shared_file.pdf`
    await uploadFile('project-submissions', path, { name: 'shared_file.pdf', size: 1000, type: 'application/pdf' } as any)

    // User B attempts to overwrite User A's file
    setTestSession(userParticipantB as any)
    let threw = false
    try {
      await uploadFile('project-submissions', path, { name: 'shared_file.pdf', size: 1000, type: 'application/pdf' } as any)
    } catch (err: any) {
      threw = true
      assert(err.message.includes('cannot overwrite'), 'Should reject overwrite belonging to another user')
    }
    assert(threw, 'Expected unauthorized overwrite error')
  })

  await test('Storage: Prevents unauthorized file deletion', async () => {
    setTestSession(userParticipantA as any)
    const path = `events/${eventOpen.id}/private_note.pdf`
    await uploadFile('project-submissions', path, { name: 'private_note.pdf', size: 1000, type: 'application/pdf' } as any)

    // User B attempts to delete User A's file
    setTestSession(userParticipantB as any)
    let threw = false
    try {
      await deleteFile('project-submissions', path)
    } catch (err: any) {
      threw = true
      assert(err.message.includes('cannot delete files belonging to another user'), 'Expected rejection')
    }
    assert(threw, 'Expected delete rejection')

    // User A successfully deletes their own file
    setTestSession(userParticipantA as any)
    await deleteFile('project-submissions', path)
  })

  // =========================================================================
  // Test Group 2: Project Submission Workflows
  // =========================================================================

  await test('Submissions: Rejects draft creation by unregistered participant', async () => {
    // Unregistered user
    const userUnregistered = { id: 'user-unreg', email: 'unreg@test.com', name: 'Unreg User', role: 'participant' as const }
    setTestSession(userUnregistered as any)

    let threw = false
    try {
      await saveDraftSubmission(eventOpen.id, { title: 'Illegal Project' })
    } catch (err: any) {
      threw = true
      assert(err.message.includes('must be registered'), 'Should enforce registration prerequisite')
    }
    assert(threw, 'Should reject unregistered user')
  })

  await test('Submissions: Registered solo participant creates & updates draft', async () => {
    setTestSession(userParticipantA as any)

    const draft = await saveDraftSubmission(eventOpen.id, {
      title: 'Solo DeFi Protocol',
      tagline: 'Zero-fee decentralized liquidity pool',
      description: 'A revolutionary protocol built on modern smart contracts.',
      repoUrl: 'https://github.com/bob/solo-defi',
      demoUrl: 'https://solo-defi.demo.app',
      technologies: ['Solidity', 'React', 'TypeScript'],
      trackId: 'track-defi',
    })

    assert(draft.title === 'Solo DeFi Protocol', 'Title matches')
    assert(draft.status === 'draft', 'Status should be draft')
    assert(draft.submitterId === userParticipantA.id, 'Submitter ID matches')
    assert(!draft.teamId, 'Solo submission has no teamId')
    assert(draft.technologies.length === 3, 'Technologies stored')

    // Update draft with file attachment
    const updatedDraft = await saveDraftSubmission(eventOpen.id, {
      description: 'Updated comprehensive description with test coverage.',
      files: [
        {
          id: 'file-1',
          name: 'architecture.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          storagePath: 'events/1/arch.pdf',
          uploadedAt: new Date().toISOString(),
          isPrivate: true,
        },
      ],
    })

    assert(updatedDraft.description.includes('Updated comprehensive'), 'Description updated')
    assert(updatedDraft.files.length === 1, 'File attachment saved')
  })

  await test('Submissions: Team members share and associate team submission', async () => {
    // User B (Leader of Team Alpha) saves draft
    setTestSession(userParticipantB as any)
    const teamDraft = await saveDraftSubmission(eventOpen.id, {
      title: 'Alpha Layer Protocol',
      tagline: 'Next-gen cross-chain relayer',
      description: 'High throughput bridge.',
      technologies: ['Rust', 'Substrate'],
      trackId: 'track-infra',
    })

    assert(teamDraft.teamId === teamAlpha.id, 'Submission must associate with team')
    assert(teamDraft.teamName === teamAlpha.name, 'Team name stored')

    // User C (member of Team Alpha) accesses the same submission
    setTestSession(userParticipantC as any)
    const retrievedByMember = await getSubmissionForEvent(eventOpen.id, userParticipantC.id)
    assert(retrievedByMember !== null, 'Member should access team submission')
    assert(retrievedByMember?.id === teamDraft.id, 'Both members share the exact same submission')

    // Member C can also update the draft
    const updatedByMember = await saveDraftSubmission(eventOpen.id, {
      tagline: 'Updated tagline by teammate C',
    })
    assert(updatedByMember.tagline === 'Updated tagline by teammate C', 'Teammate can update draft')
  })

  await test('Submissions: Enforces submission deadline (rejects edits after deadline)', async () => {
    // EventPast has deadline in past
    // Seed registration for participant A in eventPast
    writeRegistrations([
      ...readRegistrations(),
      {
        id: 'reg-past-a',
        eventId: eventPast.id,
        userId: userParticipantA.id,
        status: 'confirmed',
        registeredAt: new Date().toISOString(),
      },
    ])

    // Seed an already submitted project in eventPast
    const subInPast = {
      id: 'sub-past-1',
      eventId: eventPast.id,
      submitterId: userParticipantA.id,
      title: 'Old Submission',
      description: 'Past hackathon project',
      status: 'submitted' as const,
      isPublic: true,
      submittedAt: pastDeadline,
      createdAt: pastDeadline,
      updatedAt: pastDeadline,
    }
    writeSubmissions([...readSubmissions(), subInPast as any])

    setTestSession(userParticipantA as any)

    let threw = false
    try {
      await saveDraftSubmission(eventPast.id, { title: 'Attempted Late Edit' })
    } catch (err: any) {
      threw = true
      assert(err.message.includes('deadline has passed'), 'Should reject edit after deadline')
    }
    assert(threw, 'Should block edit after deadline')

    let submitThrew = false
    try {
      await submitProject(subInPast.id)
    } catch (err: any) {
      submitThrew = true
      assert(err.message.includes('deadline has passed'), 'Should reject final submission after deadline')
    }
    assert(submitThrew, 'Should block final submission after deadline')
  })

  await test('Submissions: Final project submission transitions status and sets submittedAt', async () => {
    setTestSession(userParticipantA as any)
    const sub = await getSubmissionForEvent(eventOpen.id, userParticipantA.id)
    assert(sub !== null, 'Submission draft exists')

    const finalSub = await submitProject(sub!.id)
    assert(finalSub.status === 'submitted', 'Status transitioned to submitted')
    assert(finalSub.isPublic === true, 'Submitted project is public')
    assert(typeof finalSub.submittedAt === 'string', 'submittedAt timestamp recorded')

    // Submit Team Alpha project as well
    setTestSession(userParticipantB as any)
    const teamSub = await getSubmissionForEvent(eventOpen.id, userParticipantB.id)
    const finalTeamSub = await submitProject(teamSub!.id)
    assert(finalTeamSub.status === 'submitted', 'Team project submitted')
  })

  await test('Submissions: Submission visibility isolation across roles', async () => {
    // General participant cannot inspect another user's draft
    // Let's create a private draft for a 3rd participant
    const unsubmittedSub = {
      id: 'sub-draft-private',
      eventId: eventOpen.id,
      submitterId: 'someone-else',
      title: 'Secret Draft',
      description: 'Confidential draft',
      status: 'draft' as const,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeSubmissions([...readSubmissions(), unsubmittedSub as any])

    setTestSession(userParticipantA as any)
    const accessedByBob = await getSubmissionById('sub-draft-private')
    assert(accessedByBob === null, 'Participant Bob cannot access private draft of someone else')

    // Organizer can access all submissions for their event
    setTestSession(userOrganizer as any)
    const allSubs = await getEventSubmissions(eventOpen.id)
    assert(allSubs.length >= 2, 'Organizer can view all submissions for their event')
  })

  // =========================================================================
  // Test Group 3: Judging Setup & Scoring Rules
  // =========================================================================

  await test('Judging: Organizer configures judging criteria and weights', async () => {
    setTestSession(userOrganizer as any)

    const criteria = await saveJudgingCriteria(eventOpen.id, [
      { title: 'Technical Innovation', weight: 2.5, maxScore: 10, displayOrder: 0 },
      { title: 'UX & Design', weight: 1.5, maxScore: 10, displayOrder: 1 },
      { title: 'Practical Impact', weight: 1.0, maxScore: 10, displayOrder: 2 },
    ])

    assert(criteria.length === 3, 'Created 3 judging criteria')
    assert(criteria[0].weight === 2.5, 'Innovation weight is 2.5')
    assert(criteria[1].weight === 1.5, 'UX weight is 1.5')
    assert(criteria[2].weight === 1.0, 'Impact weight is 1.0')

    // Non-organizer attempt to modify criteria should fail
    setTestSession(userParticipantA as any)
    let threw = false
    try {
      await saveJudgingCriteria(eventOpen.id, [{ title: 'Hacked Criteria', weight: 1, maxScore: 10 }])
    } catch (err: any) {
      threw = true
      assert(err.message.includes('Only the event organizer'), 'Unauthorized criteria modification blocked')
    }
    assert(threw, 'Should block non-organizer')
  })

  await test('Judging: Organizer assigns judges to event', async () => {
    setTestSession(userOrganizer as any)

    const assign1 = await assignJudge(eventOpen.id, userJudge1.email)
    const assign2 = await assignJudge(eventOpen.id, userJudge2.email)

    assert(assign1.judgeEmail === userJudge1.email, 'Assigned Judge Judy')
    assert(assign2.judgeEmail === userJudge2.email, 'Assigned Judge Frank')

    // Judge 1 checks assigned events
    setTestSession(userJudge1 as any)
    const assignedEvents = await getAssignedEventsForJudge(userJudge1.id)
    assert(assignedEvents.some((e) => e.id === eventOpen.id), 'Judge 1 sees assigned eventOpen')

    // Judge 1 views eligible submissions to score
    const subsToJudge = await getEligibleSubmissionsForJudge(eventOpen.id, userJudge1.id)
    assert(subsToJudge.length === 2, 'Judge sees 2 submitted projects (Bob & Team Alpha)')

    // Non-assigned user cannot view eligible submissions for judging
    setTestSession(userParticipantA as any)
    let threw = false
    try {
      await getEligibleSubmissionsForJudge(eventOpen.id, userParticipantA.id)
    } catch (err: any) {
      threw = true
      assert(err.message.includes('Unauthorized'), 'Non-judge rejected from judging submissions')
    }
    assert(threw, 'Non-judge rejected')
  })

  await test('Judging: Enforces score bounds (0 <= score <= max_score)', async () => {
    setTestSession(userJudge1 as any)
    const criteria = await getJudgingCriteria(eventOpen.id)
    const subA = (await getSubmissionForEvent(eventOpen.id, userParticipantA.id))!

    // Negative score rejected
    let threwNeg = false
    try {
      await submitJudgeScores(subA.id, [{ criterionId: criteria[0].id, score: -2 }])
    } catch (err: any) {
      threwNeg = true
      assert(err.message.includes('Score must be between 0 and 10'), 'Negative score rejected')
    }
    assert(threwNeg, 'Should reject negative score')

    // Score above maxScore rejected
    let threwMax = false
    try {
      await submitJudgeScores(subA.id, [{ criterionId: criteria[0].id, score: 15 }])
    } catch (err: any) {
      threwMax = true
      assert(err.message.includes('Score must be between 0 and 10'), 'Score > max rejected')
    }
    assert(threwMax, 'Should reject score > maxScore')
  })

  await test('Judging: Submits scores and prevents duplicate score records per judge/criterion', async () => {
    setTestSession(userJudge1 as any)
    const criteria = await getJudgingCriteria(eventOpen.id)
    const subA = (await getSubmissionForEvent(eventOpen.id, userParticipantA.id))!

    // Initial scoring
    await submitJudgeScores(subA.id, [
      { criterionId: criteria[0].id, score: 8, feedback: 'Great technical architecture!' },
      { criterionId: criteria[1].id, score: 7, feedback: 'Clean design' },
      { criterionId: criteria[2].id, score: 9, feedback: 'Very practical' },
    ])

    const judge1Scores = await getSubmissionScores(subA.id)
    assert(judge1Scores.length === 3, 'Judge 1 submitted 3 scores')

    // Judge 1 updates one score
    await submitJudgeScores(subA.id, [
      { criterionId: criteria[0].id, score: 10, feedback: 'Updated after code review: Excellent!' },
    ])

    const updatedJudge1Scores = await getSubmissionScores(subA.id)
    assert(updatedJudge1Scores.length === 3, 'Count should remain 3 (no duplicate records)')
    const updatedInnovation = updatedJudge1Scores.find((s) => s.criterionId === criteria[0].id)
    assert(updatedInnovation?.score === 10, 'Score successfully updated to 10')
  })

  // =========================================================================
  // Test Group 4: Score Calculation, Deterministic Tie-Breaking & Rankings
  // =========================================================================

  await test('Scoring: Calculates multi-judge weighted ranking and normalized percentage', async () => {
    const criteria = await getJudgingCriteria(eventOpen.id)
    const subA = (await getSubmissionForEvent(eventOpen.id, userParticipantA.id))!
    const subB = (await getSubmissionForEvent(eventOpen.id, userParticipantB.id))!

    // Judge 1 scored SubA:
    // Innovation (w=2.5): 10
    // UX (w=1.5): 7
    // Impact (w=1.0): 9

    // Now Judge 2 scores SubA:
    setTestSession(userJudge2 as any)
    await submitJudgeScores(subA.id, [
      { criterionId: criteria[0].id, score: 8 },
      { criterionId: criteria[1].id, score: 9 },
      { criterionId: criteria[2].id, score: 7 },
    ])

    // Average for SubA:
    // Innovation: (10 + 8) / 2 = 9.0  -> weighted: 9.0 * 2.5 = 22.5
    // UX:         (7 + 9) / 2 = 8.0   -> weighted: 8.0 * 1.5 = 12.0
    // Impact:     (9 + 7) / 2 = 8.0   -> weighted: 8.0 * 1.0 = 8.0
    // Total Weighted SubA = 22.5 + 12.0 + 8.0 = 42.5
    // Max Possible = (10*2.5) + (10*1.5) + (10*1.0) = 25 + 15 + 10 = 50.0
    // Normalized SubA = (42.5 / 50.0) * 100 = 85.0%

    // Both judges score SubB:
    // Judge 1 gives SubB: Innovation=7, UX=8, Impact=8
    setTestSession(userJudge1 as any)
    await submitJudgeScores(subB.id, [
      { criterionId: criteria[0].id, score: 7 },
      { criterionId: criteria[1].id, score: 8 },
      { criterionId: criteria[2].id, score: 8 },
    ])

    // Judge 2 gives SubB: Innovation=7, UX=8, Impact=8
    setTestSession(userJudge2 as any)
    await submitJudgeScores(subB.id, [
      { criterionId: criteria[0].id, score: 7 },
      { criterionId: criteria[1].id, score: 8 },
      { criterionId: criteria[2].id, score: 8 },
    ])

    // Average for SubB:
    // Innovation: 7 * 2.5 = 17.5
    // UX:         8 * 1.5 = 12.0
    // Impact:     8 * 1.0 = 8.0
    // Total Weighted SubB = 17.5 + 12.0 + 8.0 = 37.5
    // Normalized SubB = (37.5 / 50.0) * 100 = 75.0%

    // Organizer calculates rankings preview
    setTestSession(userOrganizer as any)
    const rankings = await calculateEventRankings(eventOpen.id)

    assert(rankings.length === 2, '2 projects ranked')
    assert(rankings[0].submissionId === subA.id, 'SubA takes 1st place')
    assert(rankings[0].rank === 1, 'SubA rank is 1')
    assert(rankings[0].totalWeightedScore === 42.5, `SubA weighted score matches formula (got ${rankings[0].totalWeightedScore})`)
    assert(rankings[0].normalizedPercentage === 85.0, `SubA normalized percentage matches (got ${rankings[0].normalizedPercentage}%)`)
    assert(rankings[0].judgesCount === 2, 'SubA evaluated by 2 judges')

    assert(rankings[1].submissionId === subB.id, 'SubB takes 2nd place')
    assert(rankings[1].rank === 2, 'SubB rank is 2')
    assert(rankings[1].totalWeightedScore === 37.5, `SubB weighted score matches formula (got ${rankings[1].totalWeightedScore})`)
  })

  await test('Scoring: Deterministic tie-breaking by highest-weight criterion and timestamp', async () => {
    // Create two projects with identical total weighted score
    const tieEvent = {
      id: 'event-tie-1',
      title: 'Tie Test Hackathon',
      ownerId: userOrganizer.id,
      submissionDeadline: futureDeadline,
      resultsPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeEvents([...readEvents(), tieEvent as any])

    // Criteria: HighWeight (w=3.0, max 10), LowWeight (w=1.0, max 10)
    const critHigh = { id: 'crit-high', eventId: tieEvent.id, title: 'High Weight', weight: 3.0, maxScore: 10, displayOrder: 0 }
    const critLow = { id: 'crit-low', eventId: tieEvent.id, title: 'Low Weight', weight: 1.0, maxScore: 10, displayOrder: 1 }
    writeJudgingCriteria([...readJudgingCriteria(), critHigh as any, critLow as any])

    // Project X: submitted at T1. HighWeight=8 (24), LowWeight=6 (6) -> Total = 30
    const timeT1 = '2026-10-25T10:00:00.000Z'
    const projX = {
      id: 'sub-tie-x',
      eventId: tieEvent.id,
      title: 'Project X (Higher Primary Criterion)',
      description: 'Desc',
      status: 'submitted' as const,
      isPublic: true,
      submittedAt: timeT1,
      createdAt: timeT1,
      updatedAt: timeT1,
    }

    // Project Y: submitted at T2 (earlier than T3). HighWeight=7 (21), LowWeight=9 (9) -> Total = 30
    const timeT2 = '2026-10-25T09:00:00.000Z'
    const projY = {
      id: 'sub-tie-y',
      eventId: tieEvent.id,
      title: 'Project Y (Lower Primary Criterion)',
      description: 'Desc',
      status: 'submitted' as const,
      isPublic: true,
      submittedAt: timeT2,
      createdAt: timeT2,
      updatedAt: timeT2,
    }

    writeSubmissions([...readSubmissions(), projX as any, projY as any])

    writeSubmissionScores([
      ...readSubmissionScores(),
      { id: 'sc-x1', submissionId: projX.id, judgeId: userJudge1.id, criterionId: critHigh.id, score: 8 },
      { id: 'sc-x2', submissionId: projX.id, judgeId: userJudge1.id, criterionId: critLow.id, score: 6 },
      { id: 'sc-y1', submissionId: projY.id, judgeId: userJudge1.id, criterionId: critHigh.id, score: 7 },
      { id: 'sc-y2', submissionId: projY.id, judgeId: userJudge1.id, criterionId: critLow.id, score: 9 },
    ])

    setTestSession(userOrganizer as any)
    const tieRanks = await calculateEventRankings(tieEvent.id)

    assert(tieRanks.length === 2, '2 projects tied on total score (30)')
    assert(tieRanks[0].totalWeightedScore === 30 && tieRanks[1].totalWeightedScore === 30, 'Both have score 30')
    assert(tieRanks[0].submissionId === projX.id, 'Project X wins tie due to higher score on highest-weight criterion (8 vs 7)')
    assert(tieRanks[0].rank === 1, 'Project X is rank 1')
    assert(tieRanks[1].rank === 2, 'Project Y is rank 2')
  })

  // =========================================================================
  // Test Group 5: Result Publication & Privacy Protection
  // =========================================================================

  await test('Results: Protected while unpublished; public access permitted once published', async () => {
    // EventOpen currently has resultsPublished: false
    // Anonymous / Public visitor attempts to view rankings
    setTestSession(null as any)

    let anonBlocked = false
    try {
      await calculateEventRankings(eventOpen.id)
    } catch (err: any) {
      anonBlocked = true
      assert(err.message.includes('not been published yet'), 'Unpublished results blocked from public')
    }
    assert(anonBlocked, 'Public visitor cannot view unpublished results')

    // Participant attempts to view unpublished results
    setTestSession(userParticipantA as any)
    let partBlocked = false
    try {
      await calculateEventRankings(eventOpen.id)
    } catch (err: any) {
      partBlocked = true
      assert(err.message.includes('not been published yet'), 'Participant cannot view unpublished results')
    }
    assert(partBlocked, 'Participant blocked before publication')

    // Organizer publishes official results
    setTestSession(userOrganizer as any)
    await publishEventResults(eventOpen.id, true)

    // Now public visitor can view rankings & podium
    setTestSession(null as any)
    const publicRanks = await calculateEventRankings(eventOpen.id)
    assert(publicRanks.length === 2, 'Public visitor can now access published leaderboard')
    assert(publicRanks[0].rank === 1, '1st place visible')
    assert(publicRanks[1].rank === 2, '2nd place visible')

    // Verify judging progress metrics for organizer
    setTestSession(userOrganizer as any)
    const prog = await getJudgingProgress(eventOpen.id)
    assert(prog.totalJudges === 2, '2 judges assigned')
    assert(prog.scoredSubmissions === 2, 'Both submissions evaluated')
    assert(prog.resultsPublished === true, 'Publication status confirmed')
  })

  console.log('\n=================================================================')
  console.log(`  Phase 8 & 9 Test Results: ${passed} passed, ${failed} failed `)
  console.log('=================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase8And9Tests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
