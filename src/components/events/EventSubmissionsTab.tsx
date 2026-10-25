import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Clock,
  Code2,
  Globe,
  Loader2,
  Medal,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import {
  calculateEventRankings,
  getEventSubmissions,
  getSubmissionForEvent,
} from '../../services'
import type { EventWithMeta, ProjectSubmission, SubmissionRanking } from '../../types'

interface Props {
  event: EventWithMeta
  isRegistered: boolean
}

export function EventSubmissionsTab({ event, isRegistered }: Props) {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([])
  const [userSubmission, setUserSubmission] = useState<ProjectSubmission | null>(null)
  const [rankings, setRankings] = useState<SubmissionRanking[]>([])
  const [loading, setLoading] = useState(false)

  const isPublished = !!event.resultsPublished

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (isPublished) {
          const ranks = await calculateEventRankings(event.id)
          setRankings(ranks)
        }

        if (user && isRegistered) {
          const mySub = await getSubmissionForEvent(event.id, user.id)
          setUserSubmission(mySub)
        }

        // Load public submissions
        const publicSubs = await getEventSubmissions(event.id).catch(() => [])
        setSubmissions(publicSubs)
      } catch {
        // Fallback
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [event.id, isPublished, user?.id, isRegistered])

  return (
    <section className="space-y-6" aria-labelledby="submissions-tab-heading">
      {/* Official Results / Winner Podium (When Published) */}
      {isPublished && rankings.length > 0 && (
        <div className="card p-6 border border-brand/50 shadow-cyber space-y-5 bg-gradient-to-b from-[#0F172A] to-[#0B0F19]">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Trophy className="h-4 w-4" />
                <span>Official Hackathon Results</span>
              </div>
              <h3 id="submissions-tab-heading" className="text-xl font-bold text-white mt-1">
                Leaderboard &amp; Winners
              </h3>
            </div>
            <span className="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300">
              Results Published
            </span>
          </div>

          {/* Podium Top 3 */}
          <div className="grid gap-3 sm:grid-cols-3">
            {rankings.slice(0, 3).map((r) => {
              const isFirst = r.rank === 1
              const isSecond = r.rank === 2

              return (
                <div
                  key={r.submissionId}
                  className={`relative rounded-2xl border p-4 text-center space-y-2 ${
                    isFirst
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : isSecond
                      ? 'bg-slate-400/10 border-slate-400/40'
                      : 'bg-amber-700/10 border-amber-700/40'
                  }`}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0B0F19] border border-[#334155]">
                    {isFirst ? (
                      <Trophy className="h-6 w-6 text-amber-400" />
                    ) : isSecond ? (
                      <Medal className="h-6 w-6 text-slate-300" />
                    ) : (
                      <Award className="h-6 w-6 text-amber-600" />
                    )}
                  </div>
                  <p className="text-xs uppercase font-bold text-ink-faint">
                    {isFirst ? '1st Place Winner' : isSecond ? '2nd Place' : '3rd Place'}
                  </p>
                  <h4 className="text-base font-bold text-white truncate">{r.title}</h4>
                  <p className="text-xs text-ink-muted truncate">{r.teamName || r.submitterName}</p>
                  <div className="pt-1 font-mono text-xs font-bold text-brand">
                    {r.totalWeightedScore} pts ({r.normalizedPercentage}%)
                  </div>
                </div>
              )
            })}
          </div>

          {/* Full Leaderboard Table */}
          {rankings.length > 3 && (
            <div className="overflow-x-auto border border-[#334155] rounded-xl bg-[#0F172A]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B0F19] text-ink-faint uppercase font-semibold border-b border-[#334155]">
                  <tr>
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Project Title</th>
                    <th className="py-2.5 px-3">Team / Submitter</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {rankings.slice(3).map((r) => (
                    <tr key={r.submissionId} className="hover:bg-surface-elevated/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-ink-muted">#{r.rank}</td>
                      <td className="py-3 px-3 font-semibold text-white">{r.title}</td>
                      <td className="py-3 px-3 text-ink-muted">{r.teamName || r.submitterName}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-brand">
                        {r.totalWeightedScore} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Participant Submission CTA Card */}
      {isRegistered && (
        <div className="card p-5 border border-[#334155] flex flex-wrap items-center justify-between gap-4 bg-[#0F172A]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Sparkles className="h-4 w-4" />
              <span>Your Project Submission</span>
            </div>
            {userSubmission ? (
              <div className="mt-1">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  {userSubmission.title}
                  {userSubmission.status === 'submitted' ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Submitted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-950/50 border border-amber-500/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      <Clock className="h-3 w-3" /> Draft
                    </span>
                  )}
                </h4>
                {userSubmission.tagline && (
                  <p className="text-xs text-ink-muted italic">"{userSubmission.tagline}"</p>
                )}
              </div>
            ) : (
              <div className="mt-1">
                <h4 className="text-lg font-bold text-white">Ready to showcase your hack?</h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Save a draft, upload pitch materials, or submit before the event deadline.
                </p>
              </div>
            )}
          </div>

          <Link
            to={`/events/${event.id}/submit`}
            className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {userSubmission ? 'Manage Submission' : 'Submit Project'}
          </Link>
        </div>
      )}

      {/* Public Projects Showcase */}
      <div className="card p-5 border border-[#334155] space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          Event Submissions ({submissions.length})
        </h3>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-brand" /> Loading submissions...
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-xs text-ink-muted italic py-4 text-center">
            No public project submissions available yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 space-y-2 hover:border-brand/40 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-sm line-clamp-1">{sub.title}</h4>
                  <span className="rounded bg-[#0B0F19] px-2 py-0.5 text-[10px] font-semibold text-brand border border-[#334155]">
                    {sub.teamName ? 'Team' : 'Solo'}
                  </span>
                </div>
                {sub.tagline && <p className="text-xs text-brand line-clamp-1">"{sub.tagline}"</p>}
                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">{sub.description}</p>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#334155] text-xs">
                  {sub.repoUrl && (
                    <a
                      href={sub.repoUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand hover:underline flex items-center gap-1"
                    >
                      <Code2 className="h-3 w-3" /> Code
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
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
