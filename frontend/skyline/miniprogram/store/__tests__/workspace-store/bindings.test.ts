import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceStore, type WorkspaceServices } from '../../workspace-store'
import { bindMemoList } from '../../store-bindings/bind-memo-list'
import { bindTagTree } from '../../store-bindings/bind-tag-tree'
import { bindWorkspaceStats } from '../../store-bindings/bind-workspace-stats'

function makePage() {
  return { items: [], nextCursor: null, hasMore: false, totalCount: 0 }
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

describe('store selector bindings', () => {
  it('bindMemoList keeps listKey and skips onChange when the entry reference is unchanged', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureMemoList('k', {}, 8)
    const onChange = vi.fn()

    const binding = bindMemoList('k', onChange, store)

    expect(binding.listKey).toBe('k')
    expect(onChange).toHaveBeenCalledTimes(1)

    await store.ensureStats()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('bindMemoList fires onChange when the list entry reference changes', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureMemoList('k', {}, 8)
    const onChange = vi.fn()

    bindMemoList('k', onChange, store)
    await store.refreshMemoList('k')

    expect(onChange.mock.calls.length).toBeGreaterThan(1)
  })

  it('bindMemoList unsubscribe stops further onChange notifications', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureMemoList('k', {}, 8)
    const onChange = vi.fn()

    const binding = bindMemoList('k', onChange, store)
    binding.unsubscribe()
    await store.refreshMemoList('k')

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('bindWorkspaceStats only fires when the stats entry reference changes', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureStats()
    const onChange = vi.fn()

    bindWorkspaceStats(onChange, store)
    await store.ensureTagTree()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('bindWorkspaceStats fires when the stats entry reference changes', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureStats()
    const onChange = vi.fn()

    bindWorkspaceStats(onChange, store)
    await store.refreshStats()

    expect(onChange.mock.calls.length).toBeGreaterThan(1)
  })

  it('bindTagTree only fires when the tag tree entry reference changes', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureTagTree()
    const onChange = vi.fn()

    bindTagTree(onChange, store)
    await store.ensureStats()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('bindTagTree fires when the tag tree entry reference changes', async () => {
    const store = createWorkspaceStore({ services: makeServices() })
    await store.ensureTagTree()
    const onChange = vi.fn()

    bindTagTree(onChange, store)
    await store.refreshTagTree()

    expect(onChange.mock.calls.length).toBeGreaterThan(1)
  })
})
