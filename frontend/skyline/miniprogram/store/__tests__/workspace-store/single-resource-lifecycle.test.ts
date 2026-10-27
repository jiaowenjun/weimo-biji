import { describe, expect, it, vi } from 'vitest'
import { createSingleResourceLifecycle } from '../../workspace-core/single-resource-lifecycle'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeEntry() {
  return { status: 'idle', error: null, dataUpdatedAt: 0, data: null as number | null }
}

describe('createSingleResourceLifecycle', () => {
  it('dedupes concurrent ensure calls while the entry is stale', async () => {
    const state = {
      entry: makeEntry(),
      inflight: null as Promise<void> | null,
      pending: null as 'refresh' | 'invalidate' | null,
      source: null as 'ensure' | 'refresh' | 'invalidate' | null,
      version: 0,
    }
    const fetch = vi.fn().mockResolvedValue(1)
    const emit = vi.fn()

    const lifecycle = createSingleResourceLifecycle({
      getEntry: () => state.entry,
      setEntry: (entry) => {
        state.entry = entry
      },
      getInflight: () => state.inflight,
      setInflight: (value) => {
        state.inflight = value
      },
      getPendingCause: () => state.pending,
      setPendingCause: (value) => {
        state.pending = value
      },
      getInflightSource: () => state.source,
      setInflightSource: (value) => {
        state.source = value
      },
      isFresh: (entry) => entry.dataUpdatedAt > 0,
      invalidateEntry: () => {
        state.entry = { ...state.entry, dataUpdatedAt: 0 }
      },
      fetchOnce: async (runtimeVersion) => {
        state.entry = { ...state.entry, status: 'loading', error: null }
        emit()
        const data = await fetch(runtimeVersion)
        if (state.version !== runtimeVersion) return
        state.entry = { status: 'success', error: null, dataUpdatedAt: 1, data }
        emit()
      },
      emit,
      getRuntimeVersion: () => state.version,
      isRuntimeCurrent: (runtimeVersion) => state.version === runtimeVersion,
    })

    await Promise.all([lifecycle.ensure(), lifecycle.ensure(), lifecycle.ensure()])

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(state.entry.data).toBe(1)
  })

  it('queues one follow-up fetch when refresh is requested during an inflight ensure', async () => {
    const first = createDeferred<number>()
    const second = createDeferred<number>()
    const state = {
      entry: makeEntry(),
      inflight: null as Promise<void> | null,
      pending: null as 'refresh' | 'invalidate' | null,
      source: null as 'ensure' | 'refresh' | 'invalidate' | null,
      version: 0,
    }
    const emit = vi.fn()
    const fetch = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const lifecycle = createSingleResourceLifecycle({
      getEntry: () => state.entry,
      setEntry: (entry) => {
        state.entry = entry
      },
      getInflight: () => state.inflight,
      setInflight: (value) => {
        state.inflight = value
      },
      getPendingCause: () => state.pending,
      setPendingCause: (value) => {
        state.pending = value
      },
      getInflightSource: () => state.source,
      setInflightSource: (value) => {
        state.source = value
      },
      isFresh: (entry) => entry.dataUpdatedAt > 0,
      invalidateEntry: () => {
        state.entry = { ...state.entry, dataUpdatedAt: 0 }
      },
      fetchOnce: async (runtimeVersion) => {
        state.entry = { ...state.entry, status: 'loading', error: null }
        emit()
        const data = await fetch(runtimeVersion)
        if (state.version !== runtimeVersion) return
        state.entry = { status: 'success', error: null, dataUpdatedAt: data, data }
        emit()
      },
      emit,
      getRuntimeVersion: () => state.version,
      isRuntimeCurrent: (runtimeVersion) => state.version === runtimeVersion,
    })

    const ensurePromise = lifecycle.ensure()
    const refreshPromise = lifecycle.refresh()

    first.resolve(1)
    await Promise.resolve()
    await Promise.resolve()
    second.resolve(2)
    await Promise.all([ensurePromise, refreshPromise])

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(state.entry.data).toBe(2)
  })

  it('upgrades the pending cause to invalidate when a mutation lands during an inflight refresh', async () => {
    const first = createDeferred<number>()
    const second = createDeferred<number>()
    const state = {
      entry: makeEntry(),
      inflight: null as Promise<void> | null,
      pending: null as 'refresh' | 'invalidate' | null,
      source: null as 'ensure' | 'refresh' | 'invalidate' | null,
      version: 0,
    }
    const emit = vi.fn()
    const fetch = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const lifecycle = createSingleResourceLifecycle({
      getEntry: () => state.entry,
      setEntry: (entry) => {
        state.entry = entry
      },
      getInflight: () => state.inflight,
      setInflight: (value) => {
        state.inflight = value
      },
      getPendingCause: () => state.pending,
      setPendingCause: (value) => {
        state.pending = value
      },
      getInflightSource: () => state.source,
      setInflightSource: (value) => {
        state.source = value
      },
      isFresh: (entry) => entry.dataUpdatedAt > 0,
      invalidateEntry: () => {
        state.entry = { ...state.entry, dataUpdatedAt: 0 }
      },
      fetchOnce: async (runtimeVersion) => {
        state.entry = { ...state.entry, status: 'loading', error: null }
        emit()
        const data = await fetch(runtimeVersion)
        if (state.version !== runtimeVersion) return
        state.entry = { status: 'success', error: null, dataUpdatedAt: data, data }
        emit()
      },
      emit,
      getRuntimeVersion: () => state.version,
      isRuntimeCurrent: (runtimeVersion) => state.version === runtimeVersion,
    })

    const refreshPromise = lifecycle.refresh()
    lifecycle.invalidateFromMutation()

    first.resolve(1)
    await Promise.resolve()
    await Promise.resolve()
    second.resolve(2)
    await refreshPromise

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(state.entry.data).toBe(2)
  })
})
