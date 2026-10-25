import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  CalendarCheck,
  ImagePlus,
  Link as LinkIcon,
  MapPin,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { SEED_COMMUNITIES } from '../../data/communities'
import { LOCALITIES } from '../../data/localities'
import { SEED_ORGANIZATIONS } from '../../data/organizations'
import { useApp } from '../../hooks/AppContext'
import { useToast } from '../../hooks/ToastContext'
import { createPost, getEvents } from '../../services'
import { CATEGORIES, type Category, type Event } from '../../types'
import { fileToResizedDataUrl } from '../../utils/image'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  initialEventId?: string
}

export function CreatePostModal({ open, onClose, onCreated, initialEventId }: Props) {
  const { localityId: appLocalityId } = useApp()
  const { notify } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [content, setContent] = useState('')
  const [category, setCategory] = useState<Category>('Technology')
  const [communityId, setCommunityId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [localityId, setLocalityId] = useState(appLocalityId)

  // Media
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [imageError, setImageError] = useState<string | null>()

  // Event attachment
  const [availableEvents, setAvailableEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId ?? '')
  const [isEventPost, setIsEventPost] = useState(Boolean(initialEventId))

  // Manual event details
  const [customEventDate, setCustomEventDate] = useState('')
  const [customEventLocation, setCustomEventLocation] = useState('')
  const [customEventLink, setCustomEventLink] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch available events for attachment
  useEffect(() => {
    if (!open) return
    getEvents().then((evts) => {
      setAvailableEvents(evts.filter((e) => e.status === 'published'))
    })
  }, [open])

  // If initialEventId is provided, pre-fill
  useEffect(() => {
    if (initialEventId && availableEvents.length > 0) {
      setSelectedEventId(initialEventId)
      setIsEventPost(true)
      const ev = availableEvents.find((e) => e.id === initialEventId)
      if (ev) {
        setCategory(ev.category)
        if (ev.communityId) setCommunityId(ev.communityId)
        if (ev.posterUrl) setImageUrl(ev.posterUrl)
        if (!content) {
          setContent(`Excited to invite everyone to ${ev.title}! Happening at ${ev.venueName}. Tap the event below to RSVP and grab your seat!`)
        }
      }
    }
  }, [initialEventId, availableEvents, content])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, submitting, onClose])

  if (!open) return null

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return
    setImageError(null)
    try {
      const resized = await fileToResizedDataUrl(file, 960, 0.85)
      setImageUrl(resized)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not upload image.')
    }
  }

  const handleEventSelection = (eId: string) => {
    setSelectedEventId(eId)
    if (!eId) return
    const ev = availableEvents.find((e) => e.id === eId)
    if (ev) {
      setCategory(ev.category)
      if (ev.communityId) setCommunityId(ev.communityId)
      if (ev.posterUrl && !imageUrl) setImageUrl(ev.posterUrl)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!content.trim()) {
      setErrorMessage('Please write some content for your post.')
      return
    }

    setSubmitting(true)
    try {
      await createPost({
        content: content.trim(),
        category,
        communityId: communityId || undefined,
        organizationId: organizationId || undefined,
        localityId: localityId || undefined,
        imageUrl,
        eventId: selectedEventId || undefined,
        customEventDate: !selectedEventId && customEventDate ? customEventDate.trim() : undefined,
        customEventLocation: !selectedEventId && customEventLocation ? customEventLocation.trim() : undefined,
        customEventLink: !selectedEventId && customEventLink ? customEventLink.trim() : undefined,
      })

      notify('Post published successfully to the community!', 'success')
      onCreated()
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish post.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="create-post-title">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} aria-hidden />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#334155] bg-secondary shadow-lift">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 id="create-post-title" className="text-lg font-bold">
              Create Community Post
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-[#334155] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-medium text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Post Textarea */}
          <div>
            <label htmlFor="post-content" className="label text-xs font-semibold uppercase tracking-wider text-ink-faint">
              What do you want to share? <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="post-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ask a question, share an update, discuss a project, or announce an event to the campus..."
              className="input resize-none text-sm"
              maxLength={1500}
              required
            />
            <div className="mt-1 flex justify-end text-[11px] text-ink-faint">
              {content.length}/1500
            </div>
          </div>

          {/* Category & Locality */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="post-category" className="label text-xs">
                Category <span className="text-rose-400">*</span>
              </label>
              <select
                id="post-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="input text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-secondary text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="post-locality" className="label text-xs">
                Locality (Area)
              </label>
              <select
                id="post-locality"
                value={localityId}
                onChange={(e) => setLocalityId(e.target.value)}
                className="input text-xs"
              >
                {LOCALITIES.map((l) => (
                  <option key={l.id} value={l.id} className="bg-secondary text-white">
                    {l.name}, {l.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Community or Organization Selection */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="post-community" className="label text-xs">
                Post to Community (optional)
              </label>
              <select
                id="post-community"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="input text-xs"
              >
                <option value="" className="bg-secondary text-ink-faint">
                  None (General Post)
                </option>
                {SEED_COMMUNITIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-secondary text-white">
                    {c.name} ({c.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="post-organization" className="label text-xs">
                Post as Organization (optional)
              </label>
              <select
                id="post-organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="input text-xs"
              >
                <option value="" className="bg-secondary text-ink-faint">
                  Post as Myself (Student / Member)
                </option>
                {SEED_ORGANIZATIONS.map((org) => (
                  <option key={org.id} value={org.id} className="bg-secondary text-white">
                    {org.name} {org.isVerified ? '(Verified)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Image Upload / Event Poster */}
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Image or Event Poster (optional)
            </label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-[#334155] bg-canvas">
                <img
                  src={imageUrl}
                  alt="Post preview"
                  className="max-h-56 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-rose-400 hover:bg-black/90 hover:text-rose-300"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#334155] bg-[#0F172A]/50 p-6 text-center transition hover:border-brand/60 hover:bg-[#0F172A]"
              >
                <ImagePlus className="h-8 w-8 text-brand" />
                <p className="mt-2 text-xs font-semibold text-white">
                  Click to upload image or event poster
                </p>
                <p className="text-[11px] text-ink-muted">PNG, JPG or WebP up to 8 MB (downscaled automatically)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleImageFile(e.target.files?.[0])}
            />
            {imageError && (
              <p className="mt-1 text-xs text-rose-400">{imageError}</p>
            )}
          </div>

          {/* Event Integration Section */}
          <div className="rounded-xl border border-[#334155] bg-[#0F172A]/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                <input
                  type="checkbox"
                  checked={isEventPost}
                  onChange={(e) => setIsEventPost(e.target.checked)}
                  className="h-4 w-4 rounded border-[#334155] accent-brand"
                />
                <CalendarCheck className="h-4 w-4 text-brand" />
                <span>Link an Event or Announce Event Details</span>
              </label>
            </div>

            {isEventPost && (
              <div className="space-y-3 pt-2 border-t border-[#334155]/60">
                {/* Existing NearCircle Event Linking */}
                <div>
                  <label htmlFor="linked-event" className="label text-xs">
                    Link existing NearCircle event
                  </label>
                  <select
                    id="linked-event"
                    value={selectedEventId}
                    onChange={(e) => handleEventSelection(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="" className="bg-secondary text-ink-faint">
                      -- Choose an existing NearCircle event (or enter custom below) --
                    </option>
                    {availableEvents.map((evt) => (
                      <option key={evt.id} value={evt.id} className="bg-secondary text-white">
                        {evt.title} ({evt.venueName})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Links directly to the event page so students can RSVP immediately with no duplicate records.
                  </p>
                </div>

                {!selectedEventId && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-1">
                    <div>
                      <label htmlFor="custom-date" className="label text-[11px]">
                        <Calendar className="inline h-3 w-3 mr-1 text-brand" />
                        Event Date / Time
                      </label>
                      <input
                        id="custom-date"
                        type="text"
                        placeholder="e.g. Sat, Nov 15 at 4 PM"
                        value={customEventDate}
                        onChange={(e) => setCustomEventDate(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-location" className="label text-[11px]">
                        <MapPin className="inline h-3 w-3 mr-1 text-brand" />
                        Venue / Location
                      </label>
                      <input
                        id="custom-location"
                        type="text"
                        placeholder="e.g. Campus Amphitheater"
                        value={customEventLocation}
                        onChange={(e) => setCustomEventLocation(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-link" className="label text-[11px]">
                        <LinkIcon className="inline h-3 w-3 mr-1 text-brand" />
                        Event Link
                      </label>
                      <input
                        id="custom-link"
                        type="url"
                        placeholder="https://..."
                        value={customEventLink}
                        onChange={(e) => setCustomEventLink(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-xs px-6 py-2.5 font-bold"
            >
              {submitting ? 'Publishing…' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
