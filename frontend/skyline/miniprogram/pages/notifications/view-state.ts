import type { FriendConflictBody, FriendNotification } from '../../models/friend'
import { friendConflictMessage } from '../../models/friend'
import { isRecord } from '../../utils/guards'

export interface NotificationRow {
  id: string
  requestId: string
  kind: FriendNotification['kind']
  title: string
  description: string
  avatarUrl: string
  deleted: boolean
  actionLabel: string
  actionDisabled: boolean
}

export function deriveNotificationRows(items: FriendNotification[]): NotificationRow[] {
  return items.map((item) => {
    const from = item.from
    const title = from?.nickname || '用户已注销'
    const deleted = from?.deleted === true
    const requestId = item.request?.id || ''

    if (item.kind === 'friend_accepted') {
      return {
        id: item.id,
        requestId,
        kind: item.kind,
        title,
        description: '已同意你的好友申请',
        avatarUrl: '',
        deleted,
        actionLabel: '',
        actionDisabled: true,
      }
    }

    const canAccept = item.request?.can_accept === true && !deleted
    return {
      id: item.id,
      requestId,
      kind: item.kind,
      title,
      description: '申请添加你为朋友',
      avatarUrl: '',
      deleted,
      actionLabel: canAccept ? '同意' : '已失效',
      actionDisabled: !canAccept,
    }
  })
}

export function parseNotificationConflictBody(data: unknown): FriendConflictBody | null {
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

export function notificationConflictToast(data: unknown): string {
  const conflict = parseNotificationConflictBody(data)
  return conflict ? friendConflictMessage(conflict.code) : '处理申请失败'
}
