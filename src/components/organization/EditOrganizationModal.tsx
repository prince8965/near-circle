import { useEffect, useState, type FormEvent } from 'react'
import { Globe, Mail, ShieldAlert, Sparkles, X } from 'lucide-react'
import { CATEGORIES, type Category, type Organization } from '../../types'
import { LOCALITIES } from '../../data/localities'
import { useToast } from '../../hooks/ToastContext'
import { createOrganization, updateOrganization } from '../../services'

interface Props {
  organization: Organization | null
  isOpen: boolean
  onClose: () => void
  onSaved: (org: Organization) => void
}

const ACCENT_PRESETS = [
  '#00F2FE', // Neon Cyan
  '#38BDF8', // Sky Blue
  '#A855F7', // Vibrant Purple
  '#F43F5E', // Rose Pink
  '#10B981', // Emerald Green
  '#F59E0B', // Amber
  '#6366F1', // Indigo
]

export function EditOrganizationModal({ organization, isOpen, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const isCreating = !organization

  const [name, setName] = useState(organization?.name ?? '')
  const [description, setDescription] = useState(organization?.description ?? '')
  const [category, setCategory] = useState<Category>(organization?.category ?? 'Technology')
  const [localityId, setLocalityId] = useState(organization?.localityId ?? 'andheri')
  const [websiteUrl, setWebsiteUrl] = useState(organization?.websiteUrl ?? '')
  const [contactEmail, setContactEmail] = useState(organization?.contactEmail ?? '')
  const [accentColor, setAccentColor] = useState(organization?.accentColor ?? '#00F2FE')
  const [logoUrl, setLogoUrl] = useState(organization?.logoUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization) {
      setName(organization.name)
      setDescription(organization.description)
      setCategory(organization.category)
      setLocalityId(organization.localityId)
      setWebsiteUrl(organization.websiteUrl ?? '')
      setContactEmail(organization.contactEmail ?? '')
      setAccentColor(organization.accentColor || '#00F2FE')
      setLogoUrl(organization.logoUrl ?? '')
    } else {
      setName('')
      setDescription('')
      setCategory('Technology')
      setLocalityId('andheri')
      setWebsiteUrl('')
      setContactEmail('')
      setAccentColor('#00F2FE')
      setLogoUrl('')
    }
    setError(null)
  }, [organization, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide an organization name.')
      return
    }
    if (description.trim().length < 15) {
      setError('Please provide a description of at least 15 characters.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      if (isCreating) {
        const created = await createOrganization({
          name: name.trim(),
          description: description.trim(),
          category,
          localityId,
          websiteUrl: websiteUrl.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          accentColor,
          logoUrl: logoUrl.trim() || undefined,
        })
        notify('Organization profile created!', 'success')
        onSaved(created)
      } else {
        const updated = await updateOrganization(organization.id, {
          name: name.trim(),
          description: description.trim(),
          category,
          localityId,
          websiteUrl: websiteUrl.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          accentColor,
          logoUrl: logoUrl.trim() || undefined,
        })
        notify('Organization profile updated.', 'success')
        onSaved(updated)
      }
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save organization profile.'
      setError(msg)
      notify(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-org-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#334155] bg-[#0B0F19] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 id="edit-org-title" className="text-lg font-bold text-white">
              {isCreating ? 'Set Up Organization Profile' : 'Edit Organization Profile'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-[#1E293B] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          {/* Verification info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-950/30 p-4 text-xs text-sky-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div>
              <p className="font-semibold text-white">
                {organization?.isVerified
                  ? 'Official Campus Verification Active'
                  : 'Platform Verification Protocol'}
              </p>
              <p className="mt-0.5 text-ink-muted leading-relaxed">
                {organization?.isVerified
                  ? 'This organization has verified status with official campus credentials.'
                  : 'Verification badges are authorized by NearCircle platform administrators. Organizers cannot self-verify.'}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="org-name" className="label">
              Organization / Club Name <span className="text-brand">*</span>
            </label>
            <input
              id="org-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ACM Student Chapter"
              required
            />
          </div>

          <div>
            <label htmlFor="org-desc" className="label">
              Description <span className="text-brand">*</span>
            </label>
            <textarea
              id="org-desc"
              rows={4}
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell students what your organization does, what kind of events you organize, and how they can get involved."
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="org-cat" className="label">
                Domain / Category
              </label>
              <select
                id="org-cat"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="org-locality" className="label">
                Campus / Locality Hub
              </label>
              <select
                id="org-locality"
                className="input"
                value={localityId}
                onChange={(e) => setLocalityId(e.target.value)}
              >
                {LOCALITIES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}, {l.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="org-web" className="label">
                Website Link (Optional)
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint" />
                <input
                  id="org-web"
                  type="url"
                  className="input pl-9"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourclub.edu"
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-email" className="label">
                Public Contact Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint" />
                <input
                  id="org-email"
                  type="email"
                  className="input pl-9"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="leads@yourclub.edu"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Brand Accent Color</label>
            <div className="flex flex-wrap items-center gap-3">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  className={`h-9 w-9 rounded-xl transition border-2 ${
                    accentColor.toLowerCase() === color.toLowerCase()
                      ? 'border-white shadow-lift scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-[#334155] bg-transparent p-1"
                title="Custom color"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#1E293B] pt-4">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2" disabled={busy}>
              {busy ? 'Saving…' : isCreating ? 'Create Profile' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
