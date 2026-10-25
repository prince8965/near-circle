import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'

interface LocationState {
  requiredRole?: string
  from?: string
}

export default function UnauthorizedPage() {
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const location = useLocation()
  const state = (location.state as LocationState) || {}

  const handleSignOut = async () => {
    await signOut()
    notify('Signed out. Please sign in with an authorized account.', 'info')
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-cyber">
        <ShieldAlert className="h-8 w-8" aria-hidden />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Access Restricted
      </h1>

      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        {state.requiredRole ? (
          <>
            This page requires an account with the{' '}
            <strong className="text-white capitalize">{state.requiredRole}</strong> role.
          </>
        ) : (
          'You do not have permission to view or manage this section.'
        )}
      </p>

      {user && (
        <div className="mt-4 rounded-xl border border-[#334155] bg-secondary px-4 py-2.5 text-xs text-ink-muted">
          Currently signed in as <span className="font-semibold text-white">{user.name}</span> (Role:{' '}
          <span className="font-semibold text-brand uppercase">{user.role}</span>)
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="btn-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Discover
        </Link>
        {user ? (
          <button type="button" onClick={handleSignOut} className="btn-secondary">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign in as different user
          </button>
        ) : (
          <Link to="/login" className="btn-secondary">
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}
