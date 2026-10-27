import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveWorkspaceSnapshot = vi.fn()
const clearWorkspaceSnapshot = vi.fn()
const subscribe = vi.fn()
const getState = vi.fn()
const replaceRuntime = vi.fn()

vi.mock('../../workspace-storage', () => ({
  saveWorkspaceSnapshot,
  clearWorkspaceSnapshot,
}))

vi.mock('../../workspace-runtime', () => ({
  resolveWorkspaceRuntime: () => ({
    mode: 'visitor',
    state: {
      memos: { detail: new Map(), list: new Map() },
      stats: { status: 'idle', error: null, dataUpdatedAt: 0, data: null },
      tagTree: { status: 'idle', error: null, dataUpdatedAt: 0, data: null },
      exitingMemoIds: new Set(),
    },
    services: {} as any,
  }),
}))

vi.mock('../../workspace-store', () => ({
  createWorkspaceStore: () => ({
    getState,
    subscribe,
    replaceRuntime,
  }),
}))

describe('workspace-store.instance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    subscribe.mockReset()
    getState.mockReset()
    replaceRuntime.mockReset()
    saveWorkspaceSnapshot.mockReset()
    clearWorkspaceSnapshot.mockReset()
  })

  it('coalesces rapid store emissions into one snapshot save', async () => {
    getState.mockReturnValue({ marker: 1 })
    let listener!: () => void
    subscribe.mockImplementation((next) => {
      listener = next
      return () => {}
    })

    await import('../../store-bindings/workspace-store.instance')
    listener()
    listener()
    listener()

    expect(saveWorkspaceSnapshot).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(50)

    expect(saveWorkspaceSnapshot).toHaveBeenCalledTimes(1)
    expect(saveWorkspaceSnapshot).toHaveBeenCalledWith('visitor', { marker: 1 })
  })

  it('still clears only the visitor snapshot explicitly', async () => {
    subscribe.mockImplementation(() => () => {})
    const mod = await import('../../store-bindings/workspace-store.instance')

    mod.clearVisitorWorkspaceData()

    expect(clearWorkspaceSnapshot).toHaveBeenCalledWith('visitor')
  })
})
