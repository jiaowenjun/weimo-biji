import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo, MemoSearchPage } from '../../models/memo'
import type { MemoListEntry } from '../../store/memo-cache-types'
import {
  createListProjector,
  makeMemoListOnChange,
  type MemoListOnChangeHost,
} from '../memo-list-presentation'

function makeMemo(id: number, content = `memo-${id}`, overrides: Partial<Memo> = {}): Memo {
  return {
    id,
    content,
    tags: id % 2 === 0 ? ['work'] : ['life'],
    createdAt: '2026-04-24T10:00:00.000Z',
    updatedAt: '2026-04-24T10:00:00.000Z',
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function makePage(
  items: Memo[],
  overrides: Partial<MemoSearchPage> = {},
): MemoSearchPage {
  return {
    items,
    nextCursor: null,
    hasMore: false,
    totalCount: items.length,
    ...overrides,
  }
}

function makeEntry(
  pages: MemoSearchPage[],
  overrides: Partial<MemoListEntry> = {},
): MemoListEntry {
  return {
    status: 'success',
    error: null,
    dataUpdatedAt: 0,
    filters: {},
    pageSize: 8,
    pages,
    isLoadingMore: false,
    loadMoreError: null,
    ...overrides,
  }
}

function createHost(): MemoListOnChangeHost & {
  setData: ReturnType<typeof vi.fn>
  updateEmptyState: ReturnType<typeof vi.fn>
} {
  return {
    setData: vi.fn(),
    updateEmptyState: vi.fn(),
    _renderTransitionHoldActive: false,
    _filterTransitionPrevIds: null,
    _filterTransitionActive: false,
    _enteringCleanupTimer: null,
  }
}

describe('memo-list-presentation', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('reuses memo card references when memo item references are unchanged', () => {
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const first = project(makeEntry([makePage([memo1, memo2])]))
    const second = project(makeEntry([makePage([memo1, memo2])]))

    expect(second.memoCards).toBe(first.memoCards)
    expect(second.memoCards[0]).toBe(first.memoCards[0])
    expect(second.memoCards[1]).toBe(first.memoCards[1])
  })

  it('projects the first memo ref as referenceId and preview text', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(10, 'B quotes A', { refs: ['7'] }),
      makeMemo(7, 'A first line\nA second line', {
        createdAt: '2026-04-24T10:30:00',
      }),
    ])]))

    expect(result.memoCards[0]?.referenceId).toBe('7')
    expect(result.memoCards[0]?.referencePreview?.displayText).toBe(
      '2026-04-24：A first line A second line',
    )
  })

  it('projects referenceId as null when a memo has no refs', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(11, 'plain memo', { refs: [] }),
    ])]))

    expect(result.memoCards[0]?.referenceId).toBeNull()
    expect(result.memoCards[0]?.referencePreview).toBeNull()
  })

  it('projects memo referencedBy as referencedBy preview text', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(7, 'A is quoted by B and C', { referencedBy: ['99', '100'] }),
      makeMemo(99, 'B quotes A', { createdAt: '2026-04-24T11:00:00' }),
      makeMemo(100, 'C quotes A', { createdAt: '2026-04-24T11:05:00' }),
    ])]))

    expect(result.memoCards[0]?.referencedByPreviews.map((preview) => preview.displayText)).toEqual([
      '2026-04-24：B quotes A',
      '2026-04-24：C quotes A',
    ])
  })

  it('projects forward and reverse reference ids on the same card', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(10, 'B quotes A and is quoted by C', { refs: ['7'], referencedBy: ['12'] }),
    ])]))

    expect(result.memoCards[0]).toMatchObject({
      referenceId: '7',
      referencePreview: { id: '7', displayText: '笔记7' },
      referencedByPreviews: [{ id: '12', displayText: '笔记12' }],
    })
  })

  it('uses fallback previews for slash refs without resolving them as own memo ids', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(10, 'B quotes slash ref memo', {
        refs: ['bob/7'],
        referencedBy: ['carol/12'],
      }),
      makeMemo(7, 'Own memo 7 should not be used'),
      makeMemo(12, 'Own memo 12 should not be used'),
    ])]))

    expect(result.memoCards[0]).toMatchObject({
      referenceId: 'bob/7',
      referencePreview: { id: 'bob/7', displayText: '笔记bob/7' },
      referencedByPreviews: [{ id: 'carol/12', displayText: '笔记carol/12' }],
    })
  })

  it('truncates long reference preview summaries with ASCII ellipsis', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })

    const result = project(makeEntry([makePage([
      makeMemo(10, 'B quotes A', { refs: ['7'] }),
      makeMemo(7, '123456789012345678901234567890', {
        createdAt: '2026-04-24T10:30:00',
      }),
    ])]))

    expect(result.memoCards[0]?.referencePreview?.displayText).toBe(
      '2026-04-24：1234567890123456789012345678...',
    )
  })

  it('keeps the previous empty view stable while the next query is unresolved', () => {
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(makeEntry([makePage([])]))
    host.setData.mockClear()
    host.updateEmptyState.mockClear()
    host._renderTransitionHoldActive = true

    onChange(undefined)
    onChange(makeEntry([], { status: 'loading' }))

    expect(host.setData).not.toHaveBeenCalled()
    expect(host.updateEmptyState).not.toHaveBeenCalled()
    expect(host._renderTransitionHoldActive).toBe(true)
  })

  it('releases the held empty view once the next empty result settles', () => {
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(makeEntry([makePage([])]))
    host.setData.mockClear()
    host.updateEmptyState.mockClear()
    host._renderTransitionHoldActive = true

    onChange(makeEntry([makePage([])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host.setData).toHaveBeenCalledWith({})
    expect(host.updateEmptyState).toHaveBeenCalledTimes(1)
    expect(host._renderTransitionHoldActive).toBe(false)
  })

  it('suppresses unresolved entries when render hold and filter transition coexist, then still builds enteringCardMap', () => {
    vi.useFakeTimers()
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const host = createHost()
    host._renderTransitionHoldActive = true
    host._filterTransitionActive = true
    host._filterTransitionPrevIds = new Set([1])
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
      enteringCleanupMs: 30,
    })

    onChange(undefined)
    onChange(makeEntry([], { status: 'loading' }))

    expect(host.setData).not.toHaveBeenCalled()
    expect(host.updateEmptyState).not.toHaveBeenCalled()
    expect(host._renderTransitionHoldActive).toBe(true)
    expect(host._filterTransitionActive).toBe(true)
    expect(host._filterTransitionPrevIds).toEqual(new Set([1]))

    onChange(makeEntry([makePage([memo1, memo2])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        enteringCardMap: { '2': true },
      }),
    )
    expect(host.updateEmptyState).toHaveBeenCalledTimes(1)
    expect(host._renderTransitionHoldActive).toBe(false)
    expect(host._filterTransitionActive).toBe(false)
    expect(host._filterTransitionPrevIds).toBeNull()
  })

  it('remains compatible with hosts that omit _renderTransitionHoldActive', () => {
    const baseHost = createHost()
    const host: MemoListOnChangeHost & {
      setData: ReturnType<typeof vi.fn>
      updateEmptyState: ReturnType<typeof vi.fn>
    } = {
      setData: baseHost.setData,
      updateEmptyState: baseHost.updateEmptyState,
      _filterTransitionPrevIds: null,
      _filterTransitionActive: true,
      _enteringCleanupTimer: null,
    }
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(undefined)

    expect(host.setData).not.toHaveBeenCalled()
    expect(host.updateEmptyState).not.toHaveBeenCalled()
    expect(host._filterTransitionActive).toBe(true)

    onChange(makeEntry([makePage([makeMemo(1)])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host.updateEmptyState).toHaveBeenCalledTimes(1)
    expect(host._filterTransitionActive).toBe(false)
  })

  it('emits append-friendly field patches for loadMore', () => {
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const memo3 = makeMemo(3)
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(
      makeEntry([
        makePage([memo1, memo2], { nextCursor: 'cursor-1', hasMore: true, totalCount: 3 }),
      ]),
    )
    host.setData.mockClear()
    host.updateEmptyState.mockClear()

    onChange(
      makeEntry([
        makePage([memo1, memo2], { nextCursor: 'cursor-1', hasMore: true, totalCount: 3 }),
        makePage([memo3], { nextCursor: null, hasMore: false, totalCount: 3 }),
      ]),
    )

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host.setData).toHaveBeenCalledWith({
      'memoCards[2]': expect.objectContaining({ id: 3 }),
      'memoRenderCards[2]': expect.objectContaining({ id: 3 }),
      memoNextCursor: null,
      memoHasMore: false,
    })
    expect(host.updateEmptyState).toHaveBeenCalledTimes(1)
  })

  it('uses field-path update when same length but first item differs', () => {
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(makeEntry([makePage([memo1, memo2])]))
    host.setData.mockClear()

    onChange(makeEntry([makePage([makeMemo(99), memo2])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    const patch = host.setData.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.memoCards).toBeUndefined()
    expect(patch['memoCards[0]']).toEqual(expect.objectContaining({ id: 99 }))
    expect(patch['memoCards[1]']).toBeUndefined()
  })

  it('keeps builder render slots stable by swapping a single delete into a tombstone', () => {
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const memo3 = makeMemo(3)
    const memo4 = makeMemo(4)
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(makeEntry([makePage([memo1, memo2, memo3, memo4])]))
    host.setData.mockClear()

    onChange(makeEntry([makePage([memo1, memo3, memo4])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    const patch = host.setData.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.memoRenderCards).toBeUndefined()
    expect(patch['memoRenderCards[1]']).toEqual({ id: 2, tombstone: true })
    expect(patch['memoRenderCards[2]']).toBeUndefined()
    expect(patch['memoRenderCards[3]']).toBeUndefined()
  })

  it('preserves tombstones across later append updates within the same binding lifetime', () => {
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const memo3 = makeMemo(3)
    const memo4 = makeMemo(4)
    const memo5 = makeMemo(5)
    const host = createHost()
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(makeEntry([makePage([memo1, memo2, memo3, memo4])]))
    onChange(makeEntry([makePage([memo1, memo3, memo4])]))
    host.setData.mockClear()

    onChange(
      makeEntry([
        makePage([memo1, memo3, memo4], { nextCursor: 'cursor-1', hasMore: true, totalCount: 4 }),
        makePage([memo5], { nextCursor: null, hasMore: false, totalCount: 4 }),
      ]),
    )

    expect(host.setData).toHaveBeenCalledTimes(1)
    const patch = host.setData.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.memoRenderCards).toBeUndefined()
    expect(patch['memoRenderCards[1]']).toBeUndefined()
    expect(patch['memoRenderCards[2]']).toBeUndefined()
    expect(patch['memoRenderCards[3]']).toBeUndefined()
    expect(patch['memoRenderCards[4]']).toEqual(expect.objectContaining({ id: 5 }))
  })

  it('short-circuits no-data updates during filter transition until usable data arrives', () => {
    const memo1 = makeMemo(1)
    const host = createHost()
    host._filterTransitionActive = true
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
    })

    onChange(undefined)
    onChange(makeEntry([], { status: 'loading' }))

    expect(host.setData).not.toHaveBeenCalled()
    expect(host._filterTransitionActive).toBe(true)

    onChange(makeEntry([makePage([memo1])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host._filterTransitionActive).toBe(false)
  })

  it('builds enteringCardMap from filter transition diff and clears it after the cleanup timer', () => {
    vi.useFakeTimers()
    const memo1 = makeMemo(1)
    const memo2 = makeMemo(2)
    const host = createHost()
    host._filterTransitionPrevIds = new Set([1])
    const onChange = makeMemoListOnChange(host, {
      getExitingMemoIds: () => new Set<number>(),
      enteringCleanupMs: 30,
    })

    onChange(makeEntry([makePage([memo1, memo2])]))

    expect(host.setData).toHaveBeenCalledTimes(1)
    expect(host.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        enteringCardMap: { '2': true },
      }),
    )
    expect(host._filterTransitionPrevIds).toBeNull()
    expect(host._enteringCleanupTimer).not.toBeNull()

    vi.advanceTimersByTime(30)

    expect(host.setData).toHaveBeenCalledTimes(2)
    expect(host.setData).toHaveBeenLastCalledWith({ enteringCardMap: null })
    expect(host._enteringCleanupTimer).toBeNull()
  })

  it('sets renderRichText true for all cards when total count is at or below threshold', () => {
    const memos = Array.from({ length: 50 }, (_, i) => makeMemo(i + 1))
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })
    const result = project(makeEntry([makePage(memos)]))
    expect(result.memoCards).toHaveLength(50)
    for (const card of result.memoCards) {
      expect(card.renderRichText).toBe(true)
    }
  })

  it('sets renderRichText false for cards beyond index 100 when total exceeds threshold', () => {
    const memos = Array.from({ length: 120 }, (_, i) => makeMemo(i + 1))
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })
    const result = project(makeEntry([makePage(memos)]))
    expect(result.memoCards).toHaveLength(120)
    for (let i = 0; i < 100; i++) {
      expect(result.memoCards[i].renderRichText).toBe(true)
    }
    for (let i = 100; i < 120; i++) {
      expect(result.memoCards[i].renderRichText).toBe(false)
    }
  })

  it('sets contentNodes to empty array for plain-text cards beyond threshold', () => {
    const memos = Array.from({ length: 105 }, (_, i) => makeMemo(i + 1))
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })
    const result = project(makeEntry([makePage(memos)]))
    for (let i = 100; i < 105; i++) {
      expect(result.memoCards[i].contentNodes).toEqual([])
      expect(result.memoCards[i].content).toBe(`memo-${i + 1}`)
    }
  })

  it('keeps highlighted search cards in rich-text mode beyond the threshold', () => {
    const memos = Array.from({ length: 105 }, (_, i) => makeMemo(i + 1, '命中词\n\n第二段'))
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
      highlightKeyword: '命中',
    })
    const result = project(makeEntry([makePage(memos)]))
    const nodes = result.memoCards[104].contentNodes

    expect(result.memoCards[104].renderRichText).toBe(true)
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      name: 'p',
      attrs: { class: 'memo-markdown__p' },
    })
    expect((nodes[0] as { children?: Array<{ name?: string; attrs?: { class?: string } }> }).children?.[0]).toMatchObject({
      name: 'mark',
      attrs: { class: 'memo-markdown__mark' },
    })
    expect(nodes[1]).toMatchObject({
      name: 'p',
      attrs: { class: 'memo-markdown__p' },
    })
  })

  it('preserves paragraph spacing around highlighted search paragraphs', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
      highlightKeyword: '命中',
    })

    const result = project(makeEntry([makePage([
      makeMemo(1, '第一段\n\n命中第二段\n\n第三段'),
    ])]))
    const nodes = result.memoCards[0].contentNodes as Array<{
      attrs?: { class?: string; style?: string }
    }>

    expect(nodes).toHaveLength(3)
    expect(nodes[0]?.attrs?.style).toBeUndefined()
    expect(nodes[1]?.attrs?.style).toContain('margin-top: 1em')
    expect(nodes[2]?.attrs?.style).toContain('margin-top: 1em')
  })

  it('preserves paragraph-to-blockquote spacing around highlighted search content', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
      highlightKeyword: '命中',
    })

    const result = project(makeEntry([makePage([
      makeMemo(1, '命中第一段\n\n> 引用第二段'),
    ])]))
    const nodes = result.memoCards[0].contentNodes as Array<{
      attrs?: { class?: string; style?: string }
    }>

    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.attrs?.class).toBe('memo-markdown__p')
    expect(nodes[1]?.attrs?.class).toContain('memo-markdown__blockquote')
    expect(nodes[1]?.attrs?.style).toContain('margin-top: 1em')
  })

  it('invalidates cache when a card switches from rich to plain as list grows', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })
    const memos99 = Array.from({ length: 99 }, (_, i) => makeMemo(i + 1))
    const result1 = project(makeEntry([makePage(memos99)]))
    expect(result1.memoCards[98].renderRichText).toBe(true)
    expect(result1.memoCards[98].contentNodes.length).toBeGreaterThan(0)

    const memos105 = [...memos99, ...Array.from({ length: 6 }, (_, i) => makeMemo(100 + i))]
    const result2 = project(makeEntry([makePage(memos105)]))
    for (let i = 0; i < 100; i++) {
      expect(result2.memoCards[i].renderRichText).toBe(true)
    }
    for (let i = 100; i < 105; i++) {
      expect(result2.memoCards[i].renderRichText).toBe(false)
      expect(result2.memoCards[i].contentNodes).toEqual([])
    }
  })

  it('invalidates cache when a card switches from plain to rich as list shrinks', () => {
    const project = createListProjector({
      getExitingMemoIds: () => new Set<number>(),
    })
    const memos105 = Array.from({ length: 105 }, (_, i) => makeMemo(i + 1))
    const result1 = project(makeEntry([makePage(memos105)]))
    expect(result1.memoCards[100].renderRichText).toBe(false)

    const memos95 = memos105.slice(0, 95)
    const result2 = project(makeEntry([makePage(memos95)]))
    for (const card of result2.memoCards) {
      expect(card.renderRichText).toBe(true)
      expect(card.contentNodes.length).toBeGreaterThan(0)
    }
  })
})
