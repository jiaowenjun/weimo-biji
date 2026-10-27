import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo, MemoSearchPage } from '../../models/memo'
import { createEmptyWorkspaceState } from '../workspace-store'
import {
  clearWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from '../workspace-storage'

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const ts = '2026-04-21T00:00:00Z'
  return {
    id,
    content: `memo-${id}`,
    tags: ['tag/a'],
    createdAt: ts,
    updatedAt: ts,
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function makePage(items: Memo[]): MemoSearchPage {
  return {
    items,
    nextCursor: null,
    hasMore: false,
    totalCount: items.length,
  }
}

describe('workspace-storage', () => {
  const storage = new Map<string, unknown>()
  const getStorageSync = vi.fn((key: string) => storage.get(key))
  const setStorageSync = vi.fn((key: string, value: unknown) => {
    storage.set(key, value)
  })
  const removeStorageSync = vi.fn((key: string) => {
    storage.delete(key)
  })

  beforeEach(() => {
    storage.clear()
    getStorageSync.mockClear()
    setStorageSync.mockClear()
    removeStorageSync.mockClear()
    ;(globalThis as any).wx = {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
    }
  })

  it('round-trips authenticated snapshots', () => {
    const state = createEmptyWorkspaceState()
    const memo = makeMemo(1)
    state.memos.detail.set(memo.id, {
      status: 'success',
      error: null,
      dataUpdatedAt: 101,
      memo,
    })
    state.memos.list.set('memo:list:all', {
      status: 'success',
      error: null,
      dataUpdatedAt: 202,
      filters: { tag: 'tag/a' },
      pageSize: 20,
      pages: [makePage([memo])],
      isLoadingMore: true,
      loadMoreError: 'ignored',
    })
    state.stats = {
      status: 'success',
      error: null,
      dataUpdatedAt: 303,
      data: {
        note_count: 1,
        tag_count: 1,
        word_count: 10,
        daily_note_count: [[20260421, 1]],
      },
    }
    state.tagTree = {
      status: 'success',
      error: null,
      dataUpdatedAt: 404,
      data: [{
        label: 'Tag A',
        tag: 'tag/a',
        item_count: 1,
        children: [],
      }],
    }
    state.exitingMemoIds.add(1)

    saveWorkspaceSnapshot('authenticated', state)
    const restored = loadWorkspaceSnapshot('authenticated')

    expect(setStorageSync).toHaveBeenCalledWith(
      'biji-skyline.workspace.authenticated',
      expect.objectContaining({ version: 1 }),
    )
    expect(restored.memos.detail.get(1)).toEqual({
      status: 'success',
      error: null,
      dataUpdatedAt: 101,
      memo,
    })
    expect(restored.memos.list.get('memo:list:all')).toEqual({
      status: 'success',
      error: null,
      dataUpdatedAt: 202,
      filters: { tag: 'tag/a' },
      pageSize: 20,
      pages: [makePage([memo])],
      isLoadingMore: false,
      loadMoreError: null,
    })
    expect(restored.stats).toEqual({
      status: 'success',
      error: null,
      dataUpdatedAt: 303,
      data: {
        note_count: 1,
        tag_count: 1,
        word_count: 10,
        daily_note_count: [[20260421, 1]],
      },
    })
    expect(restored.tagTree).toEqual({
      status: 'success',
      error: null,
      dataUpdatedAt: 404,
      data: [{
        label: 'Tag A',
        tag: 'tag/a',
        item_count: 1,
        children: [],
      }],
      untaggedCount: 0,
    })
  })

  it('persists only successful memo cache entries', () => {
    const state = createEmptyWorkspaceState()
    const okMemo = makeMemo(1)
    state.memos.detail.set(okMemo.id, {
      status: 'success',
      error: null,
      dataUpdatedAt: 101,
      memo: okMemo,
    })
    state.memos.detail.set(2, {
      status: 'error',
      error: 'boom',
      dataUpdatedAt: 0,
      memo: makeMemo(2),
    })
    state.memos.list.set('good', {
      status: 'success',
      error: null,
      dataUpdatedAt: 202,
      filters: { text: { contains: 'ok' } },
      pageSize: 10,
      pages: [makePage([okMemo])],
      isLoadingMore: false,
      loadMoreError: null,
    })
    state.memos.list.set('bad', {
      status: 'loading',
      error: null,
      dataUpdatedAt: 0,
      filters: {},
      pageSize: 10,
      pages: [makePage([makeMemo(3)])],
      isLoadingMore: false,
      loadMoreError: null,
    })

    saveWorkspaceSnapshot('authenticated', state)
    const restored = loadWorkspaceSnapshot('authenticated')

    expect(restored.memos.detail.size).toBe(1)
    expect(restored.memos.detail.get(1)?.status).toBe('success')
    expect(restored.memos.detail.has(2)).toBe(false)
    expect(restored.memos.list.size).toBe(1)
    expect(restored.memos.list.get('good')?.status).toBe('success')
    expect(restored.memos.list.has('bad')).toBe(false)
  })

  it('keeps visitor storage separate from authenticated storage', () => {
    const authState = createEmptyWorkspaceState()
    authState.stats = {
      status: 'success',
      error: null,
      dataUpdatedAt: 11,
      data: { note_count: 10, tag_count: 2, word_count: 100, daily_note_count: [] },
    }
    const visitorState = createEmptyWorkspaceState()
    visitorState.stats = {
      status: 'success',
      error: null,
      dataUpdatedAt: 22,
      data: { note_count: 1, tag_count: 0, word_count: 5, daily_note_count: [] },
    }

    saveWorkspaceSnapshot('authenticated', authState)
    saveWorkspaceSnapshot('visitor', visitorState)

    expect(loadWorkspaceSnapshot('authenticated').stats.data?.note_count).toBe(10)
    expect(loadWorkspaceSnapshot('visitor').stats.data?.note_count).toBe(1)
    expect(setStorageSync).toHaveBeenCalledWith(
      'biji-skyline.workspace.visitor',
      expect.objectContaining({ version: 1 }),
    )
  })

  it('falls back to an empty state for malformed payloads', () => {
    storage.set('biji-skyline.workspace.authenticated', {
      version: 1,
      memos: {
        detail: [{ nope: true }],
        list: 'bad-data',
      },
      stats: {
        data: null,
        dataUpdatedAt: 'bad',
      },
      tagTree: {
        data: null,
        dataUpdatedAt: 0,
      },
    })

    expect(loadWorkspaceSnapshot('authenticated')).toEqual(createEmptyWorkspaceState())
  })

  it('falls back to an empty state for invalid memo filters', () => {
    storage.set('biji-skyline.workspace.authenticated', {
      version: 1,
      memos: {
        detail: [],
        list: [{
          key: 'memo:list:bad',
          filters: { created_at: [], text: 123 },
          pageSize: 20,
          pages: [],
          dataUpdatedAt: 1,
        }],
      },
      stats: {
        data: null,
        dataUpdatedAt: 0,
      },
      tagTree: {
        data: null,
        dataUpdatedAt: 0,
      },
    })

    expect(loadWorkspaceSnapshot('authenticated')).toEqual(createEmptyWorkspaceState())
  })

  it('clears only the requested storage key', () => {
    saveWorkspaceSnapshot('authenticated', createEmptyWorkspaceState())
    saveWorkspaceSnapshot('visitor', createEmptyWorkspaceState())

    clearWorkspaceSnapshot('visitor')

    expect(removeStorageSync).toHaveBeenCalledWith('biji-skyline.workspace.visitor')
    expect(storage.has('biji-skyline.workspace.visitor')).toBe(false)
    expect(storage.has('biji-skyline.workspace.authenticated')).toBe(true)
  })
})
