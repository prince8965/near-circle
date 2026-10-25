import type {
  Event,
  JudgeAssignment,
  JudgingCriterion,
  JudgingProgress,
  ProjectSubmission,
  SubmissionRanking,
  SubmissionScore,
} from '../types'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readEvents,
  readJudgeAssignments,
  readJudgingCriteria,
  readSubmissions,
  readSubmissionScores,
  writeEvents,
  writeJudgeAssignments,
  writeJudgingCriteria,
  writeSubmissionScores,
} from './db'

/**
 * Gets all judging criteria configured for an event.
 */
export async function getJudgingCriteria(eventId: string): Promise<JudgingCriterion[]> {
  await delay(100)
  const all = readJudgingCriteria()
  return all
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Saves or updates judging criteria for an event. Organizer-only.
 */
export async function saveJudgingCriteria(
  eventId: string,
  criteriaList: Partial<JudgingCriterion>[],
): Promise<JudgingCriterion[]> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event || (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin')) {
    throw new Error('Unauthorized: Only the event organizer can configure judging criteria.')
  }

  const allCriteria = readJudgingCriteria()
  const otherCriteria = allCriteria.filter((c) => c.eventId !== eventId)

  const validated: JudgingCriterion[] = criteriaList.map((c, idx) => {
    const title = (c.title || `Criterion ${idx + 1}`).trim()
    const weight = Number(c.weight) > 0 ? Number(c.weight) : 1.0
    const maxScore = Number(c.maxScore) > 0 ? Math.floor(Number(c.maxScore)) : 10

    return {
      id: c.id ?? `crit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      eventId,
      title,
      description: c.description ?? '',
      weight,
      maxScore,
      displayOrder: c.displayOrder ?? idx,
      createdAt: c.createdAt ?? new Date().toISOString(),
    }
  })

  writeJudgingCriteria([...otherCriteria, ...validated])
  return validated
}

/**
 * Assigns a judge to an event (by email or user ID). Organizer-only.
 */
export async function assignJudge(
  eventId: string,
  judgeEmail: string,
  trackId?: string,
): Promise<JudgeAssignment> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event || (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin')) {
    throw new Error('Unauthorized: Only event organizers can assign judges.')
  }

  const cleanEmail = judgeEmail.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid judge email address.')
  }

  const assignments = readJudgeAssignments()
  const existing = assignments.find(
    (a) => a.eventId === eventId && a.judgeEmail?.toLowerCase() === cleanEmail && a.trackId === trackId,
  )
  if (existing) {
    throw new Error('This judge is already assigned to this event track.')
  }

  const newAssignment: JudgeAssignment = {
    id: `asgn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    judgeId: `judge-${cleanEmail.replace(/[^a-z0-9]/g, '')}`,
    judgeName: cleanEmail.split('@')[0],
    judgeEmail: cleanEmail,
    trackId,
    createdAt: new Date().toISOString(),
  }

  writeJudgeAssignments([...assignments, newAssignment])
  return newAssignment
}

/**
 * Removes a judge assignment. Organizer-only.
 */
export async function removeJudgeAssignment(assignmentId: string): Promise<void> {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const assignments = readJudgeAssignments()
  const assignment = assignments.find((a) => a.id === assignmentId)
  if (!assignment) return

  const events = readEvents()
  const event = events.find((e) => e.id === assignment.eventId)
  if (!event || (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin')) {
    throw new Error('Unauthorized: Only the event organizer can remove judge assignments.')
  }

  writeJudgeAssignments(assignments.filter((a) => a.id !== assignmentId))
}

/**
 * Gets all judge assignments for an event.
 */
export async function getEventJudges(eventId: string): Promise<JudgeAssignment[]> {
  await delay(100)
  return readJudgeAssignments().filter((a) => a.eventId === eventId)
}

/**
 * Gets events assigned to the logged-in judge.
 */
export async function getAssignedEventsForJudge(judgeId?: string): Promise<Event[]> {
  const sessionUser = authAdapter.getSession()
  const targetId = judgeId ?? sessionUser?.id
  const targetEmail = sessionUser?.email?.toLowerCase()
  if (!targetId && !targetEmail) return []

  const assignments = readJudgeAssignments()
  const assignedEventIds = new Set(
    assignments
      .filter((a) => a.judgeId === targetId || (targetEmail && a.judgeEmail?.toLowerCase() === targetEmail))
      .map((a) => a.eventId),
  )

  const events = readEvents()
  return events.filter((e) => assignedEventIds.has(e.id))
}

/**
 * Gets eligible submissions for a judge to review for an assigned event.
 */
export async function getEligibleSubmissionsForJudge(
  eventId: string,
  judgeId?: string,
): Promise<ProjectSubmission[]> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  const targetId = judgeId ?? sessionUser?.id
  const targetEmail = sessionUser?.email?.toLowerCase()

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) throw new Error('Event not found.')

  const isOwner = event.ownerId === sessionUser?.id
  const assignments = readJudgeAssignments().filter((a) => a.eventId === eventId)
  const judgeAssignment = assignments.find(
    (a) => a.judgeId === targetId || (targetEmail && a.judgeEmail?.toLowerCase() === targetEmail),
  )

  if (!isOwner && !judgeAssignment && sessionUser?.role !== 'admin') {
    throw new Error('Unauthorized: You are not assigned as a judge for this event.')
  }

  const submissions = readSubmissions().filter(
    (s) => s.eventId === eventId && s.status !== 'draft',
  )

  // Track filter if judge is assigned to a specific track
  if (judgeAssignment?.trackId) {
    return submissions.filter((s) => s.trackId === judgeAssignment.trackId)
  }

  return submissions
}

/**
 * Submits judge scores for a project. Validates bounds, assignment, and uniqueness.
 */
export async function submitJudgeScores(
  submissionId: string,
  scoreEntries: { criterionId: string; score: number; feedback?: string }[],
): Promise<void> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const submissions = readSubmissions()
  const submission = submissions.find((s) => s.id === submissionId)
  if (!submission) {
    throw new Error('Submission not found.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === submission.eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  // Prevent scoring after results published
  if (event.resultsPublished) {
    throw new Error('Judging has closed and results have been published. Scores cannot be modified.')
  }

  // Verify judge assignment
  const isOwner = event.ownerId === sessionUser.id
  const assignments = readJudgeAssignments()
  const isAssigned = assignments.some(
    (a) =>
      a.eventId === event.id &&
      (a.judgeId === sessionUser.id || a.judgeEmail?.toLowerCase() === sessionUser.email?.toLowerCase()),
  )

  if (!isOwner && !isAssigned && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Only judges assigned to this event can submit scores.')
  }

  const criteria = readJudgingCriteria().filter((c) => c.eventId === event.id)
  const allScores = readSubmissionScores()
  const nowIso = new Date().toISOString()

  for (const entry of scoreEntries) {
    const crit = criteria.find((c) => c.id === entry.criterionId)
    if (!crit) {
      throw new Error(`Invalid judging criterion ID "${entry.criterionId}".`)
    }

    if (entry.score < 0 || entry.score > crit.maxScore) {
      throw new Error(
        `Invalid score ${entry.score} for "${crit.title}". Score must be between 0 and ${crit.maxScore}.`,
      )
    }

    const existingScoreIdx = allScores.findIndex(
      (s) =>
        s.submissionId === submissionId &&
        s.judgeId === sessionUser.id &&
        s.criterionId === entry.criterionId,
    )

    const scoreRecord: SubmissionScore = {
      id:
        existingScoreIdx >= 0
          ? allScores[existingScoreIdx].id
          : `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      submissionId,
      judgeId: sessionUser.id,
      judgeName: sessionUser.name,
      criterionId: entry.criterionId,
      criterionTitle: crit.title,
      score: entry.score,
      feedback: entry.feedback?.trim() || undefined,
      createdAt: existingScoreIdx >= 0 ? allScores[existingScoreIdx].createdAt : nowIso,
      updatedAt: nowIso,
    }

    if (existingScoreIdx >= 0) {
      allScores[existingScoreIdx] = scoreRecord
    } else {
      allScores.push(scoreRecord)
    }
  }

  writeSubmissionScores(allScores)
}

/**
 * Gets submission scores.
 * Restricted to the judging author or the event organizer.
 */
export async function getSubmissionScores(submissionId: string): Promise<SubmissionScore[]> {
  await delay(100)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const submissions = readSubmissions()
  const sub = submissions.find((s) => s.id === submissionId)
  if (!sub) return []

  const events = readEvents()
  const event = events.find((e) => e.id === sub.eventId)
  const isOwner = event?.ownerId === sessionUser.id

  const allScores = readSubmissionScores().filter((s) => s.submissionId === submissionId)

  if (isOwner || sessionUser.role === 'admin') {
    return allScores
  }

  // Judge sees only their own scores
  return allScores.filter((s) => s.judgeId === sessionUser.id)
}

/**
 * Calculates event rankings and leaderboard based on weighted criteria averages.
 * Formula:
 *  Weighted Score = SUM(Average Judge Score for Criterion c * Weight c)
 *  Normalized % = (Weighted Score / Total Max Possible Weighted Score) * 100
 *
 * Tie handling:
 *  1. Higher weighted score
 *  2. Higher score in highest-weight criterion
 *  3. Earlier final submission timestamp (submittedAt ASC)
 *  4. Tied ranks assigned same rank (1, 2, 2, 4)
 */
export async function calculateEventRankings(eventId: string): Promise<SubmissionRanking[]> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  // Permission check: Public can view only if results are published; organizers can always view
  const isOwner = event.ownerId === sessionUser?.id || sessionUser?.role === 'admin'
  if (!event.resultsPublished && !isOwner) {
    throw new Error('Unauthorized: Results for this event have not been published yet.')
  }

  const criteria = readJudgingCriteria()
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => b.weight - a.weight) // Sort by weight desc for tie-breaking

  const maxTotalWeighted = criteria.reduce((sum, c) => sum + c.maxScore * c.weight, 0)

  const submissions = readSubmissions().filter(
    (s) => s.eventId === eventId && s.status !== 'draft',
  )
  const scores = readSubmissionScores()

  const ranked: {
    submission: ProjectSubmission
    totalWeightedScore: number
    normalizedPercentage: number
    judgesCount: number
    breakdown: { criterionId: string; criterionTitle: string; weight: number; maxScore: number; averageScore: number }[]
    highestWeightCriterionScore: number
  }[] = []

  for (const sub of submissions) {
    const subScores = scores.filter((s) => s.submissionId === sub.id)
    const distinctJudges = new Set(subScores.map((s) => s.judgeId)).size

    let totalWeightedScore = 0
    let highestWeightScore = 0
    const breakdown: { criterionId: string; criterionTitle: string; weight: number; maxScore: number; averageScore: number }[] = []

    criteria.forEach((crit, index) => {
      const critScores = subScores.filter((s) => s.criterionId === crit.id)
      const avg =
        critScores.length > 0
          ? critScores.reduce((sum, s) => sum + s.score, 0) / critScores.length
          : 0

      const weighted = avg * crit.weight
      totalWeightedScore += weighted

      if (index === 0) {
        highestWeightScore = avg
      }

      breakdown.push({
        criterionId: crit.id,
        criterionTitle: crit.title,
        weight: crit.weight,
        maxScore: crit.maxScore,
        averageScore: Number(avg.toFixed(2)),
      })
    })

    const normalizedPercentage =
      maxTotalWeighted > 0 ? (totalWeightedScore / maxTotalWeighted) * 100 : 0

    ranked.push({
      submission: sub,
      totalWeightedScore: Number(totalWeightedScore.toFixed(2)),
      normalizedPercentage: Number(normalizedPercentage.toFixed(2)),
      judgesCount: distinctJudges,
      breakdown,
      highestWeightCriterionScore: highestWeightScore,
    })
  }

  // Deterministic sorting:
  // 1. Total weighted score desc
  // 2. Highest weight criterion score desc
  // 3. Final submission timestamp asc (earlier submitter wins tie)
  ranked.sort((a, b) => {
    if (b.totalWeightedScore !== a.totalWeightedScore) {
      return b.totalWeightedScore - a.totalWeightedScore
    }
    if (b.highestWeightCriterionScore !== a.highestWeightCriterionScore) {
      return b.highestWeightCriterionScore - a.highestWeightCriterionScore
    }
    const timeA = a.submission.submittedAt ? new Date(a.submission.submittedAt).getTime() : 0
    const timeB = b.submission.submittedAt ? new Date(b.submission.submittedAt).getTime() : 0
    return timeA - timeB
  })

  // Dense rank assignment
  let currentRank = 1
  return ranked.map((item, idx) => {
    if (idx > 0) {
      const prev = ranked[idx - 1]
      const isExactTie =
        prev.totalWeightedScore === item.totalWeightedScore &&
        prev.highestWeightCriterionScore === item.highestWeightCriterionScore &&
        prev.submission.submittedAt === item.submission.submittedAt

      if (!isExactTie) {
        currentRank = idx + 1
      }
    }

    return {
      submissionId: item.submission.id,
      title: item.submission.title,
      teamId: item.submission.teamId,
      teamName: item.submission.teamName,
      submitterId: item.submission.submitterId,
      submitterName: item.submission.submitterName,
      trackId: item.submission.trackId,
      totalWeightedScore: item.totalWeightedScore,
      normalizedPercentage: item.normalizedPercentage,
      judgesCount: item.judgesCount,
      submittedAt: item.submission.submittedAt,
      rank: currentRank,
      criteriaBreakdown: item.breakdown,
      isWinner: currentRank === 1,
    }
  })
}

/**
 * Publishes or unpublishes event results to the public. Organizer-only.
 */
export async function publishEventResults(eventId: string, publish: boolean): Promise<void> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event || (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin')) {
    throw new Error('Unauthorized: Only the event organizer can publish event results.')
  }

  writeEvents(
    events.map((e) => (e.id === eventId ? { ...e, resultsPublished: publish } : e)),
  )
}

/**
 * Gets judging progress for an event.
 */
export async function getJudgingProgress(eventId: string): Promise<JudgingProgress> {
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  const submissions = readSubmissions().filter(
    (s) => s.eventId === eventId && s.status !== 'draft',
  )
  const scores = readSubmissionScores()
  const judges = readJudgeAssignments().filter((a) => a.eventId === eventId)

  const scoredSubIds = new Set(
    scores.filter((s) => submissions.some((sub) => sub.id === s.submissionId)).map((s) => s.submissionId),
  )

  return {
    totalSubmissions: submissions.length,
    scoredSubmissions: scoredSubIds.size,
    totalJudges: judges.length,
    isComplete: submissions.length > 0 && scoredSubIds.size === submissions.length,
    resultsPublished: !!event?.resultsPublished,
  }
}
