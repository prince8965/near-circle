import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User, UserRole } from '../types'
import { authAdapter, isSupabaseConfigured, supabase, type SignUpOptions } from '../services'

interface AuthValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  isParticipant: boolean
  isOrganizer: boolean
  isAdmin: boolean
  isJudge: boolean
  signIn: (email: string, password: string) => Promise<User>
  signUp: (optionsOrName: SignUpOptions | string, email?: string, password?: string) => Promise<User>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authAdapter.getSession())
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured())

  // Initial session restoration and live sync
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    let isMounted = true

    // 1. Restore active session and load authoritative profile from database
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return
      if (session?.user) {
        const profileUser = await authAdapter.fetchUserProfile(session.user.id)
        if (isMounted) {
          setUser(profileUser)
          setLoading(false)
        }
      } else {
        if (isMounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }).catch(() => {
      if (isMounted) setLoading(false)
    })

    // 2. Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      if (session?.user) {
        const profileUser = await authAdapter.fetchUserProfile(session.user.id)
        if (isMounted) setUser(profileUser)
      } else {
        if (isMounted) setUser(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const loggedIn = await authAdapter.signIn(email, password)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const signUp = useCallback(
    async (optionsOrName: SignUpOptions | string, email?: string, password?: string) => {
      const newUser = await authAdapter.signUp(optionsOrName, email, password)
      setUser(newUser)
      return newUser
    },
    [],
  )

  const signOut = useCallback(async () => {
    await authAdapter.signOut()
    setUser(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await authAdapter.resetPassword(email)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const refreshed = await authAdapter.fetchUserProfile(user.id)
      if (refreshed) setUser(refreshed)
    }
  }, [user?.id])

  const role: UserRole | undefined = user?.role

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isParticipant: role === 'participant',
      isOrganizer: role === 'organizer' || role === 'admin',
      isAdmin: role === 'admin',
      isJudge: role === 'judge' || role === 'admin',
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, loading, role, signIn, signUp, signOut, resetPassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
