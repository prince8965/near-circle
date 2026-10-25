import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { AppNotification, NotificationType } from '../types'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import { readEvents, readNotifications, readRegistrations, writeNotifications } from './db'

/**
 * Notification Service
 *
 * Persists and delivers user notifications across event registrations, team invitations,
 * project submissions, judging assignments, and result announcements.
 *
 * Note on Email Notifications:
 * External email delivery (e.g., Resend, SendGrid, Amazon SES) must be executed server-side
 * via Supabase Edge Functions or backend webhooks. Secrets (such as RESEND_API_KEY) are never
 * exposed to the client. When an external email service is not configured or in local development,
 * notifications are persisted in the database and displayed via the in-app notification center.
 */

/**
 * Retrieves notifications for the target user (defaults to current session user).
 * Strict isolation: users can only view their own notifications unless admin.
 */
export async function getNotifications(userId?: string): Promise<AppNotification[]> {
  await delay(100)
  const sessionUser = authAdapter.getSession()
  const targetId = userId || sessionUser?.id

  if (!targetId) return []

  // Security check: non-admin users can only view their own notifications
  if (sessionUser && sessionUser.id !== targetId && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: You cannot access notifications belonging to another user.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          link: n.link || undefined,
          data: n.data || undefined,
          isRead: n.is_read,
          createdAt: n.created_at,
        }))
      }
    } catch {
      // Fallback to local store
    }
  }

  const all = readNotifications()
  return all
    .filter((n) => n.userId === targetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Gets the number of unread notifications for a user.
 */
export async function getUnreadNotificationCount(userId?: string): Promise<number> {
  const notifications = await getNotifications(userId)
  return notifications.filter((n) => !n.isRead).length
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) throw new Error('Unauthorized: Sign-in required.')

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', sessionUser.id)
    } catch {
      // Fallback
    }
  }

  const all = readNotifications()
  const target = all.find((n) => n.id === notificationId)
  if (target && target.userId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: You cannot update notifications for another user.')
  }

  writeNotifications(
    all.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
  )
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  const sessionUser = authAdapter.getSession()
  const targetId = userId || sessionUser?.id
  if (!targetId) throw new Error('Unauthorized: Sign-in required.')

  if (sessionUser && sessionUser.id !== targetId && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Cannot mark notifications as read for another user.')
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', targetId)
    } catch {
      // Fallback
    }
  }

  const all = readNotifications()
  writeNotifications(
    all.map((n) => (n.userId === targetId ? { ...n, isRead: true } : n)),
  )
}

/**
 * Creates and persists a notification. Includes deduplication within 5 minutes.
 */
export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  data?: Record<string, any>
}): Promise<AppNotification> {
  const all = readNotifications()
  const now = Date.now()

  // Prevent duplicate spam within 5 minutes (same user, type, and title)
  const isDuplicate = all.some(
    (n) =>
      n.userId === params.userId &&
      n.type === params.type &&
      n.title === params.title &&
      now - new Date(n.createdAt).getTime() < 5 * 60 * 1000,
  )

  if (isDuplicate) {
    const existing = all.find(
      (n) => n.userId === params.userId && n.type === params.type && n.title === params.title,
    )
    return existing!
  }

  const newNotification: AppNotification = {
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    userId: params.userId,
    type: params.type,
    title: params.title.trim(),
    message: params.message.trim(),
    link: params.link,
    data: params.data,
    isRead: false,
    createdAt: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('notifications').insert({
        id: newNotification.id,
        user_id: newNotification.userId,
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.message,
        link: newNotification.link,
        data: newNotification.data,
        is_read: false,
        created_at: newNotification.createdAt,
      })
    } catch {
      // Local fallback
    }
  }

  writeNotifications([newNotification, ...all])
  return newNotification
}

/**
 * Scans an event and sends deadline reminders to all confirmed registrants.
 */
export async function sendEventDeadlineReminders(eventId: string): Promise<number> {
  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event || !event.submissionDeadline) return 0

  const deadlineMs = new Date(event.submissionDeadline).getTime()
  const nowMs = Date.now()

  // Send reminder if deadline is within next 48 hours and hasn't passed
  if (deadlineMs <= nowMs || deadlineMs - nowMs > 48 * 3600 * 1000) {
    return 0
  }

  const registrations = readRegistrations().filter(
    (r) => r.eventId === eventId && (r.status === 'confirmed' || r.status === 'checked_in'),
  )

  let sentCount = 0
  for (const reg of registrations) {
    await createNotification({
      userId: reg.userId,
      type: 'deadline_reminder',
      title: `Submission Deadline Approaching: ${event.title}`,
      message: `The project submission deadline for ${event.title} is approaching on ${new Date(event.submissionDeadline).toLocaleDateString()}. Make sure to submit your project draft before submissions close!`,
      link: `/events/${event.id}/submit`,
      data: { eventId: event.id, deadline: event.submissionDeadline },
    })
    sentCount++
  }

  return sentCount
}
