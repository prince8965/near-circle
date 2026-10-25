import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import { useToast } from '../../hooks/ToastContext'
import {
  createTeam,
  disbandTeam,
  getTeamForEvent,
  inviteTeamMember,
  joinTeamByInviteCode,
  leaveTeam,
  removeTeamMember,
} from '../../services'
import type { EventWithMeta, TeamWithMembers } from '../../types'
import { ConfirmationModal } from '../ui/ConfirmationModal'

interface Props {
  event: EventWithMeta
  isRegistered: boolean
  onUpdate?: () => void
}

export function TeamSection({ event, isRegistered, onUpdate }: Props) {
  const { user } = useAuth()
  const { notify } = useToast()

  const [team, setTeam] = useState<TeamWithMembers | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  // Creation & Joining inputs
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Leader invite input
  const [inviteEmail, setInviteEmail] = useState('')

  // Confirmation Modals
  const [confirmDisband, setConfirmDisband] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)

  const isSoloOnly = event.maxTeamSize !== undefined && event.maxTeamSize <= 1
  const maxSize = event.maxTeamSize ?? 4
  const minSize = event.minTeamSize ?? 1

  const reloadTeam = async () => {
    if (!user || !isRegistered || isSoloOnly) {
      setTeam(null)
      return
    }
    setLoading(true)
    try {
      const found = await getTeamForEvent(event.id, user.id)
      setTeam(found)
    } catch (err) {
      console.warn('Could not load team for event:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadTeam()
  }, [event.id, user, isRegistered])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return
    setActionBusy(true)
    try {
      const created = await createTeam(event.id, teamName.trim())
      setTeam(created)
      setTeamName('')
      notify(`Team "${created.name}" created successfully!`)
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to create team.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setActionBusy(true)
    try {
      const joined = await joinTeamByInviteCode(inviteCode.trim())
      setTeam(joined)
      setInviteCode('')
      notify(`Joined team "${joined.name}"!`)
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to join team.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleCopyCode = async () => {
    if (!team?.inviteCode) return
    try {
      await navigator.clipboard.writeText(team.inviteCode)
      setCopied(true)
      notify('Invite code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify(`Invite code: ${team.inviteCode}`)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!team || !inviteEmail.trim()) return
    setActionBusy(true)
    try {
      await inviteTeamMember(team.id, inviteEmail.trim())
      notify(`Invitation sent to ${inviteEmail}!`)
      setInviteEmail('')
    } catch (err: any) {
      notify(err.message || 'Could not send invitation.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!team || !memberToRemove) return
    setActionBusy(true)
    try {
      await removeTeamMember(team.id, memberToRemove)
      notify('Team member removed.', 'info')
      setMemberToRemove(null)
      await reloadTeam()
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to remove member.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!team) return
    setActionBusy(true)
    try {
      await leaveTeam(team.id)
      notify('You have left the team.', 'info')
      setConfirmLeave(false)
      setTeam(null)
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to leave team.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const handleDisbandTeam = async () => {
    if (!team) return
    setActionBusy(true)
    try {
      await disbandTeam(team.id)
      notify('Team disbanded successfully.', 'info')
      setConfirmDisband(false)
      setTeam(null)
      onUpdate?.()
    } catch (err: any) {
      notify(err.message || 'Failed to disband team.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  if (isSoloOnly) {
    return (
      <section className="card p-5 sm:p-6" aria-labelledby="teams-heading">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-[#334155] text-brand">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 id="teams-heading" className="text-base font-semibold text-white">
              Solo Participation Event
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              This event accepts individual registrations only. Team submissions are not applicable.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5 sm:p-6 space-y-4" aria-labelledby="teams-heading">
      <div className="flex items-center justify-between border-b border-[#334155] pb-3">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-brand" />
          <div>
            <h2 id="teams-heading" className="text-base font-semibold text-white">
              Team Management
            </h2>
            <p className="text-xs text-ink-muted">
              Team size: {minSize}–{maxSize} members per team
            </p>
          </div>
        </div>

        {team && (
          <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-1 text-xs font-semibold text-brand">
            {team.members.length} / {maxSize} Members
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-brand" /> Loading team status...
        </div>
      ) : !user ? (
        <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 text-center">
          <p className="text-sm text-ink-muted">Sign in and register for this event to form or join a team.</p>
        </div>
      ) : !isRegistered ? (
        <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 text-center">
          <p className="text-sm text-ink-muted">
            You must be registered for <strong className="text-white">{event.title}</strong> before creating or joining a team.
          </p>
        </div>
      ) : team ? (
        /* Team Member / Leader View */
        <div className="space-y-4">
          <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs uppercase font-medium text-ink-faint">Your Team</span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {team.name}
                  {team.isLeader && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      <Crown className="h-3 w-3" /> Team Leader
                    </span>
                  )}
                </h3>
              </div>

              {/* Invite Code Box */}
              <div className="flex items-center gap-2 rounded-lg bg-[#0B0F19] border border-[#334155] px-3 py-1.5">
                <div>
                  <p className="text-[10px] uppercase font-bold text-ink-faint">Invite Code</p>
                  <p className="font-mono text-xs font-semibold text-brand">{team.inviteCode}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded p-1 text-ink-muted hover:text-white"
                  aria-label="Copy team invite code"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase font-medium text-ink-faint">Roster ({team.members.length})</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg bg-[#0B0F19] border border-[#334155] p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand text-xs font-bold">
                        {member.user?.name?.[0] ?? 'M'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {member.user?.name || `Member (${member.userId.slice(0, 6)})`}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {member.role === 'leader' ? 'Leader' : 'Member'}
                        </p>
                      </div>
                    </div>

                    {team.isLeader && member.role !== 'leader' && (
                      <button
                        type="button"
                        onClick={() => setMemberToRemove(member.userId)}
                        className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                        title="Remove member"
                        aria-label={`Remove ${member.user?.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Leader Invite Member Input */}
            {team.isLeader && team.members.length < maxSize && (
              <form onSubmit={handleSendInvite} className="pt-2 border-t border-[#334155] flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                  <input
                    type="email"
                    placeholder="Teammate's email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="input w-full pl-9 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionBusy || !inviteEmail.trim()}
                  className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              </form>
            )}

            {/* Team Actions */}
            <div className="flex justify-end pt-2 border-t border-[#334155]">
              {team.isLeader ? (
                <button
                  type="button"
                  onClick={() => setConfirmDisband(true)}
                  className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disband Team
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" /> Leave Team
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Create or Join Controls */
        <div className="space-y-3">
          <div className="flex rounded-lg bg-secondary border border-[#334155] p-1">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                mode === 'create' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Create a Team
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                mode === 'join' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label htmlFor="create-team-name" className="block text-xs font-medium text-ink-muted mb-1">
                  Team Name
                </label>
                <input
                  id="create-team-name"
                  type="text"
                  placeholder="e.g. CyberVanguards"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={actionBusy || !teamName.trim()}
                className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Team
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinTeam} className="space-y-3">
              <div>
                <label htmlFor="join-invite-code" className="block text-xs font-medium text-ink-muted mb-1">
                  Team Invite Code
                </label>
                <input
                  id="join-invite-code"
                  type="text"
                  placeholder="e.g. TEAM-A1B2C3"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="input w-full text-xs font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={actionBusy || !inviteCode.trim()}
                className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Join Team
              </button>
            </form>
          )}
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        open={confirmDisband}
        title="Disband Team?"
        confirmLabel="Yes, disband"
        danger
        busy={actionBusy}
        onConfirm={handleDisbandTeam}
        onClose={() => setConfirmDisband(false)}
      >
        <p>
          Are you sure you want to disband <strong className="text-white">{team?.name}</strong>? All members will be removed and this action cannot be undone.
        </p>
      </ConfirmationModal>

      <ConfirmationModal
        open={confirmLeave}
        title="Leave Team?"
        confirmLabel="Yes, leave"
        danger
        busy={actionBusy}
        onConfirm={handleLeaveTeam}
        onClose={() => setConfirmLeave(false)}
      >
        <p>
          Are you sure you want to leave <strong className="text-white">{team?.name}</strong>?
        </p>
      </ConfirmationModal>

      <ConfirmationModal
        open={!!memberToRemove}
        title="Remove Member?"
        confirmLabel="Remove member"
        danger
        busy={actionBusy}
        onConfirm={handleRemoveMember}
        onClose={() => setMemberToRemove(null)}
      >
        <p>Are you sure you want to remove this member from the team?</p>
      </ConfirmationModal>
    </section>
  )
}
