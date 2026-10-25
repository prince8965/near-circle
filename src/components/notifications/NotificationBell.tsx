import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeChange,
} from '../../services'
import type { AppNotification } from '../../types'
import { formatRelativeTime } from '../../utils/format'

export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const reload = async () => {
    if (!user) return
    try {
      const items = await getNotifications(user.id)
      setNotifications(items)
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    void reload()
    const unsubscribe = subscribeChange(() => {
      void reload()
    })
    return () => unsubscribe()
  }, [user?.id])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  if (!user) return null

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleMarkAllRead = async () => {
    setLoading(true)
    try {
      await markAllNotificationsAsRead(user.id)
      await reload()
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id).catch(() => {})
      void reload()
    }
    setOpen(false)
  }

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'registration_confirmed':
      case 'registration_status_changed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'team_invitation':
      case 'team_joined':
        return <Users className="h-4 w-4 text-brand" />
      case 'submission_created':
      case 'submission_status_changed':
        return <Sparkles className="h-4 w-4 text-amber-400" />
      case 'deadline_reminder':
        return <Clock className="h-4 w-4 text-rose-400" />
      case 'judging_assigned':
        return <Award className="h-4 w-4 text-cyan-400" />
      case 'results_published':
        return <Trophy className="h-4 w-4 text-amber-400" />
      default:
        return <Bell className="h-4 w-4 text-brand" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-ink-muted hover:bg-secondary hover:text-white transition"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-[#0B0F19] shadow-cyber animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#334155] bg-[#0B0F19] p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Notifications</h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.2 text-[10px] font-semibold text-brand">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#334155]/60 pr-1 space-y-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`flex items-start gap-3 p-2.5 rounded-xl transition ${
                      n.isRead ? 'opacity-80 hover:bg-[#0F172A]' : 'bg-brand/5 border border-brand/20 hover:bg-brand/10'
                    }`}
                  >
                    <div className="mt-0.5 rounded-lg bg-[#0F172A] border border-[#334155] p-1.5 shrink-0">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold truncate ${n.isRead ? 'text-white' : 'text-brand'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-ink-faint shrink-0 whitespace-nowrap">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                )

                return n.link ? (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => handleNotificationClick(n)}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="cursor-pointer"
                  >
                    {content}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
