import { useState } from 'react'
import { Check, CheckCircle2, MapPin, Plus, Users } from 'lucide-react'
import { CategoryChip } from '../ui/CategoryChip'
import { CategoryIcon } from '../ui/CategoryIcon'
import { getLocality } from '../../data/localities'
import { useToast } from '../../hooks/ToastContext'
import { followOrganization, unfollowOrganization } from '../../services'
import type { Organization } from '../../types'

interface Props {
  organization: Organization
  onSelect: (org: Organization) => void
  onFollowToggled?: () => void
}

export function OrganizationCard({ organization, onSelect, onFollowToggled }: Props) {
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)
  const isFollowing = Boolean(organization.isFollowing)

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    try {
      if (isFollowing) {
        await unfollowOrganization(organization.id)
        notify(`Unfollowed ${organization.name}.`, 'info')
      } else {
        await followOrganization(organization.id)
        notify(`Following ${organization.name}! You'll see their updates in your Following feed.`, 'success')
      }
      onFollowToggled?.()
    } catch {
      notify('Could not update follow status.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const locality = getLocality(organization.localityId)

  return (
    <div
      onClick={() => onSelect(organization)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(organization)
        }
      }}
      className="card group flex flex-col justify-between p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-brand/50 hover:shadow-cyber cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#0B0F19] shadow-md transition-transform group-hover:scale-105"
              style={{ backgroundColor: organization.accentColor }}
              aria-hidden
            >
              <CategoryIcon category={organization.category} className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-white group-hover:text-brand transition-colors text-base">
                  {organization.name}
                </h3>
                {/* Only display verified badge when actual verification exists */}
                {organization.isVerified && (
                  <span
                    title="Verified Campus Organization"
                    className="inline-flex items-center text-brand"
                    aria-label="Verified Organization"
                  >
                    <CheckCircle2 className="h-4 w-4 fill-brand text-[#0B0F19]" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-brand" aria-hidden />
                  {locality.name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-brand" aria-hidden />
                  {organization.followerCount.toLocaleString('en-IN')} followers
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleFollow}
            disabled={busy}
            className={`btn shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              isFollowing
                ? 'bg-[#1E293B] text-ink-muted border border-[#334155] hover:border-rose-500/50 hover:text-rose-400'
                : 'btn-primary'
            }`}
            aria-label={isFollowing ? `Unfollow ${organization.name}` : `Follow ${organization.name}`}
          >
            {isFollowing ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                <span>Following</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>Follow</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-muted line-clamp-2">
          {organization.description}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#334155]/50 pt-3">
        <CategoryChip category={organization.category} size="sm" />
        <span className="text-xs font-semibold text-brand group-hover:underline">
          View Profile &amp; Events →
        </span>
      </div>
    </div>
  )
}
