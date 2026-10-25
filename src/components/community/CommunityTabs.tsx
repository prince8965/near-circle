import { Building2, MapPin, Sparkles, User, Users } from 'lucide-react'
import type { CommunityTab } from '../../types'

interface Props {
  activeTab: CommunityTab
  onChangeTab: (tab: CommunityTab) => void
  myPostsCount?: number
  localityName?: string
}

export function CommunityTabs({ activeTab, onChangeTab, myPostsCount, localityName }: Props) {
  const tabs: { id: CommunityTab; label: string; icon: typeof Sparkles; badge?: string }[] = [
    { id: 'for-you', label: 'For You', icon: Sparkles },
    { id: 'following', label: 'Following', icon: Users },
    { id: 'nearby', label: localityName ? `Nearby (${localityName})` : 'Nearby', icon: MapPin },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    {
      id: 'my-posts',
      label: 'My Posts',
      icon: User,
      badge: myPostsCount !== undefined && myPostsCount > 0 ? String(myPostsCount) : undefined,
    },
  ]

  return (
    <div className="border-b border-[#1E293B] pb-px">
      <nav className="-mb-px flex gap-2 overflow-x-auto pb-2 scrollbar-none" aria-label="Community Feed Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-secondary text-brand border border-brand/40 shadow-[0_0_15px_rgba(0,242,254,0.15)]'
                  : 'text-ink-muted hover:bg-secondary/60 hover:text-white border border-transparent'
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-brand' : 'text-ink-faint group-hover:text-ink-muted'
                }`}
                aria-hidden
              />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-bold text-brand border border-brand/30">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
