import { useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, UserRound, X } from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import { useToast } from '../../hooks/ToastContext'
import { NotificationBell } from '../notifications/NotificationBell'
import { Logo } from './Logo'

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, isOrganizer, signOut } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()

  const links = useMemo(() => {
    const items = [{ to: '/', label: 'Discover', end: true }]
    if (user) {
      items.push(
        { to: '/community', label: 'Community', end: false },
        { to: '/communities', label: 'Communities', end: false },
      )
      if (isOrganizer) {
        items.push({ to: '/organizer', label: 'Organizer Dashboard', end: false })
      } else {
        items.push({ to: '/my-events', label: 'My Events', end: false })
      }
      if (user.role === 'judge' || isOrganizer || user.role === 'admin') {
        items.push({ to: '/judge', label: 'Judging', end: false })
      }
      if (user.role === 'admin') {
        items.push({ to: '/admin', label: 'Admin Portal', end: false })
      }
    }
    return items
  }, [user, isOrganizer])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand text-[#0B0F19] shadow-cyber' : 'text-ink-muted hover:bg-secondary hover:text-white'
    }`

  const handleSignOut = async () => {
    await signOut()
    setOpen(false)
    notify('Signed out successfully.', 'info')
    navigate('/')
  }

  return (
    <header className="glass sticky top-0 z-40 border-b border-[#1E293B]/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-lg focus:bg-secondary focus:text-brand focus:px-3 focus:py-2 focus:ring-2 focus:ring-brand"
      >
        Skip to content
      </a>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link to="/" aria-label="NearCircle home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        {/* Dynamic Desktop Links */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* User / Authentication actions */}
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <NotificationBell />
              <span className="flex items-center gap-2 rounded-lg bg-secondary border border-[#334155] px-3 py-1.5 text-xs font-medium text-white">
                <UserRound className="h-3.5 w-3.5 text-brand" aria-hidden />
                <span className="font-semibold text-white">{user.name}</span>
                <span className="rounded-md bg-brand/10 border border-brand/30 px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                  {user.role}
                </span>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn-ghost text-xs px-2.5 py-1.5"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Log in
              </Link>
              <Link to="/signup" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-lg p-2 text-ink-muted hover:bg-secondary hover:text-white lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div id="mobile-menu" className="border-t border-[#1E293B] bg-[#0B0F19] px-4 pb-4 pt-2 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-[#1E293B] pt-3">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{user.name}</span>
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                    {user.role}
                  </span>
                </div>
                <button type="button" onClick={handleSignOut} className="btn-secondary w-full text-xs">
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link to="/signup" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
