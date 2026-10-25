import { useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { useToast } from '../../hooks/ToastContext'
import { followCommunity, unfollowCommunity, type CommunityWithState } from '../../services'

export function FollowButton({ community, className = '' }: { community: CommunityWithState; className?: string }) {
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (community.isFollowing) {
        await unfollowCommunity(community.id)
        notify(`You unfollowed ${community.name}.`, 'info')
      } else {
        await followCommunity(community.id)
        notify(`You’re now following ${community.name}.`)
      }
    } catch {
      notify('Could not update your follow. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={community.isFollowing}
      aria-label={`${community.isFollowing ? 'Unfollow' : 'Follow'} ${community.name}`}
      className={`${community.isFollowing ? 'btn border border-brand/60 bg-brand/15 text-brand hover:bg-brand/25 hover:border-brand' : 'btn-primary'} px-3.5 py-2 ${className}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : community.isFollowing ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {community.isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
