import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FriendSummary } from '../../models/friend'
import type { Memo } from '../../models/memo'
import { loadFriendMemoReferenceDetailData, loadMemoReferenceListData } from '../memo-reference-detail-loader'

const ensureMemoDetailMock = vi.fn()
const ensureMemoDetailsMock = vi.fn()
const getFriendMemoMock = vi.fn()
const getFriendSummaryMock = vi.fn()

vi.mock('../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    ensureMemoDetail: (memoId: number) => ensureMemoDetailMock(memoId),
    ensureMemoDetails: (memoIds: number[]) => ensureMemoDetailsMock(memoIds),
  },
}))

vi.mock('../../services/friend', () => ({
  getFriendMemo: (username: string, memoId: number) => getFriendMemoMock(username, memoId),
  getFriendSummary: () => getFriendSummaryMock(),
}))

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const ts = '2026-05-26T00:00:00.000Z'
  return {
    id,
    content: `memo ${id}`,
    tags: [],
    refs: [],
    referencedBy: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeFriendSummary(friends = [{
  username: 'bob',
  nickname: 'Bob',
}]): FriendSummary {
  return {
    friends,
    pending_outgoing: [],
    pending_incoming_count: 0,
    unread_count: 0,
  }
}

describe('memo-reference-detail-loader', () => {
  beforeEach(() => {
    ensureMemoDetailMock.mockReset()
    ensureMemoDetailsMock.mockReset()
    getFriendMemoMock.mockReset()
    getFriendSummaryMock.mockReset()
  })

  it('hydrates incoming friend refs for own cards in friend detail', async () => {
    const root = makeMemo(7, {
      content: 'friend memo A',
      referencedBy: ['3'],
    })
    const myMemo = makeMemo(3, {
      content: 'my memo B',
      refs: ['bob/7'],
      referencedBy: ['bob/9'],
    })
    const friendNestedMemo = makeMemo(9, {
      content: 'friend memo C summary',
    })

    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    getFriendMemoMock.mockImplementation((username: string, memoId: number) => {
      if (username !== 'bob') {
        throw new Error(`unexpected username ${username}`)
      }
      if (memoId === 7) return Promise.resolve(root)
      if (memoId === 9) return Promise.resolve(friendNestedMemo)
      throw new Error(`unexpected friend memo ${memoId}`)
    })
    ensureMemoDetailsMock.mockImplementation((memoIds: number[]) => {
      if (memoIds.length === 1 && memoIds[0] === 3) {
        return Promise.resolve([myMemo])
      }
      return Promise.resolve([])
    })

    const projection = await loadFriendMemoReferenceDetailData(7, 'bob')

    expect(projection.ownReferencedByCards).toHaveLength(1)
    expect(projection.ownReferencedByCards[0]?.referencedByPreviews[0]?.displayText).toBe(
      'Bob: friend memo C summary',
    )
  })

  it('builds mixed own/friend reference cards for references-only mode', async () => {
    const ownMemo = makeMemo(3, {
      content: 'my memo B',
      refs: ['5'],
    })
    const ownNestedMemo = makeMemo(5, {
      content: 'my memo C',
    })
    const friendMemo = makeMemo(7, {
      content: 'friend memo A',
      refs: ['3'],
      referencedBy: ['5'],
    })

    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    getFriendMemoMock.mockImplementation((username: string, memoId: number) => {
      if (username !== 'bob') {
        throw new Error(`unexpected username ${username}`)
      }
      if (memoId === 7) return Promise.resolve(friendMemo)
      throw new Error(`unexpected friend memo ${memoId}`)
    })
    ensureMemoDetailsMock.mockImplementation((memoIds: number[]) => {
      if (memoIds.length === 1 && memoIds[0] === 3) {
        return Promise.resolve([ownMemo])
      }
      if (memoIds.length === 1 && memoIds[0] === 5) {
        return Promise.resolve([ownNestedMemo])
      }
      return Promise.resolve([])
    })

    const projection = await loadMemoReferenceListData(['3', 'bob/7'])

    expect(projection.referenceCards.map((card) => `${card.ownerUsername || 'self'}:${card.id}`)).toEqual([
      'self:3',
      'bob:7',
    ])
    expect(projection.ownReferenceCards.map((card) => card.id)).toEqual([3])
    expect(projection.friendReferenceCards.map((card) => card.id)).toEqual([7])
    expect(projection.friendReferenceCards[0]?.referencePreview?.displayText).toBe('我: my memo B')
    expect(projection.friendReferenceCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: my memo C')
  })
})
