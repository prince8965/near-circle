import { useEffect, useState } from 'react'
import {
  Award,
  CheckCircle2,
  Clock,
  Code2,
  Globe,
  Loader2,
  Sliders,
  Sparkles,
  Users,
} from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { ScoreSubmissionModal } from '../components/judging/ScoreSubmissionModal'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import {
  getAssignedEventsForJudge,
  getEligibleSubmissionsForJudge,
  getSubmissionScores,
} from '../services'
import type { ProjectSubmission } from '../types'
import { formatDate } from '../utils/format'

export default function JudgeDashboardPage() {
  const { user } = useAuth()
  const { notify } = useToast()

  const eventsResult = useAsync(() => getAssignedEventsForJudge(user?.id), [user?.id])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([])
  const [scoredMap, setScoredMap] = useState<Record<string, boolean>>({})
  const [loadingSubs, setLoadingSubs] = useState(false)

  const [evaluatingSub, setEvaluatingSub] = useState<ProjectSubmission | null>(null)

  // Auto-select first assigned event
  useEffect(() => {
    if (eventsResult.data && eventsResult.data.length > 0 && !selectedEventId) {
      setSelectedEventId(eventsResult.data[0].id)
    }
  }, [eventsResult.data])

  // Load submissions for selected event
  const reloadSubmissions = async () => {
    if (!selectedEventId || !user) return
    setLoadingSubs(true)
    try {
      const subs = await getEligibleSubmissionsForJudge(selectedEventId, user.id)
      setSubmissions(subs)

      // Check scoring status for each
      const statusMap: Record<string, boolean> = {}
      for (const s of subs) {
        const scores = await getSubmissionScores(s.id)
        statusMap[s.id] = scores.some((sc) => sc.judgeId === user.id)
      }
      setScoredMap(statusMap)
    } catch (err: any) {
      notify(err.message || 'Could not load submissions for judging.', 'error')
    } finally {
      setLoadingSubs(false)
    }
  }

  useEffect(() => {
    void reloadSubmissions()
  }, [selectedEventId, user?.id])

  const events = eventsResult.data || []
  const selectedEvent = events.find((e) => e.id === selectedEventId)
  const scoredCount = Object.values(scoredMap).filter(Boolean).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title="Judge Portal &amp; Evaluations"
        subtitle="Review project submissions and score hackathon competitors according to event rubrics."
      />

      {eventsResult.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : eventsResult.error ? (
        <ErrorState message={eventsResult.error} onRetry={eventsResult.reload} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No Judge Assignments"
          description="You are not currently assigned as a judge for any active events."
          actionLabel="Explore Events"
          actionTo="/"
        />
      ) : (
        <div className="space-y-6">
          {/* Event Selector Tab Bar */}
          <div className="flex flex-wrap gap-2 border-b border-[#334155] pb-3">
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEventId(ev.id)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  selectedEventId === ev.id
                    ? 'bg-brand text-[#0B0F19] shadow-cyber'
                    : 'bg-[#0F172A] border border-[#334155] text-ink-muted hover:text-white'
                }`}
              >
                {ev.title}
              </button>
            ))}
          </div>

          {/* Event Judging Status Banner */}
          {selectedEvent && (
            <div className="card p-5 border border-[#334155]/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-brand tracking-wider">Assigned Event</span>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedEvent.title}</h2>
                <p className="text-xs text-ink-muted mt-1">
                  Venue: {selectedEvent.venueName} · Submissions Deadline:{' '}
                  {selectedEvent.submissionDeadline ? formatDate(selectedEvent.submissionDeadline) : 'None'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-center min-w-[110px]">
                  <p className="text-[10px] uppercase font-bold text-ink-faint">Evaluation Progress</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    <span className="text-brand">{scoredCount}</span> / {submissions.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submissions List */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" /> Submissions to Review ({submissions.length})
            </h3>

            {loadingSubs ? (
              <div className="flex h-48 items-center justify-center text-sm text-ink-muted">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-brand" /> Loading submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div className="card p-8 text-center border border-[#334155]">
                <p className="text-sm font-semibold text-white">No submitted projects ready for review</p>
                <p className="text-xs text-ink-muted mt-1">
                  Participants haven't finalized project submissions for this event yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {submissions.map((sub) => {
                  const isScored = scoredMap[sub.id]
                  return (
                    <article
                      key={sub.id}
                      className="card p-5 border border-[#334155] flex flex-col justify-between hover:border-brand/40 transition"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-base font-bold text-white line-clamp-1">{sub.title}</h4>
                          {isScored ? (
                            <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Evaluated
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <Clock className="h-3 w-3" /> Pending Review
                            </span>
                          )}
                        </div>

                        {sub.tagline && <p className="text-xs text-brand line-clamp-1">"{sub.tagline}"</p>}

                        <p className="text-xs text-ink-muted line-clamp-3 leading-relaxed">
                          {sub.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {sub.technologies.slice(0, 4).map((tech) => (
                            <span
                              key={tech}
                              className="rounded bg-[#0F172A] border border-[#334155] px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-ink-muted pt-2 border-t border-[#334155]">
                          {sub.teamName ? (
                            <span className="flex items-center gap-1 truncate">
                              <Users className="h-3.5 w-3.5 text-brand" /> {sub.teamName}
                            </span>
                          ) : (
                            <span className="italic">Solo Project</span>
                          )}
                          {sub.repoUrl && (
                            <a
                              href={sub.repoUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-brand hover:underline flex items-center gap-1"
                            >
                              <Code2 className="h-3 w-3" /> Repo
                            </a>
                          )}
                          {sub.demoUrl && (
                            <a
                              href={sub.demoUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-brand hover:underline flex items-center gap-1"
                            >
                              <Globe className="h-3 w-3" /> Demo
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-3 border-t border-[#334155] flex justify-end">
                        <button
                          type="button"
                          onClick={() => setEvaluatingSub(sub)}
                          className={`py-1.5 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                            isScored
                              ? 'btn-secondary text-white'
                              : 'btn-primary'
                          }`}
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          {isScored ? 'Update Evaluation' : 'Score Project'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoring Modal */}
      <ScoreSubmissionModal
        open={evaluatingSub !== null}
        submission={evaluatingSub}
        onClose={() => setEvaluatingSub(null)}
        onSuccess={() => void reloadSubmissions()}
      />
    </div>
  )
}
