import { describe, expect, it } from 'vitest'
import { ApiError } from '../request'
import { resolveFriendResourceRecovery } from '../friend-resource-recovery'

function friendConflictError(code: string, message: string) {
  return new ApiError(message, 409, { code, message })
}

describe('resolveFriendResourceRecovery', () => {
  it('maps NO_FRIENDS_YET to friend search action', () => {
    expect(
      resolveFriendResourceRecovery(
        friendConflictError('NO_FRIENDS_YET', '你还没有添加好友'),
        '笔记不可用',
      ),
    ).toEqual({
      errorMessage: '你还没有添加好友',
      toastMessage: '你还没有添加好友',
      actionKind: 'friend-search',
      actionLabel: '添加朋友',
    })
  })

  it('maps NOT_YOUR_FRIEND and FRIEND_UNAVAILABLE to home action', () => {
    expect(
      resolveFriendResourceRecovery(
        friendConflictError('NOT_YOUR_FRIEND', '该用户不是你的好友'),
        '笔记不可用',
      ),
    ).toEqual({
      errorMessage: '该用户不是你的好友',
      toastMessage: '该用户不是你的好友',
      actionKind: 'home',
      actionLabel: '返回首页',
    })

    expect(
      resolveFriendResourceRecovery(
        friendConflictError('FRIEND_UNAVAILABLE', '好友不可用'),
        '笔记不可用',
      ),
    ).toEqual({
      errorMessage: '好友不可用',
      toastMessage: '好友不可用',
      actionKind: 'home',
      actionLabel: '返回首页',
    })
  })

  it('keeps unknown errors on retry path', () => {
    expect(resolveFriendResourceRecovery(new Error('network down'), '笔记不可用')).toEqual({
      errorMessage: 'network down',
      toastMessage: '',
      actionKind: 'retry',
      actionLabel: '重新加载',
    })
  })
})
