import { useNavigate, useParams } from 'react-router-dom'
import { CalendarX2 } from 'lucide-react'
import { CreateEventForm } from '../components/forms/CreateEventForm'
import { eventToFormValues, formValuesToInput } from '../components/forms/eventFormModel'
import { DemoNote } from '../components/ui/DemoNote'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { getEventById, updateEvent } from '../services'

import { isSupabaseConfigured } from '../lib/supabase'

export default function EditEventPage() {
  const { id = '' } = useParams()
  const { notify } = useToast()
  const navigate = useNavigate()
  const { data: event, loading, error, reload } = useAsync(() => getEventById(id), [id])

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 px-4 py-8" role="status" aria-label="Loading event"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  if (error) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState message={error} onRetry={reload} /></div>
  if (!event || event.status === 'cancelled')
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={CalendarX2}
          title={event ? 'Cancelled events can’t be edited' : 'Event not found'}
          description="Return to your dashboard to manage other events."
          actionLabel="Back to dashboard"
          actionTo="/organizer"
        />
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Edit event" subtitle={event.title} />
      <div className="mb-6">
        <DemoNote>
          {isSupabaseConfigured()
            ? 'Connected to database: updates are saved and verified against database authorization policies.'
            : 'Demo mode: changes are saved in this browser.'}
        </DemoNote>
      </div>
      <CreateEventForm
        isEditing
        initialValues={eventToFormValues(event)}
        onSubmit={async (values, status) => {
          try {
            await updateEvent(event.id, formValuesToInput(values, status))
            notify(status === 'draft' ? 'Saved as draft.' : 'Changes saved.')
            navigate('/organizer')
          } catch (e) {
            notify(e instanceof Error ? e.message : 'Could not save changes.', 'error')
          }
        }}
      />
    </div>
  )
}
