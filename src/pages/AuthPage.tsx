import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Eye, EyeOff, Loader2, UserRound } from 'lucide-react'
import { Logo } from '../components/layout/Logo'
import { DemoNote } from '../components/ui/DemoNote'
import { FormField } from '../components/ui/FormField'
import { useApp } from '../hooks/AppContext'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'
import { isSupabaseConfigured } from '../services'

interface Props {
  mode: 'login' | 'signup'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Errors {
  name?: string
  email?: string
  password?: string
  confirm?: string
  orgName?: string
  form?: string
}

export default function AuthPage({ mode }: Props) {
  const isSignup = mode === 'signup'
  const { signIn, signUp, resetPassword } = useAuth()
  const { detectLocation } = useApp()
  const { notify } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [role, setRole] = useState<'participant' | 'organizer'>('participant')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  const validate = (): Errors => {
    const e: Errors = {}
    if (isForgot) {
      if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.'
      return e
    }

    if (isSignup && name.trim().length < 2) e.name = 'Enter your name.'
    if (isSignup && role === 'organizer' && orgName.trim().length < 2) {
      e.orgName = 'Enter your organization or company name.'
    }
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    if (isSignup && confirm !== password) e.confirm = 'Passwords don’t match.'
    return e
  }

  const handlePasswordReset = async (ev: FormEvent) => {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await resetPassword(email.trim())
      setResetSent(true)
      notify('Password reset email sent. Please check your inbox.', 'info')
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Could not send reset email.' })
    } finally {
      setBusy(false)
    }
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (isForgot) {
      return handlePasswordReset(ev)
    }

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.getElementById(`auth-${Object.keys(found)[0]}`)?.focus())
      return
    }
    setBusy(true)
    try {
      if (isSignup) {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          organizationName: role === 'organizer' ? orgName.trim() : undefined,
        })
      } else {
        await signIn(email.trim(), password)
      }
      void detectLocation(false)
      notify('Login successful!', 'success')
      navigate(from, { replace: true })
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
      {/* Branding Column */}
      <div className="hidden lg:block">
        <Logo className="mb-6" />
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">Find your people, nearby.</h1>
        <p className="mt-4 max-w-md text-lg text-ink-muted">
          Join to RSVP to events, follow communities, form hackathon teams, or host your own competitions.
        </p>
        <div className="mt-8 max-w-md space-y-3">
          <div className="rounded-2xl border border-[#334155]/60 bg-secondary p-4 text-sm text-ink-muted">
            <strong className="text-white block font-semibold mb-1">For Participants</strong>
            Browse published hackathons, create teams, submit projects, and follow local tech communities.
          </div>
          <div className="rounded-2xl border border-[#334155]/60 bg-secondary p-4 text-sm text-ink-muted">
            <strong className="text-white block font-semibold mb-1">For Organizers &amp; Companies</strong>
            Create official events, configure tracks and rules, review submissions, and manage judging workflows.
          </div>
        </div>
      </div>

      {/* Auth Card */}
      <div className="card mx-auto w-full max-w-md space-y-5 p-6 sm:p-8">
        <div>
          {isForgot ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsForgot(false)
                  setResetSent(false)
                  setErrors({})
                }}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to log in
              </button>
              <h2 className="text-2xl font-bold text-white">Reset password</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Enter your email address and we will send you a reset link.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {isSignup ? 'Join NearCircle as a participant or organizer.' : 'Log in to access your platform dashboard.'}
              </p>
            </>
          )}
        </div>

        {!isSupabaseConfigured() && (
          <DemoNote>
            Demo mode active: Supabase credentials not found. Local temporary session will be created.
          </DemoNote>
        )}

        {isForgot ? (
          resetSent ? (
            <div className="space-y-4 rounded-xl border border-brand/30 bg-brand/10 p-5 text-center text-sm text-white">
              <p className="font-semibold">Reset instructions sent!</p>
              <p className="text-ink-muted text-xs">
                Check your inbox for <strong>{email}</strong> and follow the link to reset your password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsForgot(false)
                  setResetSent(false)
                }}
                className="btn-secondary w-full text-xs"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} noValidate className="space-y-4">
              <FormField id="auth-email" label="Email" required error={errors.email}>
                <input
                  id="auth-email"
                  type="email"
                  className="input"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                />
              </FormField>

              {errors.form && (
                <p role="alert" className="rounded-lg bg-rose-950/40 border border-rose-500/30 px-3 py-2 text-sm font-medium text-rose-300">
                  {errors.form}
                </p>
              )}

              <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin text-[#0B0F19]" aria-hidden />}
                Send reset link
              </button>
            </form>
          )
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {/* Account Type Selector for Signup */}
            {isSignup && (
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
                  <button
                    type="button"
                    onClick={() => setRole('participant')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                      role === 'participant'
                        ? 'border-brand bg-brand/10 text-white shadow-cyber'
                        : 'border-[#334155] bg-[#0F172A] text-ink-muted hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                      <UserRound className={`h-4 w-4 ${role === 'participant' ? 'text-brand' : 'text-ink-muted'}`} />
                      Participant
                    </div>
                    <span className="mt-1 text-[11px] leading-snug text-ink-muted">
                      Join hackathons, teams &amp; meetups
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('organizer')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                      role === 'organizer'
                        ? 'border-brand bg-brand/10 text-white shadow-cyber'
                        : 'border-[#334155] bg-[#0F172A] text-ink-muted hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                      <Building2 className={`h-4 w-4 ${role === 'organizer' ? 'text-brand' : 'text-ink-muted'}`} />
                      Organizer
                    </div>
                    <span className="mt-1 text-[11px] leading-snug text-ink-muted">
                      Host events &amp; manage hackathons
                    </span>
                  </button>
                </div>
              </div>
            )}

            {isSignup && (
              <FormField id="auth-name" label="Full name" required error={errors.name}>
                <input
                  id="auth-name"
                  className="input"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                />
              </FormField>
            )}

            {isSignup && role === 'organizer' && (
              <FormField id="auth-org" label="Organization / Club Name" required error={errors.orgName}>
                <input
                  id="auth-org"
                  className="input"
                  placeholder="e.g. ACM Student Chapter, Google Club, etc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  aria-invalid={!!errors.orgName}
                />
              </FormField>
            )}

            <FormField id="auth-email" label="Email" required error={errors.email}>
              <input
                id="auth-email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
              />
            </FormField>

            <FormField id="auth-password" label="Password" required error={errors.password} hint="At least 8 characters.">
              <div className="relative">
                <input
                  id="auth-password"
                  type={show ? 'text' : 'password'}
                  className="input pr-11"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint hover:text-white"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            {!isSignup && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgot(true)
                    setErrors({})
                  }}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {isSignup && (
              <FormField id="auth-confirm" label="Confirm password" required error={errors.confirm}>
                <input
                  id="auth-confirm"
                  type={show ? 'text' : 'password'}
                  className="input"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={!!errors.confirm}
                />
              </FormField>
            )}

            {errors.form && (
              <p role="alert" className="rounded-lg bg-rose-950/40 border border-rose-500/30 px-3 py-2 text-sm font-medium text-rose-300">
                {errors.form}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin text-[#0B0F19]" aria-hidden />}
              {isSignup ? `Create ${role === 'organizer' ? 'Organizer' : 'Participant'} Account` : 'Log in'}
            </button>
          </form>
        )}

        {!isForgot && (
          <p className="text-center text-sm text-ink-muted">
            {isSignup ? 'Already have an account?' : 'New to NearCircle?'}{' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              state={location.state}
              className="font-semibold text-brand hover:underline"
            >
              {isSignup ? 'Log in' : 'Sign up'}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
