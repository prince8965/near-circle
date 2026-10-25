import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  CornerDownRight,
  Edit2,
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  MessageSquare,
  MoreVertical,
  Send,
  Share2,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { CategoryChip } from '../ui/CategoryChip'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { getLocality } from '../../data/localities'
import { useToast } from '../../hooks/ToastContext'
import {
  createPostComment,
  deletePost,
  deletePostComment,
  getCurrentUserId,
  getPostComments,
  togglePostLike,
} from '../../services'
import type { CommunityPost, PostComment } from '../../types'
import { formatLongDate, formatPrice, formatRelativeTime, formatTime } from '../../utils/format'
import { EditPostModal } from './EditPostModal'
import { ReportPostModal } from './ReportPostModal'

interface Props {
  post: CommunityPost
  onPostUpdated?: () => void
  onOpenOrgProfile?: (orgId: string) => void
  isHighlighted?: boolean
}

export function CommunityPostCard({
  post,
  onPostUpdated,
  onOpenOrgProfile,
  isHighlighted = false,
}: Props) {
  const { notify } = useToast()
  const currentUserId = getCurrentUserId()
  const isAuthor = post.authorId === currentUserId

  // Local state for instant interactive feedback
  const [liked, setLiked] = useState(Boolean(post.likedByMe))
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Modals & Menu
  const [showMenu, setShowMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)

  // Sync props when post changes
  useEffect(() => {
    setLiked(Boolean(post.likedByMe))
    setLikesCount(post.likesCount)
    setCommentsCount(post.commentsCount)
  }, [post.likedByMe, post.likesCount, post.commentsCount])

  // Load comments when drawer is opened
  useEffect(() => {
    if (!showComments) return
    let active = true
    setCommentsLoading(true)
    getPostComments(post.id)
      .then((res) => {
        if (active) setComments(res)
      })
      .finally(() => {
        if (active) setCommentsLoading(false)
      })
    return () => {
      active = false
    }
  }, [showComments, post.id])

  // Handle Like Toggle
  const handleToggleLike = async () => {
    // Optimistic UI update
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)))

    try {
      const res = await togglePostLike(post.id)
      setLiked(res.liked)
      setLikesCount(res.count)
    } catch {
      // Revert on failure
      setLiked(!nextLiked)
      setLikesCount((prev) => (!nextLiked ? prev + 1 : Math.max(0, prev - 1)))
      notify('Could not update like.', 'error')
    }
  }

  // Handle Share Post
  const handleShare = async () => {
    const url = `${window.location.origin}/community?postId=${post.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.authorName} on NearCircle`,
          text: post.content.slice(0, 100),
          url,
        })
        notify('Shared successfully!', 'success')
        return
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      notify('Link copied to clipboard! Anyone with this link can view this post.', 'success')
    } catch {
      notify(`Share link: ${url}`, 'info')
    }
  }

  // Handle Delete Post
  const handleDeletePost = async () => {
    setDeletingPost(true)
    try {
      await deletePost(post.id)
      notify('Post deleted.', 'info')
      setShowDeleteModal(false)
      onPostUpdated?.()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete post.', 'error')
    } finally {
      setDeletingPost(false)
    }
  }

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return

    setSubmittingComment(true)
    try {
      const newComment = await createPostComment(
        post.id,
        commentInput.trim(),
        replyingTo?.id,
        replyingTo?.authorName,
      )
      setComments((prev) => [...prev, newComment])
      setCommentsCount((prev) => prev + 1)
      setCommentInput('')
      setReplyingTo(null)
      notify('Comment posted!', 'success')
      onPostUpdated?.()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to post comment.', 'error')
    } finally {
      setSubmittingComment(false)
    }
  }

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await deletePostComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId))
      setCommentsCount((prev) => Math.max(0, prev - 1))
      notify('Comment removed.', 'info')
      onPostUpdated?.()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove comment.', 'error')
    }
  }

  const locality = post.localityId ? getLocality(post.localityId) : null

  // Role display
  const roleLabel =
    post.authorRole === 'community_lead'
      ? 'Community Lead'
      : post.authorRole === 'organizer'
      ? 'Event Organizer'
      : 'Student'

  return (
    <article
      id={`post-${post.id}`}
      className={`card relative overflow-hidden transition-all duration-200 ${
        isHighlighted
          ? 'ring-2 ring-brand shadow-[0_0_25px_rgba(0,242,254,0.3)]'
          : 'hover:border-[#475569]'
      }`}
    >
      {/* Post Reported Banner */}
      {post.isReported && (
        <div className="flex items-center gap-2 bg-amber-950/40 px-4 py-2 text-xs text-amber-300 border-b border-amber-900/40">
          <Flag className="h-3.5 w-3.5" />
          <span>This post has been reported for review by community members.</span>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-4">
        {/* Author Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="relative">
              {post.authorAvatar ? (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="h-11 w-11 rounded-full object-cover border border-[#334155]"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/20 text-brand font-bold text-sm border border-brand/30">
                  {post.authorName.charAt(0)}
                </div>
              )}
            </div>

            {/* Author details */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm hover:underline cursor-pointer">
                  {post.authorName}
                </span>

                {/* Role badge */}
                <span className="rounded-full bg-[#0F172A] border border-[#334155] px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                  {roleLabel}
                </span>

                {/* Organization badge with verified badge */}
                {post.organizationName && (
                  <button
                    type="button"
                    onClick={() => post.organizationId && onOpenOrgProfile?.(post.organizationId)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20 transition"
                  >
                    <span>{post.organizationName}</span>
                    {post.isOrgVerified && (
                      <CheckCircle2 className="h-3 w-3 fill-brand text-[#0B0F19]" />
                    )}
                  </button>
                )}
              </div>

              {/* Sub-meta: timestamp, community, locality */}
              <div className="flex items-center gap-2 text-xs text-ink-muted flex-wrap">
                <span title={formatLongDate(post.createdAt)}>
                  {formatRelativeTime(post.createdAt)}
                </span>

                {post.communityName && (
                  <>
                    <span>•</span>
                    <Link
                      to={post.communityId ? `/communities/${post.communityId}` : '#'}
                      className="text-brand hover:underline"
                    >
                      {post.communityName}
                    </Link>
                  </>
                )}

                {locality && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 text-ink-faint" />
                      {locality.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Category chip + Menu */}
          <div className="flex items-center gap-2">
            <CategoryChip category={post.category} size="sm" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-[#334155] hover:text-white"
                aria-label="Post options"
                aria-expanded={showMenu}
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-[#334155] bg-secondary p-1 shadow-lift">
                    {isAuthor && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false)
                            setShowEditModal(true)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-[#334155] hover:text-white"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit Post
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false)
                            setShowDeleteModal(true)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Post
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false)
                        handleShare()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-[#334155] hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share Post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false)
                        setShowReportModal(true)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-[#334155] hover:text-rose-400"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Report Post
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Text Content */}
        <p className="whitespace-pre-line text-sm leading-relaxed text-white">
          {post.content}
        </p>

        {/* Image / Poster upload preview */}
        {post.imageUrl && (
          <div className="overflow-hidden rounded-xl border border-[#334155] bg-canvas">
            <img
              src={post.imageUrl}
              alt="Community post attachment"
              className="max-h-96 w-full object-contain bg-[#070A12]"
              loading="lazy"
            />
          </div>
        )}

        {/* Linked Existing NearCircle Event Preview Card */}
        {post.eventMeta && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-brand/30 bg-[#0F172A]/80 p-4 shadow-sm hover:border-brand/60 transition">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                  Linked NearCircle Event
                </span>
                <h4 className="font-bold text-white text-sm line-clamp-1">
                  {post.eventMeta.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-brand" />
                    {formatLongDate(post.eventMeta.startsAt)} at {formatTime(post.eventMeta.startsAt)}
                  </span>
                  <span>•</span>
                  <span>{post.eventMeta.venueName}</span>
                  <span>•</span>
                  <span className="font-semibold text-brand">{formatPrice(post.eventMeta.price)}</span>
                </div>
              </div>
            </div>

            <Link
              to={`/events/${post.eventMeta.id}`}
              className="btn-primary shrink-0 text-xs px-3.5 py-2 font-bold w-full sm:w-auto text-center"
            >
              View Event &amp; RSVP →
            </Link>
          </div>
        )}

        {/* Custom Event Details (if manual) */}
        {!post.eventMeta && (post.customEventDate || post.customEventLocation || post.customEventLink) && (
          <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 p-3 text-xs text-ink-muted flex flex-wrap items-center gap-3">
            {post.customEventDate && (
              <span className="flex items-center gap-1 text-white font-medium">
                <Calendar className="h-3.5 w-3.5 text-brand" />
                {post.customEventDate}
              </span>
            )}
            {post.customEventLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                {post.customEventLocation}
              </span>
            )}
            {post.customEventLink && (
              <a
                href={post.customEventLink}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-brand hover:underline font-medium"
              >
                Event Link <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Interactive Action Bar (Like, Comment, Share) */}
        <div className="flex items-center justify-between border-t border-[#334155]/60 pt-3">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Like button */}
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                liked
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'text-ink-muted hover:bg-secondary hover:text-white'
              }`}
              aria-label={liked ? 'Unlike post' : 'Like post'}
            >
              <Heart
                className={`h-4 w-4 transition-transform ${
                  liked ? 'fill-rose-400 text-rose-400 scale-110' : ''
                }`}
              />
              <span>{likesCount}</span>
            </button>

            {/* Comment button */}
            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                showComments
                  ? 'bg-brand/10 text-brand border border-brand/30'
                  : 'text-ink-muted hover:bg-secondary hover:text-white'
              }`}
              aria-label="View comments"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{commentsCount}</span>
            </button>
          </div>

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-secondary hover:text-white transition"
            aria-label="Share post"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <section className="border-t border-[#334155] bg-[#070A12]/80 p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
            Comments &amp; Discussion ({comments.length})
          </h4>

          {/* Comment list */}
          {commentsLoading ? (
            <p className="text-xs text-ink-muted">Loading discussion…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-ink-muted">No comments yet. Start the conversation!</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comm) => (
                <div
                  key={comm.id}
                  className={`flex items-start gap-2.5 text-xs ${
                    comm.parentId ? 'ml-6 pl-2 border-l border-[#334155]' : ''
                  }`}
                >
                  {/* Comment Author Avatar */}
                  {comm.authorAvatar ? (
                    <img
                      src={comm.authorAvatar}
                      alt={comm.authorName}
                      className="h-7 w-7 rounded-full object-cover border border-[#334155] shrink-0"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand font-bold text-xs">
                      {comm.authorName.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 rounded-xl bg-secondary/80 border border-[#334155]/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white">{comm.authorName}</span>
                        {comm.replyToAuthor && (
                          <span className="text-ink-faint flex items-center gap-0.5">
                            <CornerDownRight className="h-3 w-3 text-brand" />
                            @{comm.replyToAuthor}
                          </span>
                        )}
                        <span className="text-[10px] text-ink-muted">• {formatRelativeTime(comm.createdAt)}</span>
                      </div>

                      {/* Delete comment if author */}
                      {comm.authorId === currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comm.id)}
                          className="text-ink-faint hover:text-rose-400"
                          title="Delete your comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <p className="mt-1 text-white leading-relaxed whitespace-pre-line">{comm.content}</p>

                    <div className="mt-2 flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo({ id: comm.id, authorName: comm.authorName })
                          setCommentInput(`@${comm.authorName} `)
                        }}
                        className="text-brand hover:underline font-semibold"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="pt-2">
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-brand/10 border border-brand/20 px-3 py-1.5 text-xs text-brand">
                <span>Replying to <strong>@{replyingTo.authorName}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null)
                    setCommentInput('')
                  }}
                  className="text-ink-muted hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write a comment or reply to this post…"
                className="input text-xs py-2 h-10"
                maxLength={400}
              />
              <button
                type="submit"
                disabled={submittingComment || !commentInput.trim()}
                className="btn-primary shrink-0 h-10 px-3.5"
                aria-label="Send comment"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Edit Modal */}
      <EditPostModal
        post={post}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdated={() => onPostUpdated?.()}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteModal}
        title="Delete Community Post"
        confirmLabel="Delete Post"
        danger
        busy={deletingPost}
        onConfirm={handleDeletePost}
        onClose={() => setShowDeleteModal(false)}
      >
        Are you sure you want to delete this post? All likes and comments on this post will also be removed. This action cannot be undone.
      </ConfirmationModal>

      {/* Report Modal */}
      <ReportPostModal
        postId={post.id}
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReported={() => onPostUpdated?.()}
      />
    </article>
  )
}
