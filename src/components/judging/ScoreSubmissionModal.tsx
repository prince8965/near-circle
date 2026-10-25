import { useEffect, useState } from 'react'
import {
  Award,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Sliders,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import { useToast } from '../../hooks/ToastContext'
import {
  createSignedUrl,
  getJudgingCriteria,
  getSubmissionScores,
  submitJudgeScores,
} from '../../services'
import type {
  JudgingCriterion,
  ProjectSubmission,
  SubmissionFile,
} from '../../types'

interface Props {
  open: boolean
  submission: ProjectSubmission | null
  onClose: () => void
  onSuccess: () => void
}

export function ScoreSubmissionModal({ open, submission, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { notify } = useToast()

  const [criteria, setCriteria] = useState<JudgingCriterion[]>([])
  const [scores, setScores] = useState<Record<string, { score: number; feedback: string }>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !submission) return

    const loadData = async () => {
      setLoading(true)
      try {
        const crits = await getJudgingCriteria(submission.eventId)
        setCriteria(crits)

        // Load existing scores if previously scored by this judge
        const existing = await getSubmissionScores(submission.id)
        const initialMap: Record<string, { score: number; feedback: string }> = {}

        crits.forEach((c) => {
          const match = existing.find((s) => s.criterionId === c.id && s.judgeId === user?.id)
          initialMap[c.id] = {
            score: match ? match.score : Math.round(c.maxScore / 2),
            feedback: match?.feedback || '',
          }
        })
        setScores(initialMap)
      } catch (err: any) {
        notify(err.message || 'Could not load judging criteria.', 'error')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [open, submission?.id])

  if (!open || !submission) return null

  const handleScoreChange = (criterionId: string, val: number) => {
    setScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        score: val,
      },
    }))
  }

  const handleFeedbackChange = (criterionId: string, text: string) => {
    setScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        feedback: text,
      },
    }))
  }

  const handleSubmitScores = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = criteria.map((c) => ({
        criterionId: c.id,
        score: scores[c.id]?.score ?? 0,
        feedback: scores[c.id]?.feedback || undefined,
      }))

      await submitJudgeScores(submission.id, payload)
      notify(`Evaluation saved for "${submission.title}"!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      notify(err.message || 'Failed to submit scores.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadFile = async (f: SubmissionFile) => {
    try {
      const signed = await createSignedUrl('project-submissions', f.storagePath, 3600)
      window.open(signed, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      notify(err.message || 'Could not generate download URL.', 'error')
    }
  }

  // Calculate live weighted score preview
  const totalWeighted = criteria.reduce((sum, c) => {
    const s = scores[c.id]?.score ?? 0
    return sum + s * c.weight
  }, 0)

  const maxTotalWeighted = criteria.reduce((sum, c) => sum + c.maxScore * c.weight, 0)
  const previewPercentage =
    maxTotalWeighted > 0 ? ((totalWeighted / maxTotalWeighted) * 100).toFixed(1) : '0'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[#334155] bg-[#0B0F19] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#334155] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Award className="h-4 w-4" />
              <span>Judge Scoring Rubric</span>
            </div>
            <h2 id="score-modal-title" className="text-xl font-bold text-white mt-1">
              {submission.title}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Team: <strong className="text-white">{submission.teamName || 'Solo Project'}</strong> · Submitter:{' '}
              {submission.submitterName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-elevated hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
          {/* Project Details Brief */}
          <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 text-xs space-y-2.5">
            {submission.tagline && <p className="font-semibold text-brand italic">"{submission.tagline}"</p>}
            <p className="text-ink-muted leading-relaxed whitespace-pre-line">{submission.description}</p>

            {/* Links */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-[#334155]">
              {submission.repoUrl && (
                <a
                  href={submission.repoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 text-brand hover:underline font-mono"
                >
                  <Code2 className="h-3.5 w-3.5" /> Repository <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {submission.demoUrl && (
                <a
                  href={submission.demoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 text-brand hover:underline font-mono"
                >
                  <Globe className="h-3.5 w-3.5" /> Live Demo <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {submission.videoUrl && (
                <a
                  href={submission.videoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 text-brand hover:underline font-mono"
                >
                  <Video className="h-3.5 w-3.5" /> Video Demo <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Attachments */}
            {submission.files && submission.files.length > 0 && (
              <div className="pt-2 border-t border-[#334155] space-y-1">
                <span className="text-[10px] uppercase font-bold text-ink-faint">Private Project Attachments:</span>
                <div className="flex flex-wrap gap-2">
                  {submission.files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleDownloadFile(f)}
                      className="rounded bg-[#0B0F19] border border-[#334155] px-2.5 py-1 text-[11px] text-white hover:text-brand flex items-center gap-1.5"
                    >
                      <FileText className="h-3 w-3 text-brand" /> {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scoring Rubric Form */}
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-brand" /> Loading criteria...
            </div>
          ) : criteria.length === 0 ? (
            <div className="rounded-xl bg-amber-950/30 border border-amber-500/30 p-4 text-center text-xs text-amber-200">
              No judging criteria configured for this event yet.
            </div>
          ) : (
            <form id="scoring-form" onSubmit={handleSubmitScores} className="space-y-4">
              <div className="flex items-center justify-between bg-brand/10 border border-brand/30 rounded-xl p-3 text-xs">
                <span className="font-semibold text-brand flex items-center gap-1.5">
                  <Sliders className="h-4 w-4" /> Live Score Preview:
                </span>
                <span className="font-bold text-white text-sm">
                  {totalWeighted.toFixed(2)} pts ({previewPercentage}%)
                </span>
              </div>

              {criteria.map((c) => {
                const current = scores[c.id]?.score ?? 0
                return (
                  <div key={c.id} className="card p-4 border border-[#334155] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{c.title}</h4>
                        {c.description && <p className="text-xs text-ink-muted">{c.description}</p>}
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-bold text-brand">
                          {current} / {c.maxScore}
                        </span>
                        <p className="text-[10px] text-ink-faint">Weight: {c.weight}x</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={c.maxScore}
                        step={1}
                        value={current}
                        onChange={(e) => handleScoreChange(c.id, Number(e.target.value))}
                        className="w-full accent-brand cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={c.maxScore}
                        value={current}
                        onChange={(e) => handleScoreChange(c.id, Math.min(c.maxScore, Math.max(0, Number(e.target.value))))}
                        className="input w-16 text-center font-mono text-xs py-1"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Private feedback / notes on this criterion (optional)..."
                        value={scores[c.id]?.feedback || ''}
                        onChange={(e) => handleFeedbackChange(c.id, e.target.value)}
                        className="input w-full text-xs py-1.5"
                      />
                    </div>
                  </div>
                )
              })}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#334155]">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs">
            Cancel
          </button>
          <button
            type="submit"
            form="scoring-form"
            disabled={submitting || criteria.length === 0}
            className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save &amp; Submit Evaluation
          </button>
        </div>
      </div>
    </div>
  )
}
