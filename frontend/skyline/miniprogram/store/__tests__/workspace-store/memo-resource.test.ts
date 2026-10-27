import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyWorkspaceState,
  createWorkspaceStore,
  type WorkspaceServices,
} from '../../workspace-store'
import type { Memo, MemoSearchPage } from '../../../models/memo'

function makePage(overrides: Partial<MemoSearchPage> = {}): MemoSearchPage {
  return {
    items: [],
    nextCursor: null,
    hasMore: false,
    totalCount: 0,
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function waitForAssertion(assertion: () => void, attempts = 20) {
  let lastError: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      assertion()
      return
    } catch (err) {
      lastError = err
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  throw lastError
}

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const ts = '2026-04-21T00:00:00Z'
  return {
    id,
    content: `memo-${id}`,
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function makeServices(overrides: Partial<WorkspaceServices> = {}): WorkspaceServices {
  return {
    searchMemos: vi.fn().mockResolvedValue(makePage()),
    getMemo: vi.fn().mockImplementation((id: number) => Promise.resolve(makeMemo(id))),
    getMemos: vi.fn().mockImplementation((ids: number[]) => Promise.resolve(ids.map((id) => makeMemo(id)))),
    getWorkspaceStats: vi.fn().mockResolvedValue({
      note_count: 0,
      tag_count: 0,
      word_count: 0,
      daily_note_count: [],
    }),
    getTagTree: vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 0,
      children: [],
    }),
    createMemo: vi.fn(),
    updateMemo: vi.fn(),
    deleteMemo: vi.fn(),
    renameTag: vi.fn(),
    ...overrides,
  }
}

describe('workspaceStore memo list contract', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dedupes concurrent ensures by listKey', async () => {
    const search = vi.fn().mockResolvedValue(makePage())
    const store = createWorkspaceStore({
      services: {
        searchMemos: search,
        getMemo: vi.fn(),
        getMemos: vi.fn(),
        getWorkspaceStats: vi.fn(),
        getTagTree: vi.fn(),
        createMemo: vi.fn(),
        updateMemo: vi.fn(),
        deleteMemo: vi.fn(),
        renameTag: vi.fn(),
      },
    })

    const a = store.ensureMemoList('memos:list:8:{}', {}, 8)
    const b = store.ensureMemoList('memos:list:8:{}', {}, 8)
    await Promise.all([a, b])

    expect(search).toHaveBeenCalledTimes(1)
  })

  it('fetches uncached memo detail by id and writes it to detail cache', async () => {
    const fetched = makeMemo(7, { content: 'detail', refs: ['1'], referencedBy: ['9'] })
    const getMemo = vi.fn().mockResolvedValue(fetched)
    const store = createWorkspaceStore({
      services: makeServices({ getMemo }),
    })

    const memo = await store.ensureMemoDetail(7)

    expect(getMemo).toHaveBeenCalledWith(7)
    expect(memo).toBe(fetched)
    expect(store.getState().memos.detail.get(7)?.memo).toBe(fetched)
  })

  it('batch-fetches only missing memo details and preserves requested order', async () => {
    const cached = makeMemo(1, { content: 'cached' })
    const fetched = makeMemo(2, { content: 'fetched' })
    const getMemos = vi.fn().mockResolvedValue([fetched])
    const initialState = createEmptyWorkspaceState()
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: Date.now(),
      memo: cached,
    })
    const store = createWorkspaceStore({
      initialState,
      services: makeServices({ getMemos }),
    })

    const memos = await store.ensureMemoDetails([1, 2])

    expect(getMemos).toHaveBeenCalledWith([2])
    expect(memos.map((memo) => memo.id)).toEqual([1, 2])
    expect(store.getState().memos.detail.get(2)?.memo).toBe(fetched)
  })

  it('skips request when entry is fresh', async () => {
    const search = vi.fn().mockResolvedValue(makePage())
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search }),
    })

    await store.ensureMemoList('k', {}, 8)
    await store.ensureMemoList('k', {}, 8)

    expect(search).toHaveBeenCalledTimes(1)
  })

  it('ignores stale pending requests after replaceRuntime', async () => {
    const pending = createDeferred<MemoSearchPage>()
    const firstSearch = vi.fn().mockReturnValue(pending.promise)
    const secondSearch = vi.fn().mockResolvedValue(makePage())
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: firstSearch }),
    })

    const firstEnsure = store.ensureMemoList('k', {}, 8)
    expect(store.getState().memos.list.get('k')?.status).toBe('loading')

    const nextState = createEmptyWorkspaceState()
    nextState.stats = {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      data: { note_count: 7, tag_count: 1, word_count: 20, daily_note_count: [] },
    }
    store.replaceRuntime({
      services: makeServices({ searchMemos: secondSearch }),
      state: nextState,
    })

    pending.resolve(makePage({
      items: [makeMemo(11)],
      totalCount: 1,
    }))

    await expect(firstEnsure).resolves.toBeUndefined()
    expect(store.getState()).toBe(nextState)
    expect(store.getState().stats.data?.note_count).toBe(7)
    expect(store.getState().memos.list.size).toBe(0)
    expect(store.getState().memos.detail.size).toBe(0)

    await store.ensureMemoList('k', {}, 8)
    expect(firstSearch).toHaveBeenCalledTimes(1)
    expect(secondSearch).toHaveBeenCalledTimes(1)
  })

  it('appends next page and clears loadMore flags on success', async () => {
    const search = vi.fn()
      .mockResolvedValueOnce(makePage({
        items: [makeMemo(1)],
        nextCursor: 'page-2',
        hasMore: true,
        totalCount: 2,
      }))
      .mockResolvedValueOnce(makePage({
        items: [makeMemo(2)],
        nextCursor: null,
        hasMore: false,
        totalCount: 2,
      }))
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search }),
    })

    await store.ensureMemoList('k', {}, 8)
    await store.loadMoreMemoList('k')

    const entry = store.getState().memos.list.get('k')!
    expect(search).toHaveBeenNthCalledWith(2, {}, 'page-2', 8)
    expect(entry.isLoadingMore).toBe(false)
    expect(entry.loadMoreError).toBe(null)
    expect(entry.pages).toHaveLength(2)
    expect(entry.pages[1]?.items.map((memo) => memo.id)).toEqual([2])
  })

  it('records loadMoreError and keeps existing pages when load more fails', async () => {
    const search = vi.fn()
      .mockResolvedValueOnce(makePage({
        items: [makeMemo(1)],
        nextCursor: 'page-2',
        hasMore: true,
        totalCount: 2,
      }))
      .mockRejectedValueOnce(new Error('load-more-boom'))
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search }),
    })

    await store.ensureMemoList('k', {}, 8)
    await store.loadMoreMemoList('k')

    const entry = store.getState().memos.list.get('k')!
    expect(entry.isLoadingMore).toBe(false)
    expect(entry.loadMoreError).toBe('load-more-boom')
    expect(entry.pages).toHaveLength(1)
    expect(entry.pages[0]?.items.map((memo) => memo.id)).toEqual([1])
  })
})

describe('workspaceStore memo mutation contract', () => {
  it('updates referencedBy on cached source memos after creating a quoting memo', async () => {
    const source = makeMemo(7, { content: 'A', tags: ['Source'] })
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: vi.fn().mockResolvedValue(makePage({
          items: [source],
          totalCount: 1,
        })),
        createMemo: vi.fn().mockResolvedValue(99),
      }),
    })

    await store.ensureMemoList('k', {}, 8)
    const memo = await store.createMemo({ content: 'B quotes A', tags: ['Reply'], refs: ['7'] })

    expect(memo.referencedBy).toEqual([])
    expect(store.getState().memos.detail.get(99)?.memo.refs).toEqual(['7'])
    expect(store.getState().memos.detail.get(7)?.memo.referencedBy).toEqual(['99'])
    const cachedSource = store.getState().memos.list.get('k')?.pages[0]?.items
      .find((item) => item.id === 7)
    expect(cachedSource?.referencedBy).toEqual(['99'])
  })

  it('does not create local backlinks for friend refs', async () => {
    const ownMemoWithSameId = makeMemo(7, { content: 'local 7' })
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: vi.fn().mockResolvedValue(makePage({
          items: [ownMemoWithSameId],
          totalCount: 1,
        })),
        createMemo: vi.fn().mockResolvedValue(99),
      }),
    })

    await store.ensureMemoList('k', {}, 8)
    const memo = await store.createMemo({ content: 'quotes friend', tags: [], refs: ['bob/7'] })

    expect(memo.refs).toEqual(['bob/7'])
    expect(store.getState().memos.detail.get(7)?.memo.referencedBy).toEqual([])
  })

  it('moves referencedBy backlinks when updateMemo changes refs', async () => {
    const sourceA = makeMemo(1, { referencedBy: ['5'] })
    const sourceB = makeMemo(2)
    const quote = makeMemo(5, { refs: ['1'], referencedBy: ['8'] })
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: vi.fn().mockResolvedValue(makePage({
          items: [sourceA, sourceB, quote],
          totalCount: 3,
        })),
        updateMemo: vi.fn().mockResolvedValue(5),
      }),
    })

    await store.ensureMemoList('k', {}, 8)
    const updated = await store.updateMemo(5, { content: 'retarget', tags: [], refs: ['2'] })

    expect(updated.refs).toEqual(['2'])
    expect(updated.referencedBy).toEqual(['8'])
    expect(store.getState().memos.detail.get(1)?.memo.referencedBy).toEqual([])
    expect(store.getState().memos.detail.get(2)?.memo.referencedBy).toEqual(['5'])
    expect(store.getState().memos.list.get('k')?.pages[0]?.items.map((memo) => ({
      id: memo.id,
      referencedBy: memo.referencedBy,
    }))).toEqual([
      { id: 1, referencedBy: [] },
      { id: 2, referencedBy: ['5'] },
      { id: 5, referencedBy: ['8'] },
    ])
  })

  it('stores refs on locally-created memos', async () => {
    const store = createWorkspaceStore({
      services: makeServices({
        createMemo: vi.fn().mockResolvedValue(99),
      }),
    })

    const memo = await store.createMemo({ content: 'B quotes A', tags: ['Work'], refs: ['7'] })

    expect(memo.refs).toEqual(['7'])
    expect(store.getState().memos.detail.get(99)?.memo.refs).toEqual(['7'])
  })

  it('preserves existing refs when updateMemo payload omits refs', async () => {
    const existing = makeMemo(3, { content: 'old', tags: ['Work'], refs: ['1'] })
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: vi.fn().mockResolvedValue(makePage({
          items: [existing],
          totalCount: 1,
        })),
        updateMemo: vi.fn().mockResolvedValue(3),
      }),
    })

    await store.ensureMemoList('k', {}, 8)
    const memo = await store.updateMemo(3, { content: 'new', tags: ['Work'] })

    expect(memo.refs).toEqual(['1'])
    expect(store.getState().memos.detail.get(3)?.memo.refs).toEqual(['1'])
    expect(store.getState().memos.list.get('k')?.pages[0]?.items[0]?.refs).toEqual(['1'])
  })

  it('replaces refs when updateMemo payload includes refs', async () => {
    const existing = makeMemo(4, { content: 'old', tags: ['Work'], refs: ['1'] })
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: vi.fn().mockResolvedValue(makePage({
          items: [existing],
          totalCount: 1,
        })),
        updateMemo: vi.fn().mockResolvedValue(4),
      }),
    })

    await store.ensureMemoList('k', {}, 8)
    const memo = await store.updateMemo(4, { content: 'new', tags: ['Work'], refs: ['2'] })

    expect(memo.refs).toEqual(['2'])
    expect(store.getState().memos.detail.get(4)?.memo.refs).toEqual(['2'])
  })

  it('writes created memo through to all matching list caches', async () => {
    const search = vi.fn().mockResolvedValue(makePage())
    const store = createWorkspaceStore({
      services: makeServices({
        searchMemos: search,
        createMemo: vi.fn().mockResolvedValue(99),
      }),
    })

    await store.ensureMemoList('k', { tag: 'A' }, 8)
    const memo = await store.createMemo({ content: 'hi', tags: ['A/x'] })
    const list = store.getState().memos.list.get('k')!

    expect(list.pages[0]?.items[0]?.id).toBe(memo.id)
    expect(store.getState().stats.dataUpdatedAt).toBe(0)
  })

  it('queues a follow-up tag tree fetch when createMemo invalidates it during an inflight ensure', async () => {
    const firstTagTree = createDeferred<any>()
    const secondTagTree = createDeferred<any>()
    const getTagTree = vi.fn()
      .mockReturnValueOnce(firstTagTree.promise)
      .mockReturnValueOnce(secondTagTree.promise)
    const store = createWorkspaceStore({
      services: makeServices({
        getTagTree,
        createMemo: vi.fn().mockResolvedValue(99),
      }),
    })

    const ensurePromise = store.ensureTagTree()
    expect(getTagTree).toHaveBeenCalledTimes(1)
    expect(store.getState().tagTree.status).toBe('loading')

    await store.createMemo({ content: 'hello', tags: ['A/x'] })

    expect(store.getState().tagTree.dataUpdatedAt).toBe(0)
    expect(getTagTree).toHaveBeenCalledTimes(1)

    firstTagTree.resolve({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: 'old', label: 'Old', item_count: 1, children: [] }],
    })
    await waitForAssertion(() => {
      expect(getTagTree).toHaveBeenCalledTimes(2)
    })
    expect(store.getState().tagTree.status).toBe('loading')

    secondTagTree.resolve({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: 'new', label: 'New', item_count: 1, children: [] }],
    })
    await ensurePromise

    expect(store.getState().tagTree.data?.[0]?.tag).toBe('new')
  })

  it('updates memo cache and refreshes stats without refreshing tagTree when tag set is unchanged', async () => {
    const getWorkspaceStats = vi.fn().mockResolvedValue({
      note_count: 1,
      tag_count: 1,
      word_count: 10,
      daily_note_count: [],
    })
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: 'A', label: 'A', item_count: 1, children: [] }],
    })
    const initialState = createEmptyWorkspaceState()
    const memo = makeMemo(1, { tags: ['A/x'] })
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
    initialState.memos.list.set('all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      filters: {},
      pageSize: 8,
      pages: [makePage({ items: [memo], totalCount: 1 })],
      isLoadingMore: false,
      loadMoreError: null,
    })

    const store = createWorkspaceStore({
      services: makeServices({
        updateMemo: vi.fn().mockResolvedValue(1),
        getWorkspaceStats,
        getTagTree,
      }),
      initialState,
    })

    const updated = await store.updateMemo(1, { content: 'memo-1 updated', tags: ['A/x'] })

    expect(updated.tags).toEqual(['A/x'])
    expect(store.getState().memos.detail.get(1)?.memo.content).toBe('memo-1 updated')
    expect(store.getState().memos.list.get('all')?.pages[0]?.items[0]?.content).toBe('memo-1 updated')

    await waitForAssertion(() => {
      expect(getWorkspaceStats).toHaveBeenCalledTimes(1)
    })
    expect(getTagTree).not.toHaveBeenCalled()
  })

  it('updates memo cache and refreshes tagTree when tag set changes', async () => {
    const getWorkspaceStats = vi.fn().mockResolvedValue({
      note_count: 1,
      tag_count: 1,
      word_count: 10,
      daily_note_count: [],
    })
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: 'B', label: 'B', item_count: 1, children: [] }],
    })
    const initialState = createEmptyWorkspaceState()
    const memo = makeMemo(1, { tags: ['A/x'] })
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
    initialState.memos.list.set('all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      filters: {},
      pageSize: 8,
      pages: [makePage({ items: [memo], totalCount: 1 })],
      isLoadingMore: false,
      loadMoreError: null,
    })

    const store = createWorkspaceStore({
      services: makeServices({
        updateMemo: vi.fn().mockResolvedValue(1),
        getWorkspaceStats,
        getTagTree,
      }),
      initialState,
    })

    const updated = await store.updateMemo(1, { content: 'memo-1 updated', tags: ['B/y'] })

    expect(updated.tags).toEqual(['B/y'])
    expect(store.getState().memos.detail.get(1)?.memo.tags).toEqual(['B/y'])
    expect(store.getState().memos.list.get('all')?.pages[0]?.items[0]?.tags).toEqual(['B/y'])

    await waitForAssertion(() => {
      expect(getWorkspaceStats).toHaveBeenCalledTimes(1)
      expect(getTagTree).toHaveBeenCalledTimes(1)
    })
  })

  it('removes memo cache immediately after deleteMemo succeeds', async () => {
    const getWorkspaceStats = vi.fn().mockResolvedValue({
      note_count: 0,
      tag_count: 0,
      word_count: 0,
      daily_note_count: [],
    })
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 0,
      children: [],
    })
    const initialState = createEmptyWorkspaceState()
    const memo = makeMemo(1, { tags: ['A/x'] })
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
    initialState.memos.list.set('all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      filters: {},
      pageSize: 8,
      pages: [makePage({ items: [memo], totalCount: 1 })],
      isLoadingMore: false,
      loadMoreError: null,
    })
    const store = createWorkspaceStore({
      services: makeServices({
        deleteMemo: vi.fn().mockResolvedValue(1),
        getWorkspaceStats,
        getTagTree,
      }),
      initialState,
    })

    await store.deleteMemo(1)

    expect(store.getState().memos.detail.has(1)).toBe(false)
    expect(store.getState().memos.list.get('all')?.pages[0]?.items).toEqual([])
    await waitForAssertion(() => {
      expect(getWorkspaceStats).toHaveBeenCalledTimes(1)
      expect(getTagTree).toHaveBeenCalledTimes(1)
    })
  })
})

describe('workspaceStore.deleteMemoWithExitAnimation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('marks exitingMemoIds before awaiting service and removes after exitMs', async () => {
    const m1 = makeMemo(1)
    const m2 = makeMemo(2)
    const search = vi.fn().mockResolvedValue(makePage({
      items: [m1, m2],
      totalCount: 2,
    }))
    const deleteMemo = vi.fn().mockResolvedValue(1)
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search, deleteMemo }),
    })
    await store.ensureMemoList('k', {}, 8)

    const promise = store.deleteMemoWithExitAnimation(1, 200)

    expect(store.getState().exitingMemoIds.has(1)).toBe(true)
    expect(store.getState().memos.list.get('k')!.pages[0]!.items.map((memo) => memo.id))
      .toEqual([1, 2])

    await Promise.resolve()
    await Promise.resolve()
    expect(deleteMemo).toHaveBeenCalledWith(1)
    expect(store.getState().memos.list.get('k')!.pages[0]!.items.map((memo) => memo.id))
      .toEqual([1, 2])
    expect(store.getState().exitingMemoIds.has(1)).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    await promise

    expect(store.getState().exitingMemoIds.has(1)).toBe(false)
    expect(store.getState().memos.list.get('k')!.pages[0]!.items.map((memo) => memo.id))
      .toEqual([2])
  })

  it('rolls back exitingMemoIds and keeps cache when service rejects', async () => {
    const m1 = makeMemo(1)
    const search = vi.fn().mockResolvedValue(makePage({
      items: [m1],
      totalCount: 1,
    }))
    const deleteMemo = vi.fn().mockRejectedValue(new Error('boom'))
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search, deleteMemo }),
    })
    await store.ensureMemoList('k', {}, 8)

    await expect(store.deleteMemoWithExitAnimation(1, 200)).rejects.toThrow('boom')

    expect(store.getState().exitingMemoIds.has(1)).toBe(false)
    expect(store.getState().memos.list.get('k')!.pages[0]!.items.map((memo) => memo.id))
      .toEqual([1])
  })

  it('replaces list entry reference when marking exit so bind-memo-list short-circuit lets the emit through', async () => {
    const m1 = makeMemo(1)
    const m2 = makeMemo(2)
    const search = vi.fn().mockResolvedValue(makePage({
      items: [m1, m2],
      totalCount: 2,
    }))
    const deleteMemo = vi.fn().mockResolvedValue(1)
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search, deleteMemo }),
    })
    await store.ensureMemoList('k', {}, 8)

    const entryBefore = store.getState().memos.list.get('k')!
    const seen: Array<typeof entryBefore | undefined> = []
    store.subscribe(() => {
      seen.push(store.getState().memos.list.get('k'))
    })

    void store.deleteMemoWithExitAnimation(1, 200)
    await Promise.resolve()

    const entryAfter = store.getState().memos.list.get('k')!
    expect(entryAfter).not.toBe(entryBefore)
    expect(entryAfter.pages[0]?.items.map((memo) => memo.id)).toEqual([1, 2])
    expect(seen.some((entry) => entry === entryAfter)).toBe(true)
  })

  it('replaces list entry reference when rolling back exit on service failure', async () => {
    const m1 = makeMemo(1)
    const search = vi.fn().mockResolvedValue(makePage({
      items: [m1],
      totalCount: 1,
    }))
    const deleteMemo = vi.fn().mockRejectedValue(new Error('boom'))
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search, deleteMemo }),
    })
    await store.ensureMemoList('k', {}, 8)

    const entryBeforeMark = store.getState().memos.list.get('k')!
    const seen: Array<typeof entryBeforeMark | undefined> = []
    store.subscribe(() => {
      seen.push(store.getState().memos.list.get('k'))
    })

    await expect(store.deleteMemoWithExitAnimation(1, 200)).rejects.toThrow('boom')

    const uniqueRefs = new Set(seen)
    expect(uniqueRefs.size).toBeGreaterThanOrEqual(2)
    expect(store.getState().exitingMemoIds.has(1)).toBe(false)
  })

  it('removes immediately without waiting when exitMs <= 0', async () => {
    const m1 = makeMemo(1)
    const search = vi.fn().mockResolvedValue(makePage({
      items: [m1],
      totalCount: 1,
    }))
    const deleteMemo = vi.fn().mockResolvedValue(1)
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: search, deleteMemo }),
    })
    await store.ensureMemoList('k', {}, 8)

    await store.deleteMemoWithExitAnimation(1, 0)

    expect(store.getState().exitingMemoIds.has(1)).toBe(false)
    expect(store.getState().memos.list.get('k')!.pages[0]!.items).toEqual([])
  })
})

describe('workspaceStore.renameTag', () => {
  it('renames cached tags and refreshes tagTree without refreshing stats', async () => {
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: '归档', label: '归档', item_count: 1, children: [] }],
    })
    const renameTag = vi.fn().mockResolvedValue('归档')
    const getWorkspaceStats = vi.fn().mockResolvedValue({ note_count: 1 } as any)

    const initialState = createEmptyWorkspaceState()
    const memo = makeMemo(1, { tags: ['项目/重构'] })
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
    initialState.memos.list.set('all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      filters: {},
      pageSize: 8,
      pages: [makePage({ items: [memo], totalCount: 1 })],
      isLoadingMore: false,
      loadMoreError: null,
    })

    const store = createWorkspaceStore({
      services: makeServices({ renameTag, getTagTree, getWorkspaceStats }),
      initialState,
    })

    const result = await store.renameTag('项目', '归档')

    expect(result).toBe('归档')
    expect(renameTag).toHaveBeenCalledWith('项目', '归档')
    expect(store.getState().memos.detail.get(1)?.memo.tags).toEqual(['归档/重构'])

    await waitForAssertion(() => {
      expect(getTagTree).toHaveBeenCalledTimes(1)
    })

    expect(getWorkspaceStats).not.toHaveBeenCalled()
  })

  it('uses the requested new tag instead of the service ack when remapping cache', async () => {
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 1,
      children: [{ tag: '归档', label: '归档', item_count: 1, children: [] }],
    })
    const renameTag = vi.fn().mockResolvedValue('ok')
    const getWorkspaceStats = vi.fn().mockResolvedValue({ note_count: 1 } as any)

    const initialState = createEmptyWorkspaceState()
    const memo = makeMemo(1, { tags: ['项目/重构'] })
    initialState.memos.detail.set(1, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
    initialState.memos.list.set('all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      filters: {},
      pageSize: 8,
      pages: [makePage({ items: [memo], totalCount: 1 })],
      isLoadingMore: false,
      loadMoreError: null,
    })

    const store = createWorkspaceStore({
      services: makeServices({ renameTag, getTagTree, getWorkspaceStats }),
      initialState,
    })

    const result = await store.renameTag('项目', '归档')

    expect(store.getState().memos.detail.get(1)?.memo.tags).toEqual(['归档/重构'])
    expect(store.getState().memos.list.get('all')?.pages[0]?.items[0]?.tags)
      .toEqual(['归档/重构'])
    expect(result).toBe('归档')
    expect(renameTag).toHaveBeenCalledWith('项目', '归档')

    await waitForAssertion(() => {
      expect(getTagTree).toHaveBeenCalledTimes(1)
    })

    expect(getWorkspaceStats).not.toHaveBeenCalled()
  })
})
