import { useState, useEffect, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Locate, Save, Send } from 'lucide-react'
import { LOCALITIES, getLocality } from '../../data/localities'
import { CATEGORIES, type Category, type EventStatus } from '../../types'
import { geocodeMumbaiAddress } from '../../services'
import { MapPicker } from '../maps/MapPicker'
import { FormField, type FieldFlag } from '../ui/FormField'
import { PosterUpload } from './PosterUpload'
import { validateEventForm, type EventFormErrors, type EventFormValues } from './eventFormModel'

interface Props {
  initialValues: EventFormValues
  isEditing?: boolean
  /** Review flags for fields filled by (mock) poster extraction. */
  flags?: Partial<Record<keyof EventFormValues, FieldFlag>>
  onSubmit: (values: EventFormValues, status: EventStatus) => Promise<void>
  submitLabel?: string
  /** Hide the poster upload (the poster workflow already shows it). */
  hidePoster?: boolean
}

export function CreateEventForm({
  initialValues,
  isEditing = false,
  flags,
  onSubmit,
  submitLabel,
  hidePoster = false,
}: Props) {
  const [values, setValues] = useState<EventFormValues>(initialValues)
  const [errors, setErrors] = useState<EventFormErrors>({})
  const [busy, setBusy] = useState<EventStatus | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeStatus, setGeocodeStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [customLocality, setCustomLocality] = useState('')

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const triggerGeocode = async (addr: string) => {
    if (!addr || addr.trim().length < 3) return
    setGeocoding(true)
    try {
      const res = await geocodeMumbaiAddress(addr, values.localityId)
      if (res.error) {
        setGeocodeStatus({ success: false, message: res.error })
      } else if (res.matched) {
        setValues((v) => ({ ...v, lat: res.lat, lng: res.lng }))
        setGeocodeStatus({
          success: true,
          message: `Detected: ${res.displayName.split(',').slice(0, 3).join(', ')}`,
        })
      } else {
        setGeocodeStatus({
          success: true,
          message: `Centered on ${getLocality(values.localityId).name} hub. Drag pin if needed.`,
        })
      }
    } catch {
      setGeocodeStatus(null)
    } finally {
      setGeocoding(false)
    }
  }

  // Automatic geocode detection when address is typed
  useEffect(() => {
    if (values.mode === 'online') return
    if (!values.address || values.address.trim().length < 5) {
      setGeocodeStatus(null)
      return
    }

    const timer = setTimeout(() => {
      void triggerGeocode(values.address)
    }, 800)

    return () => clearTimeout(timer)
  }, [values.address, values.mode])

  const submit = async (status: EventStatus) => {
    const found = validateEventForm(values, status, isEditing)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Move focus to the first invalid field so keyboard and screen-reader users land on the problem.
      const firstKey = Object.keys(found)[0]
      requestAnimationFrame(() => document.getElementById(`field-${firstKey}`)?.focus())
      return
    }
    setBusy(status)
    try {
      await onSubmit(values, status)
    } finally {
      setBusy(null)
    }
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit('published')
  }

  const err = (k: keyof EventFormValues) => errors[k]
  const invalid = (k: keyof EventFormValues) => (errors[k] ? 'border-red-400' : '')

  return (
    <form onSubmit={onFormSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="sec-basics">
          <h2 id="sec-basics" className="text-lg font-semibold">Basics</h2>
          <FormField id="field-title" label="Event title" required error={err('title')} flag={flags?.title}>
            <input
              id="field-title"
              className={`input ${invalid('title')}`}
              value={values.title}
              maxLength={120}
              onChange={(e) => set('title', e.target.value)}
              aria-invalid={!!err('title')}
              aria-describedby={err('title') ? 'field-title-error' : undefined}
              placeholder="e.g. Intro to React Workshop"
            />
          </FormField>
          <FormField id="field-description" label="Description" required error={err('description')} flag={flags?.description}>
            <textarea
              id="field-description"
              rows={5}
              className={`input ${invalid('description')}`}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              aria-invalid={!!err('description')}
              aria-describedby={err('description') ? 'field-description-error' : undefined}
              placeholder="What will happen, who is it for, and what should people bring?"
            />
          </FormField>
          <FormField id="field-category" label="Category" required error={err('category')} flag={flags?.category}>
            <select
              id="field-category"
              className={`input ${invalid('category')}`}
              value={values.category}
              onChange={(e) => set('category', e.target.value as Category | '')}
              aria-invalid={!!err('category')}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
        </section>

        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="sec-when">
          <h2 id="sec-when" className="text-lg font-semibold">Date &amp; time</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="field-startDate" label="Start date" required error={err('startDate')} flag={flags?.startDate}>
              <input
                id="field-startDate"
                type="date"
                className={`input ${invalid('startDate')}`}
                value={values.startDate}
                onChange={(e) => {
                  set('startDate', e.target.value)
                  if (!values.endDate) set('endDate', e.target.value)
                }}
                aria-invalid={!!err('startDate')}
              />
            </FormField>
            <FormField id="field-startTime" label="Start time" required error={err('startTime')} flag={flags?.startTime}>
              <input
                id="field-startTime"
                type="time"
                className={`input ${invalid('startTime')}`}
                value={values.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                aria-invalid={!!err('startTime')}
              />
            </FormField>
            <FormField id="field-endDate" label="End date" required error={err('endDate')}>
              <input
                id="field-endDate"
                type="date"
                className={`input ${invalid('endDate')}`}
                value={values.endDate}
                min={values.startDate || undefined}
                onChange={(e) => set('endDate', e.target.value)}
                aria-invalid={!!err('endDate')}
              />
            </FormField>
            <FormField id="field-endTime" label="End time" required error={err('endTime')} flag={flags?.endTime}>
              <input
                id="field-endTime"
                type="time"
                className={`input ${invalid('endTime')}`}
                value={values.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                aria-invalid={!!err('endTime')}
              />
            </FormField>
          </div>
        </section>

        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="sec-where">
          <div className="flex items-center justify-between">
            <h2 id="sec-where" className="text-lg font-semibold text-white">Event Mode &amp; Location</h2>
            <div className="flex rounded-lg bg-[#0F172A] border border-[#334155] p-1">
              {(['in-person', 'online', 'hybrid'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('mode', m)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                    values.mode === m ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="field-venueName"
              label={values.mode === 'online' ? 'Platform / Online Venue' : 'Venue name'}
              required={values.mode !== 'online'}
              error={err('venueName')}
              flag={flags?.venueName}
            >
              <input
                id="field-venueName"
                className={`input ${invalid('venueName')}`}
                value={values.venueName}
                placeholder={values.mode === 'online' ? 'e.g. Discord, Zoom, or Google Meet' : 'e.g. Main Auditorium'}
                onChange={(e) => set('venueName', e.target.value)}
                aria-invalid={!!err('venueName')}
              />
            </FormField>
            <FormField id="field-localityId" label="Locality Hub (Mumbai & Navi Mumbai only)" required>
              <select
                id="field-localityId"
                className="input"
                value={values.localityId}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'custom') {
                    setValues((v) => ({ ...v, localityId: 'custom' }))
                  } else {
                    const loc = getLocality(val)
                    setValues((v) => ({ ...v, localityId: loc.id, lat: loc.lat, lng: loc.lng }))
                  }
                }}
              >
                <optgroup label="Mumbai Hubs">
                  {LOCALITIES.filter((l) => l.city === 'Mumbai').map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}, Mumbai
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Navi Mumbai Hubs">
                  {LOCALITIES.filter((l) => l.city === 'Navi Mumbai').map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}, Navi Mumbai
                    </option>
                  ))}
                </optgroup>
                <option value="custom">Other Mumbai / Navi Mumbai Area or Road...</option>
              </select>
            </FormField>
          </div>

          {values.localityId === 'custom' && (
            <FormField id="field-customLocality" label="Custom Area / Road Name (Mumbai & Navi Mumbai)" required>
              <input
                id="field-customLocality"
                className="input"
                placeholder="e.g. Linking Road, Bandra West or Palm Beach Road, Vashi"
                value={customLocality}
                onChange={(e) => {
                  setCustomLocality(e.target.value)
                  if (e.target.value.length > 4) {
                    void triggerGeocode(e.target.value)
                  }
                }}
              />
            </FormField>
          )}

          {values.mode !== 'online' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-address" className="label mb-0">
                    Venue address <span className="text-brand">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void triggerGeocode(values.address)}
                    disabled={geocoding || !values.address.trim()}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
                    Auto-detect on Map
                  </button>
                </div>
                <input
                  id="field-address"
                  className={`input ${invalid('address')}`}
                  value={values.address}
                  placeholder="e.g. SV Road, Irla, Vile Parle West, Mumbai or Sector 15, CBD Belapur"
                  onChange={(e) => set('address', e.target.value)}
                  aria-invalid={!!err('address')}
                />
                {geocoding && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-brand animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Detecting venue coordinates in Mumbai / Navi Mumbai...
                  </p>
                )}
                {!geocoding && geocodeStatus && (
                  <p
                    className={`mt-1 flex items-center gap-1.5 text-xs ${
                      geocodeStatus.success ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {geocodeStatus.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {geocodeStatus.message}
                  </p>
                )}
                {err('address') && (
                  <p className="mt-1 text-xs text-rose-400">{err('address')}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="label mb-0">Pin the exact spot</p>
                  <span className="font-mono text-[11px] text-ink-muted">
                    📍 {values.lat.toFixed(4)}, {values.lng.toFixed(4)}
                  </span>
                </div>
                <MapPicker
                  value={{ lat: values.lat, lng: values.lng }}
                  address={values.address}
                  onChange={(p) => setValues((v) => ({ ...v, lat: p.lat, lng: p.lng }))}
                />
                <p className="mt-1 text-xs text-ink-faint">
                  Map auto-detects from your venue address above. You can also drag the pin or click anywhere to fine-tune.
                </p>
              </div>
            </>
          )}
        </section>

        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="sec-hackathon">
          <h2 id="sec-hackathon" className="text-lg font-semibold text-white">Hackathon &amp; Rules Configuration</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="field-minTeamSize" label="Min Team Size" error={err('minTeamSize')}>
              <input
                id="field-minTeamSize"
                type="number"
                min={1}
                max={20}
                className={`input ${invalid('minTeamSize')}`}
                value={values.minTeamSize}
                onChange={(e) => set('minTeamSize', e.target.value)}
              />
            </FormField>
            <FormField id="field-maxTeamSize" label="Max Team Size" error={err('maxTeamSize')}>
              <input
                id="field-maxTeamSize"
                type="number"
                min={1}
                max={20}
                className={`input ${invalid('maxTeamSize')}`}
                value={values.maxTeamSize}
                onChange={(e) => set('maxTeamSize', e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="field-registrationDeadline" label="Registration Deadline (Optional)" error={err('registrationDeadline')}>
              <input
                id="field-registrationDeadline"
                type="date"
                className={`input ${invalid('registrationDeadline')}`}
                value={values.registrationDeadline}
                onChange={(e) => set('registrationDeadline', e.target.value)}
              />
            </FormField>
            <FormField id="field-submissionDeadline" label="Submission Deadline (Optional)" error={err('submissionDeadline')}>
              <input
                id="field-submissionDeadline"
                type="date"
                className={`input ${invalid('submissionDeadline')}`}
                value={values.submissionDeadline}
                onChange={(e) => set('submissionDeadline', e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="field-tracks" label="Tracks / Domains (comma-separated)">
            <input
              id="field-tracks"
              className="input"
              value={values.tracks}
              placeholder="e.g. AI/ML, Web3, FinTech, Open Innovation"
              onChange={(e) => set('tracks', e.target.value)}
            />
          </FormField>

          <FormField id="field-prizesSummary" label="Prizes &amp; Rewards">
            <textarea
              id="field-prizesSummary"
              rows={3}
              className="input"
              value={values.prizesSummary}
              placeholder="e.g. 1st Place: ₹50,000 + Cloud Credits, 2nd Place: ₹25,000"
              onChange={(e) => set('prizesSummary', e.target.value)}
            />
          </FormField>

          <FormField id="field-rules" label="Rules &amp; Guidelines">
            <textarea
              id="field-rules"
              rows={4}
              className="input"
              value={values.rules}
              placeholder="Eligibility criteria, code of conduct, submission format, and judging criteria"
              onChange={(e) => set('rules', e.target.value)}
            />
          </FormField>
        </section>

        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="sec-tickets">
          <h2 id="sec-tickets" className="text-lg font-semibold text-white">Tickets &amp; Registration Link</h2>
          <div className="flex items-center justify-between rounded-xl bg-[#0F172A] border border-[#334155] px-4 py-3">
            <div>
              <p id="free-label" className="text-sm font-medium text-white">Free event</p>
              <p className="text-xs text-ink-muted">Turn off to set a ticket price.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values.isFree}
              aria-labelledby="free-label"
              onClick={() => set('isFree', !values.isFree)}
              className={`relative h-6 w-11 rounded-full transition ${values.isFree ? 'bg-brand' : 'bg-slate-700'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${values.isFree ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {!values.isFree && (
              <FormField id="field-price" label="Ticket price (₹)" required error={err('price')} flag={flags?.price}>
                <input
                  id="field-price"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={`input ${invalid('price')}`}
                  value={values.price}
                  onChange={(e) => set('price', e.target.value)}
                  aria-invalid={!!err('price')}
                />
              </FormField>
            )}
            <FormField id="field-capacity" label="Capacity" required error={err('capacity')}>
              <input
                id="field-capacity"
                type="number"
                min={1}
                inputMode="numeric"
                className={`input ${invalid('capacity')}`}
                value={values.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                aria-invalid={!!err('capacity')}
              />
            </FormField>
          </div>
          <FormField
            id="field-registrationUrl"
            label="Registration link (optional)"
            error={err('registrationUrl')}
            flag={flags?.registrationUrl}
            hint="External sign-up page, if you use one."
          >
            <input
              id="field-registrationUrl"
              type="url"
              className={`input ${invalid('registrationUrl')}`}
              value={values.registrationUrl}
              onChange={(e) => set('registrationUrl', e.target.value)}
              placeholder="https://"
              aria-invalid={!!err('registrationUrl')}
            />
          </FormField>
        </section>
      </div>

      <div className="space-y-6">
        {!hidePoster && (
          <section className="card p-5 sm:p-6" aria-labelledby="sec-poster">
            <h2 id="sec-poster" className="mb-4 text-lg font-semibold">Poster</h2>
            <PosterUpload id="field-posterUrl" value={values.posterUrl} onChange={(url) => set('posterUrl', url)} />
            <p className="mt-2 text-xs text-ink-faint">Optional. A poster is generated automatically if you skip this.</p>
          </section>
        )}

        <section className="card space-y-3 p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">{isEditing ? 'Save changes' : 'Ready to go?'}</h2>
          <p className="text-sm text-ink-muted">
            {isEditing
              ? 'Update the event and keep it published, or move it back to a draft.'
              : 'Publish now, or save a draft and finish later. Drafts only need a title.'}
          </p>
          <button type="submit" className="btn-primary w-full" disabled={busy !== null}>
            <Send className="h-4 w-4" aria-hidden />
            {busy === 'published' ? 'Publishing…' : (submitLabel ?? (isEditing ? 'Save & publish' : 'Publish event'))}
          </button>
          <button type="button" className="btn-secondary w-full" disabled={busy !== null} onClick={() => void submit('draft')}>
            <Save className="h-4 w-4" aria-hidden />
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
        </section>
      </div>
    </form>
  )
}
