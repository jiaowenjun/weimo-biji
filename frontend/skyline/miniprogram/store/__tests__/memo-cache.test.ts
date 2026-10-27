import { describe, expect, it } from 'vitest'
import { memoMatchesFilters, remapMemoTagPath } from '../memo-cache-filters'
import {
  prependMemoListData,
  transformMemoListData,
} from '../memo-cache-list-data'
import {
  insertMemoCacheEntry,
  removeMemoCacheEntry,
  renameMemoTagsInCache,
  syncMemoCacheEntry,
} from '../memo-cache'
import {
  isMemo,
  isMemoArray,
  type MemoDetailEntry,
  type MemoListEntry,
} from '../memo-cache-types'
import type { Memo, MemoSearchPage } from '../../models/memo'

function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 1,
    content: '',
    tags: [],
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function withTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ
  process.env.TZ = timeZone
  try {
    return run()
  } finally {
    if (previous === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = previous
    }
  }
}

function makePage(items: Memo[], totalCount = items.length): MemoSearchPage {
  return { items, nextCursor: null, hasMore: false, totalCount }
}

function emptyState() {
  return {
    memos: {
      detail: new Map<number, MemoDetailEntry>(),
      list: new Map<string, MemoListEntry>(),
    },
  }
}

function entry(filters: { tag?: string }, items: Memo[]): MemoListEntry {
  return {
    status: 'success',
    error: null,
    dataUpdatedAt: 1,
    filters,
    pageSize: 8,
    pages: [makePage(items)],
    isLoadingMore: false,
    loadMoreError: null,
  }
}

describe('memo-cache type guards', () => {
  it('accepts a well-formed memo', () => {
    expect(isMemo({
      id: 1,
      content: 'hi',
      tags: ['x'],
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      refs: [],
      referencedBy: [],
    })).toBe(true)
  })

  it('rejects malformed memos', () => {
    expect(isMemo(null)).toBe(false)
    expect(isMemo({})).toBe(false)
    expect(isMemo({ id: '1', content: 'x', tags: [], createdAt: '', updatedAt: '' })).toBe(false)
  })

  it('isMemoArray reflects element check', () => {
    expect(isMemoArray([])).toBe(true)
    expect(isMemoArray([{ id: 1 }])).toBe(false)
  })
})

describe('memo-cache filter matching / tag remap', () => {
  const memo = makeMemo({
    id: 1,
    content: '一个想法',
    tags: ['项目/重构'],
    createdAt: '2026-04-21T03:00:00.000Z',
    updatedAt: '2026-04-21T03:00:00.000Z',
  })

  it('matches no filter', () => {
    expect(memoMatchesFilters(memo, {})).toBe(true)
  })

  it('matches by exact tag and prefix', () => {
    expect(memoMatchesFilters(memo, { tag: '项目' })).toBe(true)
    expect(memoMatchesFilters(memo, { tag: '项目/重构' })).toBe(true)
    expect(memoMatchesFilters(memo, { tag: '其他' })).toBe(false)
  })

  it('matches by text contains', () => {
    expect(memoMatchesFilters(memo, { text: { contains: '想' } })).toBe(true)
    expect(memoMatchesFilters(memo, { text: { contains: '不存在' } })).toBe(false)
  })

  it('matches created_at filters by local calendar date near UTC boundaries', () => {
    withTimeZone('Asia/Shanghai', () => {
      const dayBoundaryMemo = makeMemo({
        createdAt: '2026-04-27T16:08:00.000Z',
        updatedAt: '2026-04-27T16:08:00.000Z',
      })
      const monthBoundaryMemo = makeMemo({
        createdAt: '2026-04-30T16:08:00.000Z',
        updatedAt: '2026-04-30T16:08:00.000Z',
      })
      const yearBoundaryMemo = makeMemo({
        createdAt: '2026-12-31T16:08:00.000Z',
        updatedAt: '2026-12-31T16:08:00.000Z',
      })

      expect(memoMatchesFilters(dayBoundaryMemo, {
        created_at: { kind: 'day', year: 2026, month: 4, day: 28 },
      })).toBe(true)
      expect(memoMatchesFilters(dayBoundaryMemo, {
        created_at: { kind: 'day', year: 2026, month: 4, day: 27 },
      })).toBe(false)

      expect(memoMatchesFilters(monthBoundaryMemo, {
        created_at: { kind: 'month', year: 2026, month: 5 },
      })).toBe(true)
      expect(memoMatchesFilters(monthBoundaryMemo, {
        created_at: { kind: 'month', year: 2026, month: 4 },
      })).toBe(false)

      expect(memoMatchesFilters(yearBoundaryMemo, {
        created_at: { kind: 'year', year: 2027 },
      })).toBe(true)
      expect(memoMatchesFilters(yearBoundaryMemo, {
        created_at: { kind: 'year', year: 2026 },
      })).toBe(false)
    })
  })

  it('renames exact tag', () => {
    expect(remapMemoTagPath('a', 'a', 'b')).toBe('b')
  })

  it('renames child tag with prefix', () => {
    expect(remapMemoTagPath('a/x', 'a', 'b')).toBe('b/x')
  })

  it('leaves unrelated tags alone', () => {
    expect(remapMemoTagPath('aa/x', 'a', 'b')).toBe('aa/x')
  })
})

describe('memo-cache page transforms', () => {
  it('prepends new memo to first page when filters match', () => {
    const existing = makeMemo({ id: 1, tags: ['A'] })
    const newMemo = makeMemo({ id: 2, tags: ['A'] })
    const next = prependMemoListData([makePage([existing])], { tag: 'A' }, newMemo)

    expect(next[0].items.map((item) => item.id)).toEqual([2, 1])
    expect(next[0].totalCount).toBe(2)
  })

  it('returns same pages when filters do not match', () => {
    const existing = makeMemo({ id: 1, tags: ['A'] })
    const newMemo = makeMemo({ id: 2, tags: ['B'] })
    const pages = [makePage([existing])]

    expect(prependMemoListData(pages, { tag: 'A' }, newMemo)).toBe(pages)
  })

  it('does not prepend memos into a cached day-filtered list when only the UTC date matches', () => {
    withTimeZone('Asia/Shanghai', () => {
      const existing = makeMemo({ id: 1 })
      const newMemo = makeMemo({
        id: 2,
        createdAt: '2026-04-27T16:08:00.000Z',
        updatedAt: '2026-04-27T16:08:00.000Z',
      })
      const pages = [makePage([existing])]

      expect(prependMemoListData(pages, {
        created_at: { kind: 'day', year: 2026, month: 4, day: 27 },
      }, newMemo)).toBe(pages)
    })
  })

  it('removes filtered-out memos and decrements totalCount', () => {
    const first = makeMemo({ id: 1, tags: ['A'] })
    const second = makeMemo({ id: 2, tags: ['A'] })
    const pages = [makePage([first, second], 2)]
    const next = transformMemoListData(pages, { tag: 'A' }, (memo) =>
      memo.id === 1 ? { ...memo, tags: ['B'] } : memo,
    )

    expect(next[0].items.map((item) => item.id)).toEqual([2])
    expect(next[0].totalCount).toBe(1)
  })
})

describe('memo-cache cross-entry mutations', () => {
  const memo = makeMemo({
    id: 1,
    content: 'a',
    tags: ['项目'],
    createdAt: 't',
    updatedAt: 't',
  })

  it('insertMemoCacheEntry prepends to matching list and skips non-matching', () => {
    const state = emptyState()
    state.memos.list.set('all', entry({}, [memo]))
    state.memos.list.set('other', entry({ tag: 'X' }, []))

    const newMemo = makeMemo({
      id: 2,
      content: 'b',
      tags: ['项目'],
      createdAt: 't',
      updatedAt: 't',
    })

    insertMemoCacheEntry(state, newMemo)

    expect(state.memos.list.get('all')!.pages[0].items.map((item) => item.id)).toEqual([2, 1])
    expect(state.memos.list.get('other')!.pages[0].items.length).toBe(0)
    expect(state.memos.detail.get(2)).toBeTruthy()
  })

  it('syncMemoCacheEntry replaces matching memos in all lists & detail', () => {
    const state = emptyState()
    state.memos.list.set('all', entry({}, [memo]))
    state.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })

    const updated = { ...memo, content: 'updated' }
    syncMemoCacheEntry(state, updated)

    expect(state.memos.list.get('all')!.pages[0].items[0].content).toBe('updated')
    expect(state.memos.detail.get(1)!.memo.content).toBe('updated')
  })

  it('removeMemoCacheEntry drops memo from lists and detail', () => {
    const state = emptyState()
    state.memos.list.set('all', entry({}, [memo]))
    state.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })

    removeMemoCacheEntry(state, 1)

    expect(state.memos.list.get('all')!.pages[0].items.length).toBe(0)
    expect(state.memos.detail.has(1)).toBe(false)
  })

  it('removeMemoCacheEntry prunes deleted memo id from cached refs and backlinks', () => {
    const state = emptyState()
    const referrer = makeMemo({ id: 1, refs: ['2', 'bob/2'] })
    const deleted = makeMemo({ id: 2, refs: ['4'], referencedBy: ['1'] })
    const referenced = makeMemo({ id: 4, referencedBy: ['2', '9', 'bob/2'] })
    state.memos.list.set('all', entry({}, [referrer, deleted, referenced]))
    for (const item of [referrer, deleted, referenced]) {
      state.memos.detail.set(item.id, {
        status: 'success',
        error: null,
        dataUpdatedAt: 1,
        memo: item,
      })
    }

    removeMemoCacheEntry(state, 2)

    expect(state.memos.detail.has(2)).toBe(false)
    expect(state.memos.detail.get(1)?.memo.refs).toEqual(['bob/2'])
    expect(state.memos.detail.get(4)?.memo.referencedBy).toEqual(['9', 'bob/2'])
    expect(state.memos.list.get('all')?.pages[0].items.map((item) => ({
      id: item.id,
      refs: item.refs,
      referencedBy: item.referencedBy,
    }))).toEqual([
      { id: 1, refs: ['bob/2'], referencedBy: [] },
      { id: 4, refs: [], referencedBy: ['9', 'bob/2'] },
    ])
  })

  it('renameMemoTagsInCache remaps detail/list tags and drops old filtered matches', () => {
    const state = emptyState()
    const nestedTagMemo = makeMemo({
      id: 1,
      content: 'a',
      tags: ['项目/重构'],
      createdAt: 't',
      updatedAt: 't',
    })

    state.memos.list.set('all', entry({}, [nestedTagMemo]))
    state.memos.list.set('tag-project', entry({ tag: '项目' }, [nestedTagMemo]))
    state.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo: nestedTagMemo,
    })

    renameMemoTagsInCache(state, '项目', '归档')

    expect(state.memos.detail.get(1)?.memo.tags).toEqual(['归档/重构'])
    expect(state.memos.list.get('all')?.pages[0].items[0].tags).toEqual(['归档/重构'])
    expect(state.memos.list.get('tag-project')?.pages[0].items).toEqual([])
  })
})
