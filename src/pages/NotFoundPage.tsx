import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState icon={Compass} title="Page not found" description="The page you’re looking for doesn’t exist or has moved." actionLabel="Back to Discover" actionTo="/" />
    </div>
  )
}
