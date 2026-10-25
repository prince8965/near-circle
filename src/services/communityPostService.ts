import { SEED_COMMUNITIES } from '../data/communities'
import type {
  Category,
  CommunityPost,
  CommunityPostInput,
  CommunityTab,
  Organization,
  PostComment,
  PostReport,
  PostSortKey,
} from '../types'
import { DEMO_OWNER_ID, authAdapter } from './authAdapter'
import { delay } from './bus'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  readCommunityPosts,
  readEvents,
  readFollowedIds,
  readFollowedOrgIds,
  readOrganizations,
  readPostComments,
  readPostLikes,
  readPostReports,
  writeCommunityPosts,
  writeFollowedOrgIds,
  writeOrganizations,
  writePostComments,
  writePostLikes,
  writePostReports,
} from './db'

export interface CommunityFeedOptions {
  tab?: CommunityTab
  category?: Category | 'all'
  query?: string
  sort?: PostSortKey
  localityId?: string
  interests?: Category[]
  organizationId?: string
}

export function getCurrentUserId(): string {
  const session = authAdapter.getSession()
  return session?.id ?? DEMO_OWNER_ID
}

/**
 * Enriches post with live like states, comments count, and author permissions.
 */
function enrichPost(
  post: CommunityPost,
  likesMap: Record<string, string[]>,
  commentCounts: Record<string, number>,
  currentUserId: string,
): CommunityPost {
  const likedUsers = likesMap[post.id] ?? []
  const likedByMe = likedUsers.includes(currentUserId)
  const actualLikesCount = Math.max(post.likesCount, likedUsers.length)
  const actualCommentsCount = commentCounts[post.id] ?? post.commentsCount

  return {
    ...post,
    likedByMe,
    likesCount: actualLikesCount,
    commentsCount: actualCommentsCount,
  }
}

/** Backend equivalent: GET /community/posts */
export async function getCommunityPosts(options: CommunityFeedOptions): Promise<CommunityPost[]> {
  await delay(250)
  const currentUserId = getCurrentUserId()
  const posts = readCommunityPosts()
  const likesMap = readPostLikes()
  const comments = readPostComments()
  const followedCommunityIds = new Set(readFollowedIds())
  const followedOrgIds = new Set(readFollowedOrgIds())

  // Aggregate comment counts by post
  const commentCounts: Record<string, number> = {}
  for (const c of comments) {
    commentCounts[c.postId] = (commentCounts[c.postId] ?? 0) + 1
  }

  // Enrich posts
  let enriched = posts.map((p) => enrichPost(p, likesMap, commentCounts, currentUserId))

  // 1. Tab filter
  switch (options.tab) {
    case 'following':
      enriched = enriched.filter(
        (p) =>
          (p.communityId && followedCommunityIds.has(p.communityId)) ||
          (p.organizationId && followedOrgIds.has(p.organizationId)) ||
          p.authorId === currentUserId,
      )
      break
    case 'nearby':
      enriched = enriched.filter((p) => p.localityId === options.localityId)
      break
    case 'organizations':
      enriched = enriched.filter((p) => Boolean(p.organizationId))
      break
    case 'my-posts':
      enriched = enriched.filter((p) => p.authorId === currentUserId)
      break
    case 'for-you':
    default:
      // In 'for-you', we show all active posts, with soft prioritization applied during sort
      break
  }

  // 2. Category filter
  if (options.category && options.category !== 'all') {
    enriched = enriched.filter((p) => p.category === options.category)
  }

  // 2.5 Organization filter
  if (options.organizationId) {
    enriched = enriched.filter((p) => p.organizationId === options.organizationId)
  }

  // 3. Search query filter (search content, author, community, organization)
  if (options.query && options.query.trim()) {
    const q = options.query.trim().toLowerCase()
    enriched = enriched.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        (p.communityName && p.communityName.toLowerCase().includes(q)) ||
        (p.organizationName && p.organizationName.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.eventMeta && p.eventMeta.title.toLowerCase().includes(q)),
    )
  }

  // 4. Sort
  if (options.sort === 'popular') {
    enriched.sort((a, b) => {
      const scoreA = a.likesCount * 2 + a.commentsCount * 3
      const scoreB = b.likesCount * 2 + b.commentsCount * 3
      return scoreB - scoreA
    })
  } else {
    // Newest first
    enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  return enriched
}

/** Backend equivalent: GET /community/posts/:id */
export async function getPostById(id: string): Promise<CommunityPost | null> {
  await delay(150)
  const currentUserId = getCurrentUserId()
  const post = readCommunityPosts().find((p) => p.id === id)
  if (!post) return null

  const likesMap = readPostLikes()
  const comments = readPostComments()
  const commentCount = comments.filter((c) => c.postId === id).length

  return enrichPost(post, likesMap, { [id]: commentCount }, currentUserId)
}

/** Backend equivalent: POST /community/posts */
export async function createPost(input: CommunityPostInput): Promise<CommunityPost> {
  await delay(400)
  const session = authAdapter.getSession()
  const currentUserId = session?.id ?? DEMO_OWNER_ID
  const currentUserName = session?.name ?? 'You (demo organizer)'

  if (!input.content.trim()) {
    throw new Error('Post content cannot be empty.')
  }

  // Lookup community name if attached
  let communityName: string | undefined
  if (input.communityId) {
    const comm = SEED_COMMUNITIES.find((c) => c.id === input.communityId)
    communityName = comm?.name
  }

  // Lookup organization if attached
  let organizationName: string | undefined
  let isOrgVerified: boolean | undefined
  if (input.organizationId) {
    const org = readOrganizations().find((o) => o.id === input.organizationId)
    organizationName = org?.name
    isOrgVerified = org?.isVerified
  }

  // Lookup existing NearCircle event if linked
  let eventMeta: CommunityPost['eventMeta']
  if (input.eventId) {
    const event = readEvents().find((e) => e.id === input.eventId)
    if (event) {
      eventMeta = {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venueName: event.venueName,
        price: event.price,
        posterUrl: event.posterUrl,
      }
    }
  }

  const newPost: CommunityPost = {
    id: `post-${Date.now().toString(36)}`,
    authorId: currentUserId,
    authorName: currentUserName,
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authorRole: session ? 'organizer' : 'student',
    createdAt: new Date().toISOString(),
    content: input.content.trim(),
    category: input.category,
    imageUrl: input.imageUrl,
    communityId: input.communityId,
    communityName,
    organizationId: input.organizationId,
    organizationName,
    isOrgVerified,
    eventId: input.eventId,
    eventMeta,
    localityId: input.localityId,
    customEventDate: input.customEventDate,
    customEventLocation: input.customEventLocation,
    customEventLink: input.customEventLink,
    likesCount: 0,
    likedByMe: false,
    commentsCount: 0,
    isDemo: false,
  }

  const posts = readCommunityPosts()
  writeCommunityPosts([newPost, ...posts])
  return newPost
}

/** Backend equivalent: PATCH /community/posts/:id */
export async function updatePost(id: string, input: Partial<CommunityPostInput>): Promise<CommunityPost> {
  await delay(350)
  const currentUserId = getCurrentUserId()
  const posts = readCommunityPosts()
  const index = posts.findIndex((p) => p.id === id)
  if (index === -1) throw new Error('Post not found.')

  const target = posts[index]
  // Authorization check
  if (target.authorId !== currentUserId) {
    throw new Error('Unauthorized: You can only edit your own posts.')
  }

  if (input.content !== undefined && !input.content.trim()) {
    throw new Error('Post content cannot be empty.')
  }

  // Lookup community name if community changed
  let communityName = target.communityName
  if (input.communityId !== undefined) {
    const comm = SEED_COMMUNITIES.find((c) => c.id === input.communityId)
    communityName = comm?.name
  }

  // Lookup organization if organization changed
  let organizationName = target.organizationName
  let isOrgVerified = target.isOrgVerified
  if (input.organizationId !== undefined) {
    const org = readOrganizations().find((o) => o.id === input.organizationId)
    organizationName = org?.name
    isOrgVerified = org?.isVerified
  }

  // Lookup eventMeta if event changed
  let eventMeta = target.eventMeta
  if (input.eventId !== undefined) {
    if (input.eventId) {
      const event = readEvents().find((e) => e.id === input.eventId)
      if (event) {
        eventMeta = {
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          price: event.price,
          posterUrl: event.posterUrl,
        }
      }
    } else {
      eventMeta = undefined
    }
  }

  const updated: CommunityPost = {
    ...target,
    content: input.content !== undefined ? input.content.trim() : target.content,
    category: input.category ?? target.category,
    imageUrl: input.imageUrl !== undefined ? input.imageUrl : target.imageUrl,
    communityId: input.communityId !== undefined ? input.communityId : target.communityId,
    communityName,
    organizationId: input.organizationId !== undefined ? input.organizationId : target.organizationId,
    organizationName,
    isOrgVerified,
    eventId: input.eventId !== undefined ? input.eventId : target.eventId,
    eventMeta,
    localityId: input.localityId !== undefined ? input.localityId : target.localityId,
    customEventDate: input.customEventDate !== undefined ? input.customEventDate : target.customEventDate,
    customEventLocation: input.customEventLocation !== undefined ? input.customEventLocation : target.customEventLocation,
    customEventLink: input.customEventLink !== undefined ? input.customEventLink : target.customEventLink,
    updatedAt: new Date().toISOString(),
  }

  posts[index] = updated
  writeCommunityPosts(posts)
  return updated
}

/** Backend equivalent: DELETE /community/posts/:id */
export async function deletePost(id: string): Promise<void> {
  await delay(300)
  const currentUserId = getCurrentUserId()
  const posts = readCommunityPosts()
  const target = posts.find((p) => p.id === id)
  if (!target) throw new Error('Post not found.')

  // Authorization check
  if (target.authorId !== currentUserId) {
    throw new Error('Unauthorized: You can only delete your own posts.')
  }

  // Remove post
  writeCommunityPosts(posts.filter((p) => p.id !== id))

  // Clean up associated likes
  const likesMap = readPostLikes()
  delete likesMap[id]
  writePostLikes(likesMap)

  // Clean up associated comments
  const comments = readPostComments()
  writePostComments(comments.filter((c) => c.postId !== id))
}

/** Backend equivalent: POST /community/posts/:id/like */
export async function togglePostLike(postId: string): Promise<{ liked: boolean; count: number }> {
  await delay(150)
  const currentUserId = getCurrentUserId()
  const likesMap = readPostLikes()
  const userLikes = likesMap[postId] ?? []
  const hasLiked = userLikes.includes(currentUserId)

  let nextUsers: string[]
  if (hasLiked) {
    nextUsers = userLikes.filter((uid) => uid !== currentUserId)
  } else {
    nextUsers = [...userLikes, currentUserId]
  }

  likesMap[postId] = nextUsers
  writePostLikes(likesMap)

  // Update post's stored likesCount
  const posts = readCommunityPosts()
  const post = posts.find((p) => p.id === postId)
  if (post) {
    const delta = hasLiked ? -1 : 1
    post.likesCount = Math.max(0, post.likesCount + delta)
    writeCommunityPosts(posts)
  }

  return { liked: !hasLiked, count: nextUsers.length }
}

/** Backend equivalent: GET /community/posts/:id/comments */
export async function getPostComments(postId: string): Promise<PostComment[]> {
  await delay(200)
  const all = readPostComments()
  return all
    .filter((c) => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/** Backend equivalent: POST /community/posts/:id/comments */
export async function createPostComment(
  postId: string,
  content: string,
  parentId?: string,
  replyToAuthor?: string,
): Promise<PostComment> {
  await delay(300)
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Comment cannot be empty.')

  const session = authAdapter.getSession()
  const currentUserId = session?.id ?? DEMO_OWNER_ID
  const currentUserName = session?.name ?? 'You (demo student)'

  const newComment: PostComment = {
    id: `comm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    postId,
    authorId: currentUserId,
    authorName: currentUserName,
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authorRole: session ? 'organizer' : 'student',
    content: trimmed,
    createdAt: new Date().toISOString(),
    parentId,
    replyToAuthor,
  }

  const comments = readPostComments()
  writePostComments([...comments, newComment])

  // Update post comment count
  const posts = readCommunityPosts()
  const post = posts.find((p) => p.id === postId)
  if (post) {
    post.commentsCount = (post.commentsCount || 0) + 1
    writeCommunityPosts(posts)
  }

  return newComment
}

/** Backend equivalent: DELETE /community/comments/:id */
export async function deletePostComment(commentId: string): Promise<void> {
  await delay(250)
  const currentUserId = getCurrentUserId()
  const comments = readPostComments()
  const comment = comments.find((c) => c.id === commentId)
  if (!comment) return

  // Authorization check: comment author can delete
  if (comment.authorId !== currentUserId) {
    throw new Error('Unauthorized: You can only delete your own comments.')
  }

  // Remove this comment and any nested replies to it
  const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId)
  writePostComments(filtered)

  // Update post comment count
  const posts = readCommunityPosts()
  const post = posts.find((p) => p.id === comment.postId)
  if (post) {
    const remainingForPost = filtered.filter((c) => c.postId === comment.postId).length
    post.commentsCount = remainingForPost
    writeCommunityPosts(posts)
  }
}

/** Backend equivalent: POST /community/posts/:id/report */
export async function reportPost(postId: string, reason: string, details?: string): Promise<void> {
  await delay(250)
  const currentUserId = getCurrentUserId()
  const reports = readPostReports()

  const newReport: PostReport = {
    id: `rep-${Date.now().toString(36)}`,
    postId,
    userId: currentUserId,
    reason,
    details: details?.trim(),
    createdAt: new Date().toISOString(),
  }

  writePostReports([...reports, newReport])

  // Mark post as reported
  const posts = readCommunityPosts()
  const post = posts.find((p) => p.id === postId)
  if (post) {
    post.isReported = true
    post.reportReason = reason
    writeCommunityPosts(posts)
  }
}

/* ==========================================================================
   Organizations
   ========================================================================== */

export function mapDbOrgToOrganization(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url || undefined,
    accentColor: row.accent_color || '#00F2FE',
    description: row.description || '',
    category: row.category as Category,
    localityId: row.locality_id || 'loc-koramangala',
    websiteUrl: row.website_url || undefined,
    contactEmail: row.contact_email || undefined,
    isVerified: Boolean(row.is_verified),
    followerCount: Number(row.follower_count) || 0,
    ownerId: row.owner_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Backend equivalent: GET /organizations */
export async function getOrganizations(): Promise<Organization[]> {
  await delay(200)
  const followed = new Set(readFollowedOrgIds())

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('follower_count', { ascending: false })

      if (!error && data && data.length > 0) {
        return data.map((row) => ({
          ...mapDbOrgToOrganization(row),
          isFollowing: followed.has(row.id),
        }))
      }
    } catch (err) {
      console.warn('Could not load organizations from Supabase, falling back to local:', err)
    }
  }

  const orgs = readOrganizations()
  return orgs.map((o) => ({
    ...o,
    isFollowing: followed.has(o.id),
  }))
}

/** Backend equivalent: GET /organizations/:id */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  await delay(150)
  const followed = new Set(readFollowedOrgIds())

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        return {
          ...mapDbOrgToOrganization(data),
          isFollowing: followed.has(data.id),
        }
      }
    } catch (err) {
      console.warn('Could not load organization by ID from Supabase:', err)
    }
  }

  const org = readOrganizations().find((o) => o.id === id)
  if (!org) return null
  return {
    ...org,
    isFollowing: followed.has(org.id),
  }
}

/** Backend equivalent: GET /organizations/owner/:ownerId */
export async function getOrganizationByOwnerId(ownerId: string): Promise<Organization | null> {
  await delay(150)
  const followed = new Set(readFollowedOrgIds())

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle()

      if (!error && data) {
        return {
          ...mapDbOrgToOrganization(data),
          isFollowing: followed.has(data.id),
        }
      }
    } catch (err) {
      console.warn('Could not load organization by ownerId from Supabase:', err)
    }
  }

  const org = readOrganizations().find((o) => o.ownerId === ownerId)
  if (!org) return null
  return {
    ...org,
    isFollowing: followed.has(org.id),
  }
}

/**
 * Creates a new organization for an organizer.
 */
export async function createOrganization(input: {
  name: string
  description: string
  category: Category
  localityId: string
  websiteUrl?: string
  contactEmail?: string
  logoUrl?: string
  accentColor?: string
}): Promise<Organization> {
  await delay(300)
  const session = authAdapter.getSession()
  if (!session) throw new Error('You must be signed in to create an organization profile.')
  if (session.role !== 'organizer' && session.role !== 'admin') {
    throw new Error('Forbidden: Only organizers can create organization profiles.')
  }

  const cleanName = input.name.trim()
  if (!cleanName) throw new Error('Organization name is required.')
  const slug = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${session.id.slice(0, 5)}`

  if (isSupabaseConfigured()) {
    const payload = {
      name: cleanName,
      slug,
      owner_id: session.id,
      description: input.description.trim() || `${cleanName} on NearCircle.`,
      category: input.category,
      locality_id: input.localityId || 'loc-koramangala',
      website_url: input.websiteUrl?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      logo_url: input.logoUrl?.trim() || null,
      accent_color: input.accentColor || '#00F2FE',
      is_verified: false, // Verification cannot be self-assigned
      follower_count: 0,
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to create organization: ${error.message}`)
    }

    const created = mapDbOrgToOrganization(data)
    writeOrganizations([created, ...readOrganizations()])
    return created
  }

  const localOrg: Organization = {
    id: `org-${Date.now().toString(36)}`,
    name: cleanName,
    slug,
    ownerId: session.id,
    description: input.description.trim() || `${cleanName} on NearCircle.`,
    category: input.category,
    localityId: input.localityId || 'loc-koramangala',
    websiteUrl: input.websiteUrl?.trim(),
    contactEmail: input.contactEmail?.trim(),
    logoUrl: input.logoUrl?.trim(),
    accentColor: input.accentColor || '#00F2FE',
    isVerified: false,
    followerCount: 0,
  }

  writeOrganizations([localOrg, ...readOrganizations()])
  return localOrg
}

/**
 * Updates an organization profile.
 * Only authorized organization owners can edit their organization profile.
 * Verification status is strictly protected and cannot be self-modified.
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>,
): Promise<Organization> {
  await delay(300)
  const session = authAdapter.getSession()
  if (!session) throw new Error('You must be signed in to edit your organization profile.')

  // Verification status must only be changed through an authorized verification workflow, never by organizer self-edit
  const { isVerified: _ignoredVerified, ...permittedUpdates } = updates
  void _ignoredVerified

  if (isSupabaseConfigured()) {
    // 1. Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('organizations')
      .select('owner_id, is_verified')
      .eq('id', orgId)
      .maybeSingle()

    if (fetchErr || !existing) {
      throw new Error('Organization not found.')
    }

    if (existing.owner_id !== session.id && session.role !== 'admin') {
      throw new Error('Unauthorized: You can only edit organizations that you own.')
    }

    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (permittedUpdates.name !== undefined) dbPayload.name = permittedUpdates.name.trim()
    if (permittedUpdates.description !== undefined) dbPayload.description = permittedUpdates.description.trim()
    if (permittedUpdates.category !== undefined) dbPayload.category = permittedUpdates.category
    if (permittedUpdates.localityId !== undefined) dbPayload.locality_id = permittedUpdates.localityId
    if (permittedUpdates.websiteUrl !== undefined) dbPayload.website_url = permittedUpdates.websiteUrl?.trim() || null
    if (permittedUpdates.contactEmail !== undefined) dbPayload.contact_email = permittedUpdates.contactEmail?.trim() || null
    if (permittedUpdates.logoUrl !== undefined) dbPayload.logo_url = permittedUpdates.logoUrl?.trim() || null
    if (permittedUpdates.accentColor !== undefined) dbPayload.accent_color = permittedUpdates.accentColor

    const { data, error } = await supabase
      .from('organizations')
      .update(dbPayload)
      .eq('id', orgId)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to update organization: ${error.message}`)
    }

    const updated = mapDbOrgToOrganization(data)
    // Synchronize local cache
    const local = readOrganizations()
    const idx = local.findIndex((o) => o.id === orgId)
    if (idx !== -1) {
      local[idx] = updated
      writeOrganizations(local)
    }
    return updated
  }

  // Local fallback
  const local = readOrganizations()
  const idx = local.findIndex((o) => o.id === orgId)
  if (idx === -1) throw new Error('Organization not found.')

  if (local[idx].ownerId && local[idx].ownerId !== session.id && session.role !== 'admin') {
    throw new Error('Unauthorized: You can only edit organizations that you own.')
  }

  const updated: Organization = {
    ...local[idx],
    ...permittedUpdates,
    isVerified: local[idx].isVerified, // Preserve verified state
    updatedAt: new Date().toISOString(),
  }
  local[idx] = updated
  writeOrganizations(local)
  return updated
}

/** Backend equivalent: POST /organizations/:id/follow */
export async function followOrganization(orgId: string): Promise<void> {
  await delay(200)
  const followed = readFollowedOrgIds()
  if (!followed.includes(orgId)) {
    writeFollowedOrgIds([...followed, orgId])

    // Update follower count on org
    const orgs = readOrganizations()
    const target = orgs.find((o) => o.id === orgId)
    if (target) {
      target.followerCount += 1
      writeOrganizations(orgs)
    }
  }
}

/** Backend equivalent: DELETE /organizations/:id/follow */
export async function unfollowOrganization(orgId: string): Promise<void> {
  await delay(200)
  const followed = readFollowedOrgIds()
  if (followed.includes(orgId)) {
    writeFollowedOrgIds(followed.filter((id) => id !== orgId))

    // Update follower count on org
    const orgs = readOrganizations()
    const target = orgs.find((o) => o.id === orgId)
    if (target) {
      target.followerCount = Math.max(0, target.followerCount - 1)
      writeOrganizations(orgs)
    }
  }
}
