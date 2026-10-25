import { useNavigate } from 'react-router-dom'
import { CreateEventForm } from '../components/forms/CreateEventForm'
import { emptyFormValues, formValuesToInput } from '../components/forms/eventFormModel'
import { DemoNote } from '../components/ui/DemoNote'
import { PageHeader } from '../components/ui/PageHeader'
import { useApp } from '../hooks/AppContext'
import { useToast } from '../hooks/ToastContext'
import { createEvent } from '../services'

import { isSupabaseConfigured } from '../lib/supabase'

export default function CreateEventPage() {
  const { localityId } = useApp()
  const { notify } = useToast()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Create event" subtitle="Tell people what’s happening, when and where." />
      <div className="mb-6">
        <DemoNote>
          {isSupabaseConfigured()
            ? 'Connected to database: events and drafts are persisted and linked to your authorized campus organization.'
            : 'Demo mode: new events are saved only in this browser (localStorage).'}
        </DemoNote>
      </div>
      <CreateEventForm
        initialValues={emptyFormValues(localityId)}
        onSubmit={async (values, status) => {
          try {
            await createEvent(formValuesToInput(values, status))
            notify(status === 'draft' ? 'Draft saved.' : 'Event published!')
            navigate('/organizer')
          } catch (e) {
            notify(e instanceof Error ? e.message : 'Could not save the event.', 'error')
          }
        }}
      />
    </div>
  )
}
