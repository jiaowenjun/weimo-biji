import { describe, expect, it } from 'vitest'
import type { FriendSearchItem } from '../../../models/friend'
import {
  deriveFriendSearchButtonState,
  friendSearchConflictToast,
  shouldSearchFriendNickname,
} from '../view-state'

describe('friend-search view state', () => {
  it('does not search blank nickname', () => {
    expect(shouldSearchFriendNickname('   ')).toBe(false)
    expect(shouldSearchFriendNickname('阿')).toBe(true)
  })

  it('maps follow states to button labels and disabled states', () => {
    const item = (follow_state: FriendSearchItem['follow_state']): FriendSearchItem => ({
      follow_state,
      user: { username: 'bob', nickname: 'Bob' },
    })

    expect(deriveFriendSearchButtonState(item('none'))).toEqual({
      label: '关注',
      disabled: false,
    })
    expect(deriveFriendSearchButtonState(item('pending_outgoing'))).toEqual({
      label: '已申请',
      disabled: true,
    })
    expect(deriveFriendSearchButtonState(item('paired'))).toEqual({
      label: '已添加',
      disabled: true,
    })
    expect(deriveFriendSearchButtonState(item('unavailable'))).toEqual({
      label: '不可添加',
      disabled: true,
    })
  })

  it('maps conflict codes to local toast copy', () => {
    expect(friendSearchConflictToast({ code: 'PENDING_EXISTS', message: 'server copy' })).toBe(
      '已有待处理的好友申请',
    )
    expect(friendSearchConflictToast(null)).toBe('添加朋友失败')
  })
})
