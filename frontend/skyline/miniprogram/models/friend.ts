import type { MemoDto, MemoSearchPageDto } from './memo'

export type FriendRequestStatus = 'pending' | 'accepted' | 'expired'
export type SocialNotificationKind = 'friend_request' | 'friend_accepted'
export type FriendFollowState = 'none' | 'pending_outgoing' | 'paired' | 'unavailable'

export type FriendConflictCode =
  | 'ALREADY_PAIRED'
  | 'TARGET_PAIRED'
  | 'PENDING_EXISTS'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_NOT_FOUND'
  | 'INVALID_FRIEND_TARGET'
  | 'NO_FRIENDS_YET'
  | 'NOT_YOUR_FRIEND'
  | 'FRIEND_UNAVAILABLE'

export type FriendMemoDto = MemoDto

export type FriendMemoSearchPageDto = Omit<MemoSearchPageDto, 'items'> & {
  items: FriendMemoDto[]
}

export interface FriendConflictBody {
  code: FriendConflictCode
  message: string
}

export interface FriendProfile {
  username: string
  nickname: string
}

export interface PendingOutgoingFriendRequest {
  id: string
  to: FriendProfile
  created_at: string
}

export interface FriendSummary {
  /**
   * 好友集合。当前策略下最多 1 个，未来可能放宽到 N。
   * 这是好友关系的真相源；选中态请用 `selectedFriendUsername`，不要假设 `friends[0]`。
   */
  friends: FriendProfile[]
  pending_outgoing: PendingOutgoingFriendRequest[]
  pending_incoming_count: number
  unread_count: number
}

export interface FriendUnreadCount {
  unread_count: number
}

export interface FriendSearchItem {
  user: FriendProfile
  follow_state: FriendFollowState
}

export interface FriendSearchResult {
  items: FriendSearchItem[]
}

export interface FriendRequestDto {
  id: string
  from: string
  to: string
  status: FriendRequestStatus
  created_at: string
  handled_at?: string | null
}

export interface DeletedFriendProfile extends FriendProfile {
  deleted: boolean
}

export interface FriendNotificationRequest {
  id: string
  can_accept: boolean
  status: FriendRequestStatus
}

export interface FriendNotification {
  id: string
  kind: SocialNotificationKind
  read: boolean
  created_at: string
  request?: FriendNotificationRequest | null
  from?: DeletedFriendProfile | null
}

export interface FriendNotificationList {
  items: FriendNotification[]
}

export function friendByUsername(
  friends: FriendProfile[],
  username: string,
): FriendProfile | null {
  const key = String(username || '').trim()
  if (!key) return null
  return friends.find((friend) => friend.username === key) ?? null
}

export function friendConflictMessage(code: FriendConflictCode): string {
  switch (code) {
    case 'ALREADY_PAIRED':
      return '你已经添加朋友了'
    case 'TARGET_PAIRED':
      return '对方已经添加朋友了'
    case 'PENDING_EXISTS':
      return '已有待处理的好友申请'
    case 'REQUEST_EXPIRED':
      return '这条申请已失效'
    case 'REQUEST_NOT_FOUND':
      return '这条申请不存在'
    case 'INVALID_FRIEND_TARGET':
      return '无法添加该用户'
    case 'NO_FRIENDS_YET':
      return '你还没有添加好友'
    case 'NOT_YOUR_FRIEND':
      return '该用户不是你的好友'
    case 'FRIEND_UNAVAILABLE':
      return '好友不可用'
  }
}
