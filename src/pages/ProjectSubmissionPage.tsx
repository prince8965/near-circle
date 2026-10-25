import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileArchive,
  FileCode,
  FileText,
  Globe,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import {
  createSignedUrl,
  getEventById,
  getRegistrationForEvent,
  getSubmissionForEvent,
  saveDraftSubmission,
  submitProject,
  uploadFile,
  validateFile,
} from '../services'
import type { SubmissionFile } from '../types'
import { formatDate, formatTime } from '../utils/format'

export default function ProjectSubmissionPage() {
  const { id: eventId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notify } = useToast()

  const eventResult = useAsync(() => getEventById(eventId), [eventId])
  const regResult = useAsync(() => getRegistrationForEvent(eventId), [eventId])
  const subResult = useAsync(() => getSubmissionForEvent(eventId), [eventId])

  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [trackId, setTrackId] = useState<string>('')
  const [techInput, setTechInput] = useState('')
  const [technologies, setTechnologies] = useState<string[]>([])
  const [files, setFiles] = useState<SubmissionFile[]>([])

  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  // Populate form from existing submission
  useEffect(() => {
    if (subResult.data) {
      const s = subResult.data
      setTitle(s.title || '')
      setTagline(s.tagline || '')
      setDescription(s.description || '')
      setDemoUrl(s.demoUrl || '')
      setRepoUrl(s.repoUrl || '')
      setVideoUrl(s.videoUrl || '')
      setTrackId(s.trackId || '')
      setTechnologies(s.technologies || [])
      setFiles(s.files || [])
    }
  }, [subResult.data])

  const event = eventResult.data
  const submission = subResult.data
  const isRegistered = !!regResult.data

  const isDeadlinePassed =
    Boolean(event?.submissionDeadline && new Date(event.submissionDeadline).getTime() <= Date.now())
  const isFinalSubmitted = submission?.status === 'submitted'
  const isReadOnly = Boolean(isDeadlinePassed && isFinalSubmitted)

  const handleAddTech = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    e.preventDefault()
    const cleaned = techInput.trim()
    if (cleaned && !technologies.includes(cleaned)) {
      setTechnologies([...technologies, cleaned])
      setTechInput('')
    }
  }

  const handleRemoveTech = (t: string) => {
    setTechnologies(technologies.filter((item) => item !== t))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const validation = validateFile(
      { name: file.name, size: file.size, type: file.type },
      'project-submissions',
    )
    if (!validation.valid) {
      notify(validation.error || 'Invalid file.', 'error')
      return
    }

    setUploadingFile(true)
    try {
      const storagePath = `${eventId}/${submission?.id || 'new'}/${user.id}/${Date.now()}-${file.name}`
      const uploadResult = await uploadFile('project-submissions', storagePath, file, {
        isPrivate: true,
      })

      const newFileItem: SubmissionFile = {
        id: `file-${Date.now().toString(36)}`,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        storagePath: uploadResult.path,
        url: uploadResult.signedUrl,
        uploadedAt: new Date().toISOString(),
        isPrivate: true,
      }

      setFiles((prev) => [...prev, newFileItem])
      notify(`Uploaded "${file.name}" to private project storage.`)
    } catch (err: any) {
      notify(err.message || 'File upload failed.', 'error')
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const handleDownloadFile = async (fileItem: SubmissionFile) => {
    try {
      const signed = await createSignedUrl('project-submissions', fileItem.storagePath, 3600)
      window.open(signed, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      notify(err.message || 'Could not generate download link.', 'error')
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      const saved = await saveDraftSubmission(eventId, {
        title,
        tagline,
        description,
        demoUrl,
        repoUrl,
        videoUrl,
        trackId: trackId || undefined,
        technologies,
        files,
      })
      notify(`Draft saved: "${saved.title}"`)
      void subResult.reload()
    } catch (err: any) {
      notify(err.message || 'Failed to save draft.', 'error')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      notify('Please enter a project title.', 'error')
      return
    }
    if (!description.trim()) {
      notify('Please enter a project description.', 'error')
      return
    }

    setSubmitting(true)
    try {
      // 1. Save latest state
      const saved = await saveDraftSubmission(eventId, {
        title,
        tagline,
        description,
        demoUrl,
        repoUrl,
        videoUrl,
        trackId: trackId || undefined,
        technologies,
        files,
      })

      // 2. Submit project
      await submitProject(saved.id)
      notify('Project officially submitted! Good luck in judging!', 'info')
      void subResult.reload()
      navigate(`/events/${eventId}`)
    } catch (err: any) {
      notify(err.message || 'Submission failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (eventResult.loading || regResult.loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (eventResult.error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={eventResult.error || 'Event not found'} onRetry={eventResult.reload} />
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={AlertCircle}
          title="Registration Required"
          description={`You must be registered for "${event.title}" before submitting a project.`}
          actionLabel="View Event &amp; Register"
          actionTo={`/events/${eventId}`}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {event.title}
      </Link>

      <div className="card p-6 border border-[#334155]/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Sparkles className="h-4 w-4" />
              <span>Project Submission Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">{event.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {submission?.status === 'submitted' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Submitted
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-950/50 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-300">
                <Clock className="h-4 w-4" /> Draft
              </span>
            )}
          </div>
        </div>

        {/* Deadline Banner */}
        {event.submissionDeadline && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
              isDeadlinePassed
                ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                : 'bg-[#0F172A] border border-[#334155] text-ink-muted'
            }`}
          >
            <Clock className="h-4 w-4 shrink-0 text-brand" />
            <span>
              Submission Deadline:{' '}
              <strong className="text-white">
                {formatDate(event.submissionDeadline)} at {formatTime(event.submissionDeadline)}
              </strong>
              {isDeadlinePassed && ' — Submissions are now closed.'}
            </span>
          </div>
        )}
      </div>

      {isReadOnly && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-500/30 p-4 text-xs text-amber-200">
          This project was submitted and the deadline has passed. The submission is now locked for judging review.
        </div>
      )}

      <form onSubmit={handleSubmitFinal} className="card p-6 border border-[#334155]/80 space-y-5">
        <div>
          <label htmlFor="sub-title" className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-1.5">
            Project Title *
          </label>
          <input
            id="sub-title"
            type="text"
            required
            disabled={isReadOnly}
            placeholder="e.g. NearCircle AI Router"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full text-base font-semibold"
          />
        </div>

        <div>
          <label htmlFor="sub-tagline" className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-1.5">
            Short Tagline / Pitch
          </label>
          <input
            id="sub-tagline"
            type="text"
            disabled={isReadOnly}
            placeholder="One sentence describing what makes your solution awesome"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="input w-full text-sm"
          />
        </div>

        {event.tracks && event.tracks.length > 0 && (
          <div>
            <label htmlFor="sub-track" className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-1.5">
              Competition Track
            </label>
            <select
              id="sub-track"
              disabled={isReadOnly}
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">General Track / Open Submission</option>
              {event.tracks.map((t, idx) => (
                <option key={idx} value={`track-${idx}`}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="sub-desc" className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-1.5">
            Project Overview &amp; Technical Architecture *
          </label>
          <textarea
            id="sub-desc"
            required
            rows={6}
            disabled={isReadOnly}
            placeholder="Describe the problem, your solution, architectural decisions, and how you built it..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input w-full text-sm leading-relaxed"
          />
        </div>

        {/* Technologies Multi-Tag Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-1.5">
            Technologies &amp; Tools Used
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {technologies.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] border border-[#334155] px-2.5 py-1 text-xs font-medium text-white"
              >
                {t}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTech(t)}
                    className="text-ink-muted hover:text-rose-400"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {!isReadOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. React, Supabase, Solidity (press Enter to add)"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={handleAddTech}
                className="input flex-1 text-xs"
              />
              <button
                type="button"
                onClick={handleAddTech}
                className="btn-secondary px-3 py-1 text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Tag
              </button>
            </div>
          )}
        </div>

        {/* Links Grid */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#334155]">
          <div>
            <label htmlFor="sub-repo" className="block text-xs font-medium text-ink-muted mb-1 flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-brand" /> Repository URL
            </label>
            <input
              id="sub-repo"
              type="url"
              disabled={isReadOnly}
              placeholder="https://github.com/username/project"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="input w-full text-xs"
            />
          </div>

          <div>
            <label htmlFor="sub-demo" className="block text-xs font-medium text-ink-muted mb-1 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-brand" /> Live Demo URL
            </label>
            <input
              id="sub-demo"
              type="url"
              disabled={isReadOnly}
              placeholder="https://my-app.vercel.app"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              className="input w-full text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="sub-video" className="block text-xs font-medium text-ink-muted mb-1 flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-brand" /> Video Pitch / Demo Walkthrough URL (YouTube, Loom, Vimeo)
            </label>
            <input
              id="sub-video"
              type="url"
              disabled={isReadOnly}
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input w-full text-xs"
            />
          </div>
        </div>

        {/* Supabase Storage File Upload Zone */}
        <div className="pt-2 border-t border-[#334155] space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Project Attachments (Pitch Deck PDF, Code Archives, Diagrams)
            </label>
            <p className="text-xs text-ink-muted mt-0.5">
              Stored securely in private Supabase Storage. Accessible by your team, the organizer, and assigned judges. Max 25 MB per file.
            </p>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {f.name.endsWith('.pdf') ? (
                      <FileText className="h-5 w-5 text-rose-400 shrink-0" />
                    ) : f.name.endsWith('.zip') ? (
                      <FileArchive className="h-5 w-5 text-amber-400 shrink-0" />
                    ) : (
                      <FileCode className="h-5 w-5 text-brand shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{f.name}</p>
                      <p className="text-[11px] text-ink-muted">
                        {(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB · Uploaded {formatDate(f.uploadedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(f)}
                      className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 text-brand"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Download Pass
                    </button>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f.id)}
                        className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                        title="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isReadOnly && (
            <div className="relative">
              <label
                htmlFor="file-upload-input"
                className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[#334155] bg-[#0F172A]/50 p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-[#0F172A] transition ${
                  uploadingFile ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingFile ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
                ) : (
                  <Upload className="h-8 w-8 text-ink-muted mb-2 group-hover:text-brand" />
                )}
                <p className="text-xs font-semibold text-white">Click to upload project files</p>
                <p className="text-[11px] text-ink-muted mt-1">PDF, ZIP, PNG, MP4 up to 25 MB</p>
                <input
                  id="file-upload-input"
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Action Controls */}
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
            <button
              type="button"
              disabled={savingDraft || submitting}
              onClick={handleSaveDraft}
              className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5"
            >
              {savingDraft && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={savingDraft || submitting || !title.trim() || !description.trim()}
              className="btn-primary py-2 px-5 text-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Finalize &amp; Submit Project
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
