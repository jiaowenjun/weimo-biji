import type { FriendConflictBody, FriendSearchItem } from '../../models/friend'
import { friendConflictMessage } from '../../models/friend'
import { isRecord } from '../../utils/guards'

export interface FriendSearchButtonState {
  label: string
  disabled: boolean
}

export type FriendSearchRow = FriendSearchItem & {
  username: string
  button: FriendSearchButtonState
}

export function shouldSearchFriendNickname(raw: string): boolean {
  return raw.trim().length > 0
}

export function deriveFriendSearchButtonState(
  followStateOrItem: FriendSearchItem | FriendSearchItem['follow_state'],
): FriendSearchButtonState {
  const followState =
    typeof followStateOrItem === 'string'
      ? followStateOrItem
      : followStateOrItem.follow_state

  switch (followState) {
    case 'none':
      return { label: '关注', disabled: false }
    case 'pending_outgoing':
      return { label: '已申请', disabled: true }
    case 'paired':
      return { label: '已添加', disabled: true }
    case 'unavailable':
      return { label: '不可添加', disabled: true }
  }
}

export function deriveFriendSearchRows(items: FriendSearchItem[]): FriendSearchRow[] {
  return items.map((item) => ({
    ...item,
    username: item.user.username,
    button: deriveFriendSearchButtonState(item),
  }))
}

export function parseFriendConflictBody(data: unknown): FriendConflictBody | null {
  if (!isRecord(data) || typeof data.code !== 'string') return null
  if (
    data.code !== 'ALREADY_PAIRED' &&
    data.code !== 'TARGET_PAIRED' &&
    data.code !== 'PENDING_EXISTS' &&
    data.code !== 'REQUEST_EXPIRED' &&
    data.code !== 'REQUEST_NOT_FOUND' &&
    data.code !== 'INVALID_FRIEND_TARGET'
  ) {
    return null
  }
  return {
    code: data.code,
    message: typeof data.message === 'string' ? data.message : '',
  }
}

export function friendSearchConflictToast(data: unknown): string {
  const conflict = parseFriendConflictBody(data)
  return conflict ? friendConflictMessage(conflict.code) : '添加朋友失败'
}
