import { describe, expect, it } from 'vitest'
import type { FriendNotification } from '../../../models/friend'
import {
  deriveNotificationRows,
  notificationConflictToast,
} from '../view-state'

function requestNotification(overrides: Partial<FriendNotification> = {}): FriendNotification {
  return {
    id: 'notification_1',
    kind: 'friend_request',
    read: false,
    created_at: '2026-04-30T00:00:00Z',
    request: { id: 'request_1', can_accept: true, status: 'pending' },
    from: { username: 'alice', nickname: 'Alice', deleted: false },
    ...overrides,
  }
}

describe('notifications view state', () => {
  it('derives request row with agree button', () => {
    expect(deriveNotificationRows([requestNotification()])[0]).toMatchObject({
      title: 'Alice',
      description: '申请添加你为朋友',
      actionLabel: '同意',
      actionDisabled: false,
    })
  })

  it('derives expired row with disabled state', () => {
    expect(
      deriveNotificationRows([
        requestNotification({
          request: { id: 'request_1', can_accept: false, status: 'expired' },
        }),
      ])[0],
    ).toMatchObject({
      actionLabel: '已失效',
      actionDisabled: true,
    })
  })

  it('derives accepted notification text without action', () => {
    expect(
      deriveNotificationRows([
        requestNotification({
          kind: 'friend_accepted',
          request: null,
          from: { username: 'bob', nickname: 'Bob', deleted: false },
        }),
      ])[0],
    ).toMatchObject({
      title: 'Bob',
      description: '已同意你的好友申请',
      actionLabel: '',
      actionDisabled: true,
    })
  })

  it('uses deleted user display', () => {
    expect(
      deriveNotificationRows([
        requestNotification({
          from: { username: 'alice', nickname: '用户已注销', deleted: true },
        }),
      ])[0].title,
    ).toBe('用户已注销')
  })

  it('maps request expired conflict copy', () => {
    expect(notificationConflictToast({ code: 'REQUEST_EXPIRED', message: 'server copy' })).toBe(
      '这条申请已失效',
    )
  })
})
