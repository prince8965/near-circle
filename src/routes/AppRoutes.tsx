import { Route, Routes } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import AuthPage from '../pages/AuthPage'
import CommunitiesPage from '../pages/CommunitiesPage'
import CommunityDetailPage from '../pages/CommunityDetailPage'
import CommunityPage from '../pages/CommunityPage'
import CreateEventPage from '../pages/CreateEventPage'
import DiscoverPage from '../pages/DiscoverPage'
import EditEventPage from '../pages/EditEventPage'
import EventDetailsPage from '../pages/EventDetailsPage'
import MyEventsPage from '../pages/MyEventsPage'
import NotFoundPage from '../pages/NotFoundPage'
import OrganizerDashboardPage from '../pages/OrganizerDashboardPage'
import OrganizationProfilePage from '../pages/OrganizationProfilePage'
import PosterToEventPage from '../pages/PosterToEventPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import ProjectSubmissionPage from '../pages/ProjectSubmissionPage'
import JudgeDashboardPage from '../pages/JudgeDashboardPage'
import AdminDashboardPage from '../pages/AdminDashboardPage'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<DiscoverPage />} />
        <Route path="events/:id" element={<EventDetailsPage />} />
        <Route path="organizations/:id" element={<OrganizationProfilePage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />

        {/* Participant-Protected Routes (Requires Authenticated User) */}
        <Route element={<ProtectedRoute />}>
          <Route path="community" element={<CommunityPage />} />
          <Route path="community/org/:id" element={<CommunityPage />} />
          <Route path="communities" element={<CommunitiesPage />} />
          <Route path="communities/:id" element={<CommunityDetailPage />} />
          <Route path="my-events" element={<MyEventsPage />} />
          <Route path="events/:id/submit" element={<ProjectSubmissionPage />} />
        </Route>

        {/* Judge / Organizer Evaluation Portal */}
        <Route element={<RoleGuard allowedRoles={['judge', 'organizer', 'admin']} />}>
          <Route path="judge" element={<JudgeDashboardPage />} />
        </Route>

        {/* Organizer-Protected Routes (Requires 'organizer' or 'admin' role) */}
        <Route element={<RoleGuard allowedRoles={['organizer', 'admin']} />}>
          <Route path="organizer" element={<OrganizerDashboardPage />} />
          <Route path="organizer/create" element={<CreateEventPage />} />
          <Route path="organizer/edit/:id" element={<EditEventPage />} />
          <Route path="organizer/poster" element={<PosterToEventPage />} />
        </Route>

        {/* Administrator Portal */}
        <Route element={<RoleGuard allowedRoles={['admin']} />}>
          <Route path="admin" element={<AdminDashboardPage />} />
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
