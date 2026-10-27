import { beforeEach, describe, expect, it, vi } from 'vitest'

const clearSession = vi.fn()
const clearVisitorWorkspaceData = vi.fn()
const syncWorkspaceStoreRuntime = vi.fn()

vi.mock('../session', () => ({
  clearSession,
}))

vi.mock('../../store/store-bindings/workspace-store.instance', () => ({
  clearVisitorWorkspaceData,
  syncWorkspaceStoreRuntime,
}))

describe('performLogout', () => {
  beforeEach(() => {
    vi.resetModules()
    clearSession.mockReset()
    clearVisitorWorkspaceData.mockReset()
    syncWorkspaceStoreRuntime.mockReset()
  })

  it('clears session, visitor workspace, and forces runtime sync', async () => {
    const { performLogout } = await import('../logout')

    performLogout()

    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(clearVisitorWorkspaceData).toHaveBeenCalledTimes(1)
    expect(syncWorkspaceStoreRuntime).toHaveBeenCalledWith(true)
  })
})
