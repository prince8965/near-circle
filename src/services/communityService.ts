import { SEED_COMMUNITIES } from '../data/communities'
import type { Community } from '../types'
import { delay } from './bus'
import { readFollowedIds, writeFollowedIds } from './db'

export interface CommunityWithState extends Community {
  isFollowing: boolean
  /** Member count including the current user's follow (demo). */
  members: number
}

function withState(c: Community, followed: Set<string>): CommunityWithState {
  const isFollowing = followed.has(c.id)
  return { ...c, isFollowing, members: c.memberCount + (isFollowing ? 1 : 0) }
}

/** Backend equivalent: GET /communities */
export async function getCommunities(): Promise<CommunityWithState[]> {
  await delay()
  const followed = new Set(readFollowedIds())
  return SEED_COMMUNITIES.map((c) => withState(c, followed))
}

/** Backend equivalent: GET /communities/:id */
export async function getCommunityById(id: string): Promise<CommunityWithState | null> {
  await delay(250)
  const c = SEED_COMMUNITIES.find((x) => x.id === id)
  return c ? withState(c, new Set(readFollowedIds())) : null
}

/** Backend equivalent: POST /communities/:id/follow */
export async function followCommunity(communityId: string): Promise<void> {
  await delay(250)
  const ids = readFollowedIds()
  if (!ids.includes(communityId)) writeFollowedIds([...ids, communityId])
}

/** Backend equivalent: DELETE /communities/:id/follow */
export async function unfollowCommunity(communityId: string): Promise<void> {
  await delay(250)
  writeFollowedIds(readFollowedIds().filter((id) => id !== communityId))
}
