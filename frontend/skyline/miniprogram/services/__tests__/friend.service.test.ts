import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}))

describe('friend service', () => {
  beforeEach(() => {
    requestMock.mockReset()
    vi.resetModules()
  })

  it('searches users by encoded nickname', async () => {
    requestMock.mockResolvedValue({ items: [] })
    const { searchFriendsByNickname } = await import('../friend')

    await searchFriendsByNickname('阿 衡')

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/search?nickname=%E9%98%BF%20%E8%A1%A1',
    })
  })

  it('creates friend request with to_username payload', async () => {
    requestMock.mockResolvedValue({ id: 'request_1' })
    const { createFriendRequest } = await import('../friend')

    await createFriendRequest('bob')

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/request',
      method: 'POST',
      data: { to_username: 'bob' },
    })
  })

  it('accepts friend request through the request id route', async () => {
    requestMock.mockResolvedValue({
      friends: [],
      pending_outgoing: [],
      pending_incoming_count: 0,
      unread_count: 0,
    })
    const { acceptFriendRequest } = await import('../friend')

    await acceptFriendRequest('request_1')

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/requests/request_1/accept',
      method: 'POST',
    })
  })

  it('searches friend memos through explicit friend endpoint', async () => {
    requestMock.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
      total_count: 0,
    })
    const { searchFriendMemos } = await import('../friend')

    await searchFriendMemos('bob', {}, null, 8)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/bob/memos/search',
      method: 'POST',
      data: { page_size: 8 },
    })
  })

  it('loads friend sidebar stats through explicit friend endpoint', async () => {
    requestMock.mockResolvedValue({
      note_count: 2,
      tag_count: 1,
      word_count: 20,
      daily_note_count: [[17741, 2]],
    })
    const { getFriendStats } = await import('../friend')

    const stats = await getFriendStats('bob')

    expect(requestMock).toHaveBeenCalledWith({ url: '/friend/bob/stats' })
    expect(stats.note_count).toBe(2)
  })

  it('loads friend tag tree through explicit friend endpoint', async () => {
    requestMock.mockResolvedValue({
      label: '',
      tag: '',
      item_count: 1,
      children: [{ label: 'work', tag: 'work', item_count: 1, children: [] }],
    })
    const { getFriendTagTree } = await import('../friend')

    const tree = await getFriendTagTree('bob')

    expect(requestMock).toHaveBeenCalledWith({ url: '/friend/bob/tag/meta' })
    expect(tree.children[0].tag).toBe('work')
  })

  it('encodes explicit friend username path segments', async () => {
    requestMock.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
      total_count: 0,
    })
    const { searchFriendMemos } = await import('../friend')

    await searchFriendMemos('bo/b', {}, null, 8)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/bo%2Fb/memos/search',
      method: 'POST',
      data: { page_size: 8 },
    })
  })

  it('searches friend memos with filters and cursor', async () => {
    requestMock.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
      total_count: 0,
    })
    const { searchFriendMemos } = await import('../friend')

    await searchFriendMemos(
      'bob',
      {
        tag: 'work',
        createdAt: { kind: 'day', year: 2026, month: 5, day: 1 },
      },
      'cursor_1',
      8,
    )

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/bob/memos/search',
      method: 'POST',
      data: {
        page_size: 8,
        cursor: 'cursor_1',
        tag: 'work',
        created_at: { kind: 'day', year: 2026, month: 5, day: 1 },
      },
    })
  })

  it('loads one friend memo detail', async () => {
    requestMock.mockResolvedValue({
      id: 7,
      ct_utc: [2026, 120, 1, 2, 3, 0, 0, 0, 0],
      mt_utc: [2026, 120, 1, 2, 3, 0, 0, 0, 0],
      tags: ['friend'],
      content: 'friend memo',
      refs: ['1'],
      referenced_by: ['3'],
    })
    const { getFriendMemo } = await import('../friend')

    const memo = await getFriendMemo('bob', 7)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/friend/bob/memos/7',
      method: 'GET',
    })
    expect(memo.refs).toEqual(['1'])
    expect(memo.referencedBy).toEqual(['3'])
  })
})
