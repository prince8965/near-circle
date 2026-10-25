import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'
import type { UserRole } from '../types'

interface Props {
  allowedRoles: UserRole[]
}

export function RoleGuard({ allowedRoles }: Props) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Verifying permissions">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <span className="text-sm font-medium text-ink-muted">Verifying permissions…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ from: location.pathname, requiredRole: allowedRoles.join(' or ') }}
        replace
      />
    )
  }

  return <Outlet />
}
