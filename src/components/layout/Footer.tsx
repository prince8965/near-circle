import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#1E293B] bg-[#070A12]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-ink-muted">Connecting student &amp; campus communities across Mumbai &amp; Navi Mumbai.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          <Link to="/" className="hover:text-white transition">Discover</Link>
          <Link to="/community" className="hover:text-white transition">Community</Link>
          <Link to="/communities" className="hover:text-white transition">Communities</Link>
          <Link to="/my-events" className="hover:text-white transition">My Events</Link>
          <Link to="/organizer" className="hover:text-white transition">Organizer Dashboard</Link>
        </nav>
        <p className="text-xs text-ink-faint">
          &copy; {new Date().getFullYear()} NearCircle. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
