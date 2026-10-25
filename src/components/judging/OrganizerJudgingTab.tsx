import { useEffect, useState } from 'react'
import {
  Award,
  EyeOff,
  Globe,
  Plus,
  Scale,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { useToast } from '../../hooks/ToastContext'
import {
  assignJudge,
  calculateEventRankings,
  getEventJudges,
  getJudgingCriteria,
  getJudgingProgress,
  publishEventResults,
  removeJudgeAssignment,
  saveJudgingCriteria,
} from '../../services'
import type {
  EventWithMeta,
  JudgeAssignment,
  JudgingCriterion,
  JudgingProgress,
  SubmissionRanking,
} from '../../types'
import { ConfirmationModal } from '../ui/ConfirmationModal'

interface Props {
  event: EventWithMeta
  onUpdate?: () => void
}

export function OrganizerJudgingTab({ event, onUpdate }: Props) {
  const { notify } = useToast()

  const [criteria, setCriteria] = useState<JudgingCriterion[]>([])
  const [judges, setJudges] = useState<JudgeAssignment[]>([])
  const [progress, setProgress] = useState<JudgingProgress | null>(null)
  const [rankings, setRankings] = useState<SubmissionRanking[]>([])
  const [actionBusy, setActionBusy] = useState(false)

  // Criteria input
  const [newCritTitle, setNewCritTitle] = useState('')
  const [newCritWeight, setNewCritWeight] = useState('1.0')
  const [newCritMax, setNewCritMax] = useState('10')

  // Judge invite input
  const [judgeEmail, setJudgeEmail] = useState('')

  // Confirmation modal
  const [confirmPublish, setConfirmPublish] = useState(false)

  const reloadAll = async () => {
    try {
      const [crits, jList, prog] = await Promise.all([
        getJudgingCriteria(event.id),
        getEventJudges(event.id),
        getJudgingProgress(event.id),
      ])
      setCriteria(crits)
      setJudges(jList)
      setProgress(prog)

      // Calculate preview rankings if submissions exist
      try {
        const ranks = await calculateEventRankings(event.id)
        setRankings(ranks)
      } catch {
        // May have no submissions or not yet evaluated
        setRankings([])
      }
    } catch (err: any) {
      notify(err.message || 'Could not load judging configurations.', 'error')
    }
  }

  useEffect(() => {
    void reloadAll()
  }, [event.id])

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCritTitle.trim()) return
    setActionBusy(true)
    try {
      const updated = [
        ...criteria,
        {
          title: newCritTitle.trim(),
          weight: parseFloat(newCritWeight) || 1.0,
          maxScore: parseInt(newCritMax, 10) || 10,
          displayOrder: criteria.length,
        },
      ]
      const saved = await saveJudgingCriteria(event.id, updated)
      setCriteria(saved)
      setNewCritTitle('')
      setNewCritWeight('1.0')
      setNewCritMax('10')
      notify('Criterion added successfully.')
      void reloadAll()
    } catch (err: any) {
      notify(err.message || 'Failed to add criterion.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleRemoveCriterion = async (critId: string) => {
    setActionBusy(true)
    try {
      const updated = criteria.filter((c) => c.id !== critId)
      const saved = await saveJudgingCriteria(event.id, updated)
      setCriteria(saved)
      notify('Criterion removed.')
      void reloadAll()
    } catch (err: any) {
      notify(err.message || 'Failed to remove criterion.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judgeEmail.trim()) return
    setActionBusy(true)
    try {
      await assignJudge(event.id, judgeEmail.trim())
      notify(`Assigned ${judgeEmail} as judge!`)
      setJudgeEmail('')
      void reloadAll()
    } catch (err: any) {
      notify(err.message || 'Could not assign judge.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleRemoveJudge = async (assignmentId: string) => {
    setActionBusy(true)
    try {
      await removeJudgeAssignment(assignmentId)
      notify('Judge assignment removed.', 'info')
      void reloadAll()
    } catch (err: any) {
      notify(err.message || 'Could not remove judge.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleTogglePublish = async () => {
    setActionBusy(true)
    const targetStatus = !progress?.resultsPublished
    try {
      await publishEventResults(event.id, targetStatus)
      notify(
        targetStatus
          ? 'Event results officially published to participants and public!'
          : 'Event results unpublished.',
      )
      setConfirmPublish(false)
      void reloadAll()
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to update result publication status.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview & Progress Bar */}
      <div className="card p-5 border border-[#334155] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Scale className="h-4 w-4" />
              <span>Judging Operations</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">{event.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmPublish(true)}
              className={`py-1.5 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                progress?.resultsPublished
                  ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                  : 'btn-primary'
              }`}
            >
              {progress?.resultsPublished ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Unpublish Results
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" /> Publish Official Results
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Metrics */}
        {progress && (
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-ink-faint">Assigned Judges</p>
              <p className="text-xl font-bold text-white mt-1">{progress.totalJudges}</p>
            </div>
            <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-ink-faint">Evaluated Submissions</p>
              <p className="text-xl font-bold text-white mt-1">
                <span className="text-brand">{progress.scoredSubmissions}</span> / {progress.totalSubmissions}
              </p>
            </div>
            <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-center">
              <p className="text-[10px] uppercase font-bold text-ink-faint">Publication Status</p>
              <p className="text-xl font-bold mt-1">
                {progress.resultsPublished ? (
                  <span className="text-emerald-400">Live &amp; Public</span>
                ) : (
                  <span className="text-amber-400">Unpublished</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Criteria Configuration + Judge Assignments */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Criteria Card */}
        <div className="card p-5 border border-[#334155] space-y-4">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Award className="h-4 w-4 text-brand" /> Judging Criteria ({criteria.length})
            </h4>
          </div>

          <div className="space-y-2">
            {criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-[#0F172A] border border-[#334155] p-2.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-white">{c.title}</p>
                  <p className="text-[10px] text-ink-faint">
                    Weight: <strong className="text-brand">{c.weight}x</strong> · Max: {c.maxScore} pts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCriterion(c.id)}
                  className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                  title="Remove criterion"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCriterion} className="pt-2 border-t border-[#334155] space-y-2 text-xs">
            <p className="text-[10px] uppercase font-bold text-ink-faint">Add Criterion</p>
            <input
              type="text"
              placeholder="e.g. Technical Execution, Innovation, UI/UX"
              value={newCritTitle}
              onChange={(e) => setNewCritTitle(e.target.value)}
              className="input w-full text-xs"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-ink-muted">Weight</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={newCritWeight}
                  onChange={(e) => setNewCritWeight(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-ink-muted">Max Score</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newCritMax}
                  onChange={(e) => setNewCritMax(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={actionBusy || !newCritTitle.trim()}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Judges Assignment Card */}
        <div className="card p-5 border border-[#334155] space-y-4">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand" /> Assigned Judges ({judges.length})
            </h4>
          </div>

          <div className="space-y-2">
            {judges.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-2">No external judges assigned yet.</p>
            ) : (
              judges.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between rounded-lg bg-[#0F172A] border border-[#334155] p-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{j.judgeEmail}</p>
                    <p className="text-[10px] text-brand">Judge ID: {j.judgeId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveJudge(j.id)}
                    className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                    title="Remove judge"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAssignJudge} className="pt-2 border-t border-[#334155] space-y-2 text-xs">
            <p className="text-[10px] uppercase font-bold text-ink-faint">Invite / Assign Judge</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="judge@university.edu"
                value={judgeEmail}
                onChange={(e) => setJudgeEmail(e.target.value)}
                className="input flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={actionBusy || !judgeEmail.trim()}
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 text-brand"
              >
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Leaderboard & Rankings Preview */}
      <div className="card p-5 border border-[#334155] space-y-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          Event Leaderboard &amp; Rankings Preview
        </h4>
        <p className="text-xs text-ink-muted">
          Formula: Weighted Score = &Sigma;(Avg Judge Score &times; Weight). Tie-breaker: Highest weighted criteria followed by submission timestamp.
        </p>

        {rankings.length === 0 ? (
          <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-6 text-center text-xs text-ink-muted">
            No projects have been evaluated by judges yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#334155] rounded-xl bg-[#0F172A]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-ink-faint uppercase font-semibold border-b border-[#334155]">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Project Title</th>
                  <th className="py-2.5 px-3">Team / Submitter</th>
                  <th className="py-2.5 px-3">Judges</th>
                  <th className="py-2.5 px-3 text-right">Weighted Score</th>
                  <th className="py-2.5 px-3 text-right">Normalized %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {rankings.map((r) => (
                  <tr key={r.submissionId} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3 px-3">
                      {r.rank === 1 ? (
                        <span className="flex items-center gap-1 font-bold text-amber-400">
                          <Trophy className="h-3.5 w-3.5" /> 1st Place
                        </span>
                      ) : r.rank === 2 ? (
                        <span className="font-bold text-slate-300">2nd Place</span>
                      ) : r.rank === 3 ? (
                        <span className="font-bold text-amber-600">3rd Place</span>
                      ) : (
                        <span className="font-mono text-ink-muted">#{r.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">{r.title}</td>
                    <td className="py-3 px-3 text-ink-muted">{r.teamName || r.submitterName}</td>
                    <td className="py-3 px-3 text-ink-muted">{r.judgesCount} judges</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-brand">
                      {r.totalWeightedScore} pts
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white">
                      {r.normalizedPercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmPublish}
        title={progress?.resultsPublished ? 'Unpublish Event Results?' : 'Publish Official Event Results?'}
        confirmLabel={progress?.resultsPublished ? 'Yes, Unpublish' : 'Publish Results to Public'}
        busy={actionBusy}
        onConfirm={handleTogglePublish}
        onClose={() => setConfirmPublish(false)}
      >
        <p>
          {progress?.resultsPublished
            ? 'Unpublishing will hide the official leaderboard and ranks from participants and the public.'
            : 'Publishing will immediately make the official leaderboard, winners, and scores visible on the event page.'}
        </p>
      </ConfirmationModal>
    </div>
  )
}
