import { useEffect, useRef, useState } from 'react'
import { Edit3, ImagePlus, Trash2, X } from 'lucide-react'
import { SEED_COMMUNITIES } from '../../data/communities'
import { LOCALITIES } from '../../data/localities'
import { SEED_ORGANIZATIONS } from '../../data/organizations'
import { useToast } from '../../hooks/ToastContext'
import { getEvents, updatePost } from '../../services'
import { CATEGORIES, type Category, type CommunityPost, type Event } from '../../types'
import { fileToResizedDataUrl } from '../../utils/image'

interface Props {
  post: CommunityPost | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

export function EditPostModal({ post, open, onClose, onUpdated }: Props) {
  const { notify } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [content, setContent] = useState('')
  const [category, setCategory] = useState<Category>('Technology')
  const [communityId, setCommunityId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [localityId, setLocalityId] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [selectedEventId, setSelectedEventId] = useState('')
  const [customEventDate, setCustomEventDate] = useState('')
  const [customEventLocation, setCustomEventLocation] = useState('')
  const [customEventLink, setCustomEventLink] = useState('')

  const [availableEvents, setAvailableEvents] = useState<Event[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !post) return
    setContent(post.content)
    setCategory(post.category)
    setCommunityId(post.communityId || '')
    setOrganizationId(post.organizationId || '')
    setLocalityId(post.localityId || '')
    setImageUrl(post.imageUrl)
    setSelectedEventId(post.eventId || '')
    setCustomEventDate(post.customEventDate || '')
    setCustomEventLocation(post.customEventLocation || '')
    setCustomEventLink(post.customEventLink || '')

    getEvents().then((evts) => {
      setAvailableEvents(evts.filter((e) => e.status === 'published'))
    })
  }, [open, post])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open || !post) return null

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const resized = await fileToResizedDataUrl(file, 960, 0.85)
      setImageUrl(resized)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not upload image.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!content.trim()) {
      setErrorMessage('Content cannot be empty.')
      return
    }

    setSubmitting(true)
    try {
      await updatePost(post.id, {
        content: content.trim(),
        category,
        communityId: communityId || undefined,
        organizationId: organizationId || undefined,
        localityId: localityId || undefined,
        imageUrl,
        eventId: selectedEventId || undefined,
        customEventDate: !selectedEventId ? customEventDate.trim() : undefined,
        customEventLocation: !selectedEventId ? customEventLocation.trim() : undefined,
        customEventLink: !selectedEventId ? customEventLink.trim() : undefined,
      })

      notify('Post updated successfully.', 'success')
      onUpdated()
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update post.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edit-post-title">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} aria-hidden />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#334155] bg-secondary shadow-lift">
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4">
          <div className="flex items-center gap-2 text-white">
            <Edit3 className="h-5 w-5 text-brand" />
            <h2 id="edit-post-title" className="text-lg font-bold">
              Edit Community Post
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-medium text-rose-300">
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="edit-post-content" className="label text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Post Content
            </label>
            <textarea
              id="edit-post-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input resize-none text-sm"
              maxLength={1500}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-category" className="label text-xs">Category</label>
              <select
                id="edit-category"
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
              <label htmlFor="edit-locality" className="label text-xs">Locality</label>
              <select
                id="edit-locality"
                value={localityId}
                onChange={(e) => setLocalityId(e.target.value)}
                className="input text-xs"
              >
                <option value="" className="bg-secondary text-ink-faint">None specified</option>
                {LOCALITIES.map((l) => (
                  <option key={l.id} value={l.id} className="bg-secondary text-white">
                    {l.name}, {l.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-community" className="label text-xs">Community</label>
              <select
                id="edit-community"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="input text-xs"
              >
                <option value="" className="bg-secondary text-ink-faint">None (General Post)</option>
                {SEED_COMMUNITIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-secondary text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-organization" className="label text-xs">Organization</label>
              <select
                id="edit-organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="input text-xs"
              >
                <option value="" className="bg-secondary text-ink-faint">None (Personal Post)</option>
                {SEED_ORGANIZATIONS.map((org) => (
                  <option key={org.id} value={org.id} className="bg-secondary text-white">
                    {org.name} {org.isVerified ? '(Verified)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-event" className="label text-xs">Linked NearCircle Event</label>
            <select
              id="edit-event"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="input text-xs"
            >
              <option value="" className="bg-secondary text-ink-faint">None</option>
              {availableEvents.map((evt) => (
                <option key={evt.id} value={evt.id} className="bg-secondary text-white">
                  {evt.title} ({evt.venueName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs">Image or Poster</label>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-[#334155] bg-canvas">
                <img src={imageUrl} alt="Preview" className="max-h-48 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-rose-400 hover:bg-black/90 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary w-full text-xs"
              >
                <ImagePlus className="h-4 w-4" /> Add image or poster
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleImageFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#334155]">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-xs px-6 py-2.5 font-bold">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
