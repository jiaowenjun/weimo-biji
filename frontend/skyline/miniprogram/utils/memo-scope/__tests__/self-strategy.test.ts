import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    ensureMemoList: vi.fn(),
    loadMoreMemoList: vi.fn(),
  },
}))

vi.mock('../../memo-card-double-tap-prefs', () => ({
  readMemoCardDoubleTapBehavior: vi.fn(() => 'edit-annotate'),
}))

vi.mock('../../memo-list-card-actions', () => ({
  openEditComposeForCard: vi.fn(),
  openQuoteComposeForCard: vi.fn(),
  openMemoShareForCard: vi.fn(),
}))

vi.mock('../../navigation', () => ({
  openMemoReferenceDetail: vi.fn(),
}))

import { workspaceStore } from '../../../store/store-bindings/workspace-store.instance'
import { readMemoCardDoubleTapBehavior } from '../../memo-card-double-tap-prefs'
import {
  openEditComposeForCard,
  openQuoteComposeForCard,
  openMemoShareForCard,
} from '../../memo-list-card-actions'
import { openMemoReferenceDetail } from '../../navigation'
import { createSelfScopeStrategy } from '../self-strategy'
import type { CardActionContext } from '../types'

describe('SelfScopeStrategy', () => {
  let strategy: ReturnType<typeof createSelfScopeStrategy>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readMemoCardDoubleTapBehavior).mockReturnValue('edit-annotate')
    strategy = createSelfScopeStrategy(() => 'desc')
  })

  it('has kind self', () => {
    expect(strategy.kind).toBe('self')
  })

  it('buildSearchQuery normalizes draft into own memo search query', () => {
    const query = strategy.buildSearchQuery({
      keyword: '  hello  ',
      selectedTag: '  work  ',
      dateMode: 'day',
      dateValue: '',
    })

    expect(query).toEqual({
      tag: 'work',
      text: { contains: 'hello' },
    })
  })

  it('reads self-backed page state', () => {
    const memoQuery = { keyword: 'mine', selectedTag: 'work', dateMode: 'day' as const, dateValue: '' }
    const stats = { note_count: 1, tag_count: 2, word_count: 3, daily_note_count: [] }
    const tagTreeNodes = [{ label: 'Work', tag: 'work', item_count: 1, children: [] }]
    const data = {
      memoQuery,
      memoDateLabel: '今天',
      stats,
      tagTreeNodes,
    }

    expect(strategy.getCurrentQuery(data)).toBe(memoQuery)
    expect(strategy.getCurrentDateLabel(data)).toBe('今天')
    expect(strategy.getStats(data)).toBe(stats)
    expect(strategy.getTagTreeNodes(data)).toBe(tagTreeNodes)
  })

  it('refresh triggers workspaceStore.ensureMemoList and returns binding result', async () => {
    const draft = { keyword: 'test', selectedTag: '', dateMode: 'day' as const, dateValue: '' }
    const result = await strategy.refresh(draft, 8)

    expect(result.kind).toBe('binding')
    expect(workspaceStore.ensureMemoList).toHaveBeenCalledTimes(1)
  })

  it('loadMore triggers workspaceStore.loadMoreMemoList and returns binding result', async () => {
    const draft = { keyword: 'test', selectedTag: '', dateMode: 'day' as const, dateValue: '' }
    const result = await strategy.loadMore(draft, 'cursor123', 8)

    expect(result.kind).toBe('binding')
    expect(workspaceStore.loadMoreMemoList).toHaveBeenCalledTimes(1)
  })

  it('resolveRelations returns empty options', async () => {
    const page = { items: [], nextCursor: null, hasMore: false }
    const result = await strategy.resolveRelations(page)

    expect(result).toEqual({})
  })

  it('onCardDoubleTap calls openEditComposeForCard', () => {
    const ctx = { memoCards: [{ id: 7 }], host: {}, refreshList: vi.fn() } as unknown as CardActionContext
    strategy.onCardDoubleTap(ctx, 7)

    expect(openMemoShareForCard).not.toHaveBeenCalled()
    expect(openEditComposeForCard).toHaveBeenCalledWith(ctx.memoCards, 7)
  })

  it('onCardDoubleTap calls openMemoShareForCard when double-tap prefs are preview', () => {
    vi.mocked(readMemoCardDoubleTapBehavior).mockReturnValue('preview')

    const ctx = { memoCards: [{ id: 7 }], host: {}, refreshList: vi.fn() } as unknown as CardActionContext
    strategy.onCardDoubleTap(ctx, 7)

    expect(openMemoShareForCard).toHaveBeenCalledWith(ctx.memoCards, 7)
    expect(openEditComposeForCard).not.toHaveBeenCalled()
  })

  it('onCardQuote calls openQuoteComposeForCard', () => {
    const ctx = { memoCards: [{ id: 7 }], host: {}, refreshList: vi.fn() } as unknown as CardActionContext
    strategy.onCardQuote(ctx, 7)

    expect(openQuoteComposeForCard).toHaveBeenCalledWith(ctx.memoCards, 7)
  })

  it('onCardReferenceTap calls openMemoReferenceDetail', () => {
    strategy.onCardReferenceTap(7)

    expect(openMemoReferenceDetail).toHaveBeenCalledWith(7)
  })
})
