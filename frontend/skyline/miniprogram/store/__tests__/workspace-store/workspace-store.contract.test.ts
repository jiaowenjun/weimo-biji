import { describe, expect, it, vi } from 'vitest'
import {
  createEmptyWorkspaceState,
  createWorkspaceStore,
  type WorkspaceServices,
} from '../../workspace-store'

function makePage() {
  return {
    items: [],
    nextCursor: null,
    hasMore: false,
    totalCount: 0,
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

function makeServices(overrides: Partial<WorkspaceServices> = {}): WorkspaceServices {
  return {
    searchMemos: vi.fn().mockResolvedValue(makePage()),
    getMemo: vi.fn(),
    getMemos: vi.fn(),
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

describe('workspaceStore aggregate-resource contract', () => {
  it('dedupes concurrent ensureStats calls', async () => {
    const getStats = vi.fn().mockResolvedValue({
      note_count: 0,
      tag_count: 0,
      word_count: 0,
      daily_note_count: [],
    })
    const store = createWorkspaceStore({
      services: makeServices({ getWorkspaceStats: getStats }),
    })

    await Promise.all([store.ensureStats(), store.ensureStats(), store.ensureStats()])

    expect(getStats).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent ensureTagTree calls', async () => {
    const getTagTree = vi.fn().mockResolvedValue({
      label: 'root',
      tag: '',
      item_count: 0,
      children: [],
    })
    const store = createWorkspaceStore({
      services: makeServices({ getTagTree }),
    })

    await Promise.all([store.ensureTagTree(), store.ensureTagTree()])

    expect(getTagTree).toHaveBeenCalledTimes(1)
  })

  it('refreshStats bypasses freshness and dedupes concurrent refreshes', async () => {
    const getStats = vi.fn()
      .mockResolvedValueOnce({
        note_count: 1,
        tag_count: 1,
        word_count: 10,
        daily_note_count: [],
      })
      .mockResolvedValueOnce({
        note_count: 2,
        tag_count: 1,
        word_count: 20,
        daily_note_count: [],
      })
    const store = createWorkspaceStore({
      services: makeServices({ getWorkspaceStats: getStats }),
    })

    await store.ensureStats()
    await Promise.all([store.refreshStats(), store.refreshStats()])

    expect(getStats).toHaveBeenCalledTimes(2)
    expect(store.getState().stats.data?.note_count).toBe(2)
  })

  it('refreshTagTree bypasses freshness and dedupes concurrent refreshes', async () => {
    const getTagTree = vi.fn()
      .mockResolvedValueOnce({
        label: 'root',
        tag: '',
        item_count: 1,
        children: [{ tag: 'a', label: 'A', item_count: 1, children: [] }],
      })
      .mockResolvedValueOnce({
        label: 'root',
        tag: '',
        item_count: 1,
        children: [{ tag: 'b', label: 'B', item_count: 1, children: [] }],
      })
    const store = createWorkspaceStore({
      services: makeServices({ getTagTree }),
    })

    await store.ensureTagTree()
    await Promise.all([store.refreshTagTree(), store.refreshTagTree()])

    expect(getTagTree).toHaveBeenCalledTimes(2)
    expect(store.getState().tagTree.data?.[0]?.tag).toBe('b')
  })

  it('queues a follow-up stats fetch when refreshStats runs during an inflight ensure', async () => {
    const firstStats = createDeferred<any>()
    const secondStats = createDeferred<any>()
    const getWorkspaceStats = vi.fn()
      .mockReturnValueOnce(firstStats.promise)
      .mockReturnValueOnce(secondStats.promise)
    const store = createWorkspaceStore({
      services: makeServices({ getWorkspaceStats }),
    })

    const ensurePromise = store.ensureStats()
    expect(getWorkspaceStats).toHaveBeenCalledTimes(1)
    expect(store.getState().stats.status).toBe('loading')

    const refreshPromise = store.refreshStats()
    expect(getWorkspaceStats).toHaveBeenCalledTimes(1)
    expect(store.getState().stats.dataUpdatedAt).toBe(0)

    firstStats.resolve({
      note_count: 1,
      tag_count: 1,
      word_count: 10,
      daily_note_count: [],
    })
    await waitForAssertion(() => {
      expect(getWorkspaceStats).toHaveBeenCalledTimes(2)
    })
    expect(store.getState().stats.status).toBe('loading')

    secondStats.resolve({
      note_count: 2,
      tag_count: 1,
      word_count: 20,
      daily_note_count: [],
    })
    await Promise.all([ensurePromise, refreshPromise])

    expect(store.getState().stats.data?.note_count).toBe(2)
  })

  it('notifies listeners on state change', async () => {
    const store = createWorkspaceStore({
      services: makeServices(),
    })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    await store.ensureMemoList('k', {}, 8)

    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2)
    unsubscribe()
  })

  it('replaceRuntime swaps state and services and emits once', async () => {
    const firstSearch = vi.fn().mockResolvedValue(makePage())
    const secondSearch = vi.fn().mockResolvedValue(makePage())
    const store = createWorkspaceStore({
      services: makeServices({ searchMemos: firstSearch }),
    })
    const listener = vi.fn()
    store.subscribe(listener)

    const nextState = createEmptyWorkspaceState()
    nextState.stats = {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      data: { note_count: 3, tag_count: 2, word_count: 10, daily_note_count: [] },
    }

    store.replaceRuntime({
      services: makeServices({ searchMemos: secondSearch }),
      state: nextState,
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().stats.data?.note_count).toBe(3)

    await store.ensureMemoList('k', {}, 8)
    expect(firstSearch).not.toHaveBeenCalled()
    expect(secondSearch).toHaveBeenCalledTimes(1)
  })
})
