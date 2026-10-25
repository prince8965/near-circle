import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { CreateEventForm } from '../components/forms/CreateEventForm'
import { emptyFormValues, formValuesToInput, type EventFormValues } from '../components/forms/eventFormModel'
import { PosterUpload } from '../components/forms/PosterUpload'
import type { FieldFlag } from '../components/ui/FormField'
import { PageHeader } from '../components/ui/PageHeader'
import { useApp } from '../hooks/AppContext'
import { useToast } from '../hooks/ToastContext'
import { createEvent, extractEventFromPoster } from '../services'
import type { PosterExtraction } from '../types'

type Step = 'upload' | 'extracting' | 'review'

function toFormValues(x: PosterExtraction, localityId: string, posterUrl?: string): EventFormValues {
  const base = emptyFormValues(localityId)
  const free = x.price.value === '' || Number(x.price.value) === 0
  return {
    ...base,
    title: x.title.value,
    description: x.description.value,
    category: x.category.value,
    posterUrl,
    startDate: x.startDate.value,
    endDate: x.startDate.value,
    startTime: x.startTime.value,
    endTime: x.endTime.value,
    venueName: x.venueName.value,
    address: x.address.value,
    isFree: free,
    price: free ? '' : x.price.value,
    registrationUrl: x.registrationUrl.value,
  }
}

export default function PosterToEventPage() {
  const { localityId } = useApp()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<string | undefined>()
  const [file, setFile] = useState<File | undefined>()
  const [progress, setProgress] = useState({ pct: 0, label: '' })
  const [extraction, setExtraction] = useState<PosterExtraction | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [reviewError, setReviewError] = useState(false)

  const start = async () => {
    if (!file) return
    setStep('extracting')
    setProgress({ pct: 5, label: 'Starting' })
    try {
      const result = await extractEventFromPoster(file, (pct, label) => setProgress({ pct, label }))
      setExtraction(result)
      setStep('review')
    } catch {
      notify('Extraction failed. You can try again or fill the form manually.', 'error')
      setStep('upload')
    }
  }

  const flags: Partial<Record<keyof EventFormValues, FieldFlag>> | undefined = extraction
    ? {
        title: extraction.title,
        description: extraction.description,
        category: extraction.category,
        startDate: extraction.startDate,
        startTime: extraction.startTime,
        endTime: extraction.endTime,
        venueName: extraction.venueName,
        address: extraction.address,
        price: extraction.price,
        registrationUrl: extraction.registrationUrl,
      }
    : undefined

  const flaggedCount = flags ? Object.values(flags).filter((f) => f && f.state !== 'ok').length : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Draft an event from a poster" subtitle="Upload a poster, review the suggested details, then publish when you’re happy." />

      <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Progress">
        {(['upload', 'extracting', 'review'] as const).map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 font-medium ${step === s ? 'bg-brand text-[#0B0F19] font-bold shadow-cyber' : 'bg-secondary text-ink-muted border border-[#334155]/60'}`} aria-current={step === s ? 'step' : undefined}>
            {i + 1}. {s === 'upload' ? 'Upload poster' : s === 'extracting' ? 'Extract details' : 'Review & confirm'}
          </li>
        ))}
      </ol>

      <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        <p>
          <strong>Sample extraction only.</strong> No OCR or AI service is connected yet. The details below are fixed
          sample text, not read from your image. Always check every field before publishing.
        </p>
      </div>

      {step === 'upload' && (
        <div className="card mx-auto max-w-xl space-y-4 p-6">
          <h2 className="text-lg font-semibold text-white">1. Choose your poster</h2>
          <PosterUpload
            id="poster-upload"
            value={preview}
            onChange={(url) => {
              setPreview(url)
              if (!url) setFile(undefined)
            }}
            onFile={setFile}
          />
          <button type="button" className="btn-primary w-full" disabled={!preview || !file} onClick={start}>
            <Sparkles className="h-4 w-4" aria-hidden /> Generate sample draft
          </button>
        </div>
      )}

      {step === 'extracting' && (
        <div className="card mx-auto max-w-xl space-y-4 p-6" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
            <h2 className="text-lg font-semibold text-white">Extracting details…</h2>
          </div>
          {preview && <img src={preview} alt="Uploaded poster" className="max-h-56 w-full rounded-xl bg-canvas object-contain" />}
          <div className="h-2.5 overflow-hidden rounded-full bg-[#0F172A] border border-[#334155]" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand shadow-[0_0_10px_rgba(0,242,254,0.5)] transition-all duration-500" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="text-sm text-ink-muted">{progress.label} (simulated)</p>
        </div>
      )}

      {step === 'review' && extraction && (
        <div className="space-y-6">
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            {preview && <img src={preview} alt="Uploaded poster" className="max-h-40 rounded-xl bg-canvas object-contain" />}
            <div className="flex-1 space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden /> Review the sample draft
              </h2>
              <p className="text-sm text-ink-muted">
                {flaggedCount} {flaggedCount === 1 ? 'field needs' : 'fields need'} your attention (marked in amber). Edit
                anything, then confirm. Nothing is published until you press Publish.
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#334155] accent-brand"
                  checked={reviewed}
                  onChange={(e) => {
                    setReviewed(e.target.checked)
                    setReviewError(false)
                  }}
                />
                I have reviewed and corrected all fields above.
              </label>
              {reviewError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  Please confirm you’ve reviewed the details before saving or publishing.
                </p>
              )}
            </div>
          </div>

          <CreateEventForm
            hidePoster
            submitLabel="Confirm & publish"
            initialValues={toFormValues(extraction, localityId, preview)}
            flags={flags}
            onSubmit={async (values, status) => {
              if (!reviewed) {
                setReviewError(true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                return
              }
              try {
                await createEvent(formValuesToInput(values, status))
                notify(status === 'draft' ? 'Draft saved.' : 'Event published!')
                navigate('/organizer')
              } catch (e) {
                notify(e instanceof Error ? e.message : 'Could not save the event.', 'error')
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
