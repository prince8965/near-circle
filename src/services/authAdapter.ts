import type { User, UserRole } from '../types'
import { readStore, removeStore, writeStore } from '../utils/storage'
import { delay, notifyChange } from './bus'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface SignUpOptions {
  name: string
  email: string
  password: string
  role?: 'participant' | 'organizer'
  organizationName?: string
}

export interface AuthAdapter {
  getSession(): User | null
  signIn(email: string, password: string): Promise<User>
  signUp(optionsOrName: SignUpOptions | string, email?: string, password?: string): Promise<User>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  fetchUserProfile(userId: string): Promise<User | null>
}

const SESSION_KEY = 'session'

/** All demo organizer data belongs to this single identity (see README). */
export const DEMO_OWNER_ID = 'u-demo'

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `org-${Date.now().toString(36)}`
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export const demoAuthAdapter: AuthAdapter = {
  getSession() {
    return readStore<User | null>(SESSION_KEY, null)
  },
  async signIn(email, password) {
    await delay(500)
    if (!email || password.length < 8) {
      throw new Error('Enter a valid email and a password of at least 8 characters.')
    }
    const name = email.split('@')[0].replace(/[._-]+/g, ' ')
    // Demo organizer login check
    const isOrganizerEmail = email.toLowerCase().includes('org') || email.toLowerCase().includes('admin')
    const role: UserRole = isOrganizerEmail ? 'organizer' : 'participant'
    const user: User = {
      id: DEMO_OWNER_ID,
      name: titleCase(name),
      email,
      role,
    }
    writeStore(SESSION_KEY, user)
    notifyChange()
    return user
  },
  async signUp(optionsOrName, maybeEmail, maybePassword) {
    await delay(500)
    let name: string
    let email: string
    let password: string
    let role: UserRole = 'participant'

    if (typeof optionsOrName === 'object') {
      name = optionsOrName.name
      email = optionsOrName.email
      password = optionsOrName.password
      role = optionsOrName.role ?? 'participant'
    } else {
      name = optionsOrName
      email = maybeEmail || ''
      password = maybePassword || ''
    }

    if (!name || !email || password.length < 8) {
      throw new Error('Please complete all fields correctly.')
    }

    const user: User = {
      id: DEMO_OWNER_ID,
      name: name.trim(),
      email,
      role,
    }
    writeStore(SESSION_KEY, user)
    notifyChange()
    return user
  },
  async signOut() {
    await delay(150)
    removeStore(SESSION_KEY)
    notifyChange()
  },
  async resetPassword(email: string) {
    await delay(400)
    if (!email) throw new Error('Please enter a valid email address.')
  },
  async fetchUserProfile(userId: string) {
    const session = readStore<User | null>(SESSION_KEY, null)
    if (session && session.id === userId) return session
    return null
  },
}

export const supabaseAuthAdapter: AuthAdapter = {
  getSession() {
    return readStore<User | null>(SESSION_KEY, null)
  },

  async fetchUserProfile(userId: string): Promise<User | null> {
    try {
      // 1. Fetch authoritative profile from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Could not fetch user profile from Supabase:', error.message)
      }

      // 2. If organizer, check for owned organization
      let organizationId: string | undefined
      if (profile?.role === 'organizer' || profile?.role === 'admin') {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle()
        if (org) organizationId = org.id
      }

      const session = this.getSession()
      if (profile) {
        const updated: User = {
          id: userId,
          name: profile.full_name || session?.name || 'User',
          email: session?.email || '',
          role: profile.role as UserRole,
          avatarUrl: profile.avatar_url || session?.avatarUrl,
          organizationId,
        }
        writeStore(SESSION_KEY, updated)
        return updated
      }

      return session
    } catch {
      return this.getSession()
    }
  },

  async signIn(email, password) {
    await delay(500)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please verify your credentials.')
      }
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Login failed. No user record returned.')
    }

    // Query database for authoritative role & profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url')
      .eq('id', data.user.id)
      .maybeSingle()

    const rawRole = profile?.role || data.user.user_metadata?.role || 'participant'
    const role: UserRole = ['participant', 'organizer', 'judge', 'admin'].includes(rawRole)
      ? (rawRole as UserRole)
      : 'participant'

    let organizationId: string | undefined
    if (role === 'organizer' || role === 'admin') {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', data.user.id)
        .maybeSingle()
      if (org) organizationId = org.id
    }

    const user: User = {
      id: data.user.id,
      name:
        profile?.full_name ||
        (data.user.user_metadata?.name as string) ||
        titleCase(email.split('@')[0].replace(/[._-]+/g, ' ')),
      email: data.user.email || email.trim(),
      role,
      avatarUrl: profile?.avatar_url,
      organizationId,
    }

    writeStore(SESSION_KEY, user)
    notifyChange()
    return user
  },

  async signUp(optionsOrName, maybeEmail, maybePassword) {
    await delay(500)
    let name: string
    let email: string
    let password: string
    let role: 'participant' | 'organizer' = 'participant'
    let organizationName: string | undefined

    if (typeof optionsOrName === 'object') {
      name = optionsOrName.name
      email = optionsOrName.email
      password = optionsOrName.password
      role = optionsOrName.role === 'organizer' ? 'organizer' : 'participant'
      organizationName = optionsOrName.organizationName
    } else {
      name = optionsOrName
      email = maybeEmail || ''
      password = maybePassword || ''
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          role,
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email already exists. Please log in instead.')
      }
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Registration failed. Please try again.')
    }

    const userId = data.user.id
    let organizationId: string | undefined

    // If signed up as an organizer with an organization name, create initial organization record
    if (role === 'organizer' && organizationName && organizationName.trim()) {
      try {
        const cleanOrgName = organizationName.trim()
        const slug = `${slugify(cleanOrgName)}-${userId.slice(0, 5)}`
        const { data: orgData } = await supabase
          .from('organizations')
          .insert({
            name: cleanOrgName,
            slug,
            owner_id: userId,
            description: `${cleanOrgName} on NearCircle.`,
            category: 'Technology',
            locality_id: 'loc-koramangala',
            is_verified: false,
            follower_count: 0,
          })
          .select('id')
          .maybeSingle()

        if (orgData) organizationId = orgData.id
      } catch (orgErr) {
        console.warn('Initial organization profile setup note:', orgErr)
      }
    }

    const user: User = {
      id: userId,
      name: (data.user.user_metadata?.name as string) || name.trim(),
      email: data.user.email || email.trim(),
      role,
      organizationId,
    }

    writeStore(SESSION_KEY, user)
    notifyChange()
    return user
  },

  async signOut() {
    await delay(150)
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore network errors on signout
    }
    removeStore(SESSION_KEY)
    notifyChange()
  },

  async resetPassword(email: string) {
    await delay(400)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?reset=success`,
    })
    if (error) {
      throw new Error(error.message)
    }
  },
}

/** Uses real Supabase Auth when credentials are configured in .env, else falls back to demo mode. */
export const authAdapter: AuthAdapter = isSupabaseConfigured() ? supabaseAuthAdapter : demoAuthAdapter
