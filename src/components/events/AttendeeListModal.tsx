import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import { useToast } from '../../hooks/ToastContext'
import { getEventAttendees, updateAttendeeStatus } from '../../services'
import type { EventRegistrationAttendee, EventWithMeta, RegistrationStatus } from '../../types'
import { formatDate } from '../../utils/format'

interface Props {
  open: boolean
  event: EventWithMeta | null
  onClose: () => void
}

export function AttendeeListModal({ open, event, onClose }: Props) {
  const { notify } = useToast()
  const [attendees, setAttendees] = useState<EventRegistrationAttendee[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [busyRegId, setBusyRegId] = useState<string | null>(null)

  const reloadAttendees = async () => {
    if (!event) return
    setLoading(true)
    try {
      const list = await getEventAttendees(event.id)
      setAttendees(list)
    } catch (err: any) {
      notify(err.message || 'Could not load attendees roster.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && event) {
      void reloadAttendees()
    }
  }, [open, event?.id])

  if (!open || !event) return null

  const handleToggleCheckIn = async (attendee: EventRegistrationAttendee) => {
    setBusyRegId(attendee.registrationId)
    const newStatus: RegistrationStatus =
      attendee.status === 'checked_in' ? 'confirmed' : 'checked_in'
    try {
      await updateAttendeeStatus(event.id, attendee.registrationId, newStatus)
      setAttendees((prev) =>
        prev.map((a) =>
          a.registrationId === attendee.registrationId ? { ...a, status: newStatus } : a,
        ),
      )
      notify(
        newStatus === 'checked_in'
          ? `Checked in ${attendee.userFullName}.`
          : `Reverted check-in for ${attendee.userFullName}.`,
      )
    } catch (err: any) {
      notify(err.message || 'Could not update attendee status.', 'error')
    } finally {
      setBusyRegId(null)
    }
  }

  const filtered = attendees.filter((a) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      a.userFullName.toLowerCase().includes(q) ||
      a.userEmail.toLowerCase().includes(q) ||
      a.ticketCode.toLowerCase().includes(q) ||
      (a.teamName && a.teamName.toLowerCase().includes(q))
    )
  })

  const checkedInCount = attendees.filter((a) => a.status === 'checked_in').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendees-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[#334155] bg-[#0B0F19] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#334155] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Users className="h-4 w-4" />
              <span>Organizer Attendee Roster</span>
            </div>
            <h2 id="attendees-modal-title" className="text-xl font-bold text-white mt-1">
              {event.title}
            </h2>
            <div className="flex items-center gap-4 text-xs text-ink-muted mt-2">
              <span>
                Total Registered: <strong className="text-white">{attendees.length}</strong>
              </span>
              <span>
                Checked In: <strong className="text-brand">{checkedInCount}</strong>
              </span>
              <span>
                Capacity: <strong className="text-white">{event.capacity || 'Unlimited'}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-elevated hover:text-white"
            aria-label="Close attendee roster modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by name, email, ticket code, or team..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input w-full pl-9 text-xs"
            />
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-y-auto min-h-[300px] mt-2 border border-[#334155] rounded-xl bg-[#0F172A]">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-brand" /> Loading attendee roster...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center p-4">
              <Users className="h-10 w-10 text-ink-muted mb-2" />
              <p className="text-sm font-semibold text-white">No attendees found</p>
              <p className="text-xs text-ink-muted mt-1">
                {query ? 'Try a different search term.' : 'No participants have registered for this event yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-ink-faint uppercase font-semibold sticky top-0 border-b border-[#334155]">
                <tr>
                  <th className="py-2.5 px-3">Participant</th>
                  <th className="py-2.5 px-3">Ticket Pass</th>
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Check-in Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {filtered.map((attendee) => (
                  <tr key={attendee.registrationId} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand font-bold text-xs">
                          {attendee.userFullName[0] ?? 'P'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{attendee.userFullName}</p>
                          <p className="text-[11px] text-ink-muted">{attendee.userEmail}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 font-mono text-white">
                        <Ticket className="h-3.5 w-3.5 text-brand" />
                        <span>{attendee.ticketCode}</span>
                      </div>
                      <p className="text-[10px] text-ink-faint">{formatDate(attendee.createdAt)}</p>
                    </td>

                    <td className="py-3 px-3">
                      {attendee.teamName ? (
                        <div>
                          <p className="font-semibold text-white">{attendee.teamName}</p>
                          <span className="text-[10px] text-brand">
                            {attendee.teamRole === 'leader' ? 'Leader' : 'Member'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-faint italic">Solo</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {attendee.status === 'checked_in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Checked In
                        </span>
                      ) : attendee.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-950/60 border border-sky-500/40 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                          <Clock className="h-3 w-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="capitalize text-ink-muted">{attendee.status}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={busyRegId === attendee.registrationId}
                        onClick={() => handleToggleCheckIn(attendee)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                          attendee.status === 'checked_in'
                            ? 'bg-secondary text-ink-muted hover:text-white border border-[#334155]'
                            : 'btn-primary py-1 px-2.5 text-xs'
                        }`}
                      >
                        {busyRegId === attendee.registrationId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : attendee.status === 'checked_in' ? (
                          'Undo Check-In'
                        ) : (
                          <>
                            <Check className="h-3 w-3" /> Check In
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-[#334155] mt-4">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs">
            Close Roster
          </button>
        </div>
      </div>
    </div>
  )
}
