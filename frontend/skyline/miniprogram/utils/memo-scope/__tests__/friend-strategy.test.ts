import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/friend', () => ({
  searchFriendMemos: vi.fn(),
}))

vi.mock('../../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    getState: vi.fn(() => ({
      memos: { detail: new Map(), list: new Map() },
    })),
    ensureMemoDetails: vi.fn(async () => []),
  },
}))

vi.mock('../../memo-card-double-tap-prefs', () => ({
  readMemoCardDoubleTapBehavior: vi.fn(() => 'edit-annotate'),
}))

vi.mock('../../memo-list-card-actions', () => ({
  openFriendQuoteComposeForCard: vi.fn(),
  openMemoShareForCard: vi.fn(),
}))

vi.mock('../../navigation', () => ({
  openFriendMemoReferenceDetail: vi.fn(),
}))

import { searchFriendMemos } from '../../../services/friend'
import { readMemoCardDoubleTapBehavior } from '../../memo-card-double-tap-prefs'
import { openFriendQuoteComposeForCard, openMemoShareForCard } from '../../memo-list-card-actions'
import { openFriendMemoReferenceDetail } from '../../navigation'
import { createFriendScopeStrategy } from '../friend-strategy'
import type { CardActionContext } from '../types'

const FRIEND = { username: 'bob', nickname: '小吴' }

describe('FriendScopeStrategy', () => {
  let strategy: ReturnType<typeof createFriendScopeStrategy>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readMemoCardDoubleTapBehavior).mockReturnValue('edit-annotate')
    strategy = createFriendScopeStrategy(FRIEND, () => 'desc')
  })

  it('has kind friend', () => {
    expect(strategy.kind).toBe('friend')
  })

  it('returns the friend profile for friend scope', () => {
    expect(strategy.getFriend()).toBe(FRIEND)
  })

  it('buildSearchQuery normalizes draft into friend memo filters', () => {
    const filters = strategy.buildSearchQuery({
      keyword: '  hello  ',
      selectedTag: '  work  ',
      dateMode: 'day',
      dateValue: '',
    })

    expect(filters).toEqual({
      tag: 'work',
      text: { contains: 'hello' },
    })
  })

  it('reads friend-backed page state', () => {
    const friendMemoQuery = { keyword: 'friend', selectedTag: 'life', dateMode: 'day' as const, dateValue: '' }
    const friendStats = { note_count: 5, tag_count: 6, word_count: 7, daily_note_count: [] }
    const friendTagTreeNodes = [{ label: 'Life', tag: 'life', item_count: 2, children: [] }]
    const data = {
      memoQuery: { keyword: 'mine', selectedTag: 'work', dateMode: 'day' as const, dateValue: '' },
      friendMemoQuery,
      memoDateLabel: '今天',
      friendMemoDateLabel: '昨天',
      stats: null,
      friendStats,
      tagTreeNodes: [],
      friendTagTreeNodes,
    }

    expect(strategy.getCurrentQuery(data)).toBe(friendMemoQuery)
    expect(strategy.getCurrentDateLabel(data)).toBe('昨天')
    expect(strategy.getStats(data)).toBe(friendStats)
    expect(strategy.getTagTreeNodes(data)).toBe(friendTagTreeNodes)
  })

  it('refresh calls searchFriendMemos and returns page result', async () => {
    const mockPage = { items: [], nextCursor: null, hasMore: false }
    ;(searchFriendMemos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage)

    const draft = { keyword: 'hello', selectedTag: 'work', dateMode: 'day' as const, dateValue: '' }
    const result = await strategy.refresh(draft, 8)

    expect(result.kind).toBe('page')
    if (result.kind === 'page') {
      expect(result.page).toBe(mockPage)
    }
    expect(searchFriendMemos).toHaveBeenCalledWith(
      'bob',
      expect.objectContaining({ tag: 'work', text: { contains: 'hello' } }),
      null,
      8,
    )
  })

  it('loadMore calls searchFriendMemos with cursor and returns page result', async () => {
    const mockPage = { items: [], nextCursor: null, hasMore: false }
    ;(searchFriendMemos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage)

    const draft = { keyword: '', selectedTag: '', dateMode: 'day' as const, dateValue: '' }
    const result = await strategy.loadMore(draft, 'cur1', 8)

    expect(result.kind).toBe('page')
    expect(searchFriendMemos).toHaveBeenCalledWith(
      'bob',
      expect.any(Object),
      'cur1',
      8,
    )
  })

  it('onCardDoubleTap calls openFriendQuoteComposeForCard', () => {
    const ctx = {
      memoCards: [{ id: 7 }],
      host: {},
      friend: FRIEND,
      refreshList: vi.fn(),
    } as unknown as CardActionContext
    strategy.onCardDoubleTap(ctx, 7)

    expect(openMemoShareForCard).not.toHaveBeenCalled()
    expect(openFriendQuoteComposeForCard).toHaveBeenCalledWith(
      ctx.memoCards,
      7,
      'bob',
      expect.objectContaining({ ownerLabel: '小吴' }),
    )
  })

  it('onCardDoubleTap calls openMemoShareForCard when prefs are preview', () => {
    vi.mocked(readMemoCardDoubleTapBehavior).mockReturnValue('preview')

    const ctx = {
      memoCards: [{ id: 7 }],
      host: {},
      friend: FRIEND,
      refreshList: vi.fn(),
    } as unknown as CardActionContext
    strategy.onCardDoubleTap(ctx, 7)

    expect(openMemoShareForCard).toHaveBeenCalledWith(ctx.memoCards, 7, 'bob')
    expect(openFriendQuoteComposeForCard).not.toHaveBeenCalled()
  })

  it('onCardQuote calls openFriendQuoteComposeForCard', () => {
    const ctx = {
      memoCards: [{ id: 7 }],
      host: {},
      friend: FRIEND,
      refreshList: vi.fn(),
    } as unknown as CardActionContext
    strategy.onCardQuote(ctx, 7)

    expect(openFriendQuoteComposeForCard).toHaveBeenCalledWith(
      ctx.memoCards,
      7,
      'bob',
      expect.objectContaining({ ownerLabel: '小吴' }),
    )
  })

  it('onCardReferenceTap calls openFriendMemoReferenceDetail', () => {
    strategy.onCardReferenceTap(7)

    expect(openFriendMemoReferenceDetail).toHaveBeenCalledWith(7, {
      ownerUsername: 'bob',
    })
  })
})
