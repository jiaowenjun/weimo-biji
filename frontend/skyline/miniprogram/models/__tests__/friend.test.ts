import { describe, expect, it } from 'vitest'
import {
  friendByUsername,
  friendConflictMessage,
  type FriendProfile,
} from '../friend'

const bob: FriendProfile = { username: 'bob', nickname: '小吴' }
const carol: FriendProfile = { username: 'carol', nickname: 'Carol' }

describe('friend model helpers', () => {
  it('finds friends by username', () => {
    expect(friendByUsername([bob, carol], 'carol')).toEqual(carol)
    expect(friendByUsername([bob], 'carol')).toBeNull()
    expect(friendByUsername([bob], '  bob  ')).toEqual(bob)
    expect(friendByUsername([bob], '')).toBeNull()
  })

  it('uses explicit target-friend conflict copy', () => {
    expect(friendConflictMessage('ALREADY_PAIRED')).toBe('你已经添加朋友了')
    expect(friendConflictMessage('TARGET_PAIRED')).toBe('对方已经添加朋友了')
    expect(friendConflictMessage('NO_FRIENDS_YET')).toBe('你还没有添加好友')
    expect(friendConflictMessage('NOT_YOUR_FRIEND')).toBe('该用户不是你的好友')
    expect(friendConflictMessage('FRIEND_UNAVAILABLE')).toBe('好友不可用')
  })
})
