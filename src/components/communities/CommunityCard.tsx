import { Link } from 'react-router-dom'
import { MapPin, Users } from 'lucide-react'
import { getLocality } from '../../data/localities'
import type { CommunityWithState } from '../../services'
import { CategoryChip } from '../ui/CategoryChip'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FollowButton } from './FollowButton'

export function CommunityCard({ community }: { community: CommunityWithState }) {
  return (
    <article className="card flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#0B0F19] shadow-cyber"
          style={{ backgroundColor: community.accent }}
          aria-hidden
        >
          <CategoryIcon category={community.category} className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-white">
            <Link to={`/communities/${community.id}`} className="hover:text-brand">
              {community.name}
            </Link>
          </h3>
          <div className="mt-1.5">
            <CategoryChip category={community.category} size="sm" />
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-ink-muted">{community.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="space-y-0.5 text-xs text-ink-faint">
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brand" aria-hidden />
            {community.members.toLocaleString('en-IN')} members
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-brand" aria-hidden />
            {getLocality(community.localityId).name}
          </p>
        </div>
        <FollowButton community={community} />
      </div>
    </article>
  )
}
