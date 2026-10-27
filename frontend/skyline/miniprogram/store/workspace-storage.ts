import type { MemoDateFilter, MemoSearchPage, MemoSearchQuery, MemoTextFilter } from '../models/memo'
import type { TagTreeMeta } from '../models/tag'
import type { WorkspaceStats } from '../models/workspace'
import { isRecord } from '../utils/guards'
import { sortTagTreeMetaDeep } from '../utils/tag-sort'
import { readWxStorage, removeWxStorage, writeWxStorage } from '../utils/wx-storage'
import { isMemo } from './memo-cache-types'
import { createEmptyWorkspaceState, type WorkspaceState } from './workspace-store'

export type WorkspaceRuntimeMode = 'authenticated' | 'visitor'

interface PersistedMemoListEntry {
  key: string
  filters: Record<string, unknown>
  pageSize: number
  pages: MemoSearchPage[]
  dataUpdatedAt: number
}

interface PersistedWorkspaceSnapshot {
  version: 1
  memos: {
    detail: unknown[]
    list: PersistedMemoListEntry[]
  }
  stats: {
    data: WorkspaceStats | null
    dataUpdatedAt: number
  }
  tagTree: {
    data: TagTreeMeta[] | null
    dataUpdatedAt: number
  }
}

const STORAGE_KEYS: Record<WorkspaceRuntimeMode, string> = {
  authenticated: 'biji-skyline.workspace.authenticated',
  visitor: 'biji-skyline.workspace.visitor',
}

function isMemoSearchPage(value: unknown): value is MemoSearchPage {
  if (!isRecord(value)) return false
  return (
    Array.isArray(value.items) &&
    value.items.every(isMemo) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    typeof value.hasMore === 'boolean' &&
    typeof value.totalCount === 'number'
  )
}

function isMemoDateFilter(value: unknown): value is MemoDateFilter {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.year !== 'number') return false
  if (value.kind === 'year') return true
  if (value.kind === 'month') return typeof value.month === 'number'
  if (value.kind === 'day') {
    return typeof value.month === 'number' && typeof value.day === 'number'
  }
  return false
}

function isMemoTextFilter(value: unknown): value is MemoTextFilter {
  return isRecord(value) && typeof value.contains === 'string'
}

function isMemoSearchQuery(value: unknown): value is MemoSearchQuery {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.some((key) => !['tag', 'created_at', 'text'].includes(key))) return false
  if ('tag' in value && value.tag !== undefined && typeof value.tag !== 'string') return false
  if ('created_at' in value && value.created_at !== undefined && !isMemoDateFilter(value.created_at)) return false
  if ('text' in value && value.text !== undefined && !isMemoTextFilter(value.text)) return false
  return true
}

function isWorkspaceStats(value: unknown): value is WorkspaceStats {
  if (!isRecord(value)) return false
  return (
    typeof value.note_count === 'number' &&
    typeof value.tag_count === 'number' &&
    typeof value.word_count === 'number' &&
    Array.isArray(value.daily_note_count) &&
    value.daily_note_count.every((item) => (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number'
    ))
  )
}

function isTagTreeMeta(value: unknown): value is TagTreeMeta {
  if (!isRecord(value)) return false
  return (
    typeof value.label === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.item_count === 'number' &&
    Array.isArray(value.children) &&
    value.children.every(isTagTreeMeta)
  )
}

function toSnapshot(state: WorkspaceState): PersistedWorkspaceSnapshot {
  return {
    version: 1,
    memos: {
      detail: Array.from(state.memos.detail.values())
        .filter((entry) => entry.status === 'success' && isMemo(entry.memo))
        .map((entry) => ({
          memo: entry.memo,
          dataUpdatedAt: entry.dataUpdatedAt,
        })),
      list: Array.from(state.memos.list.entries())
        .filter(([, entry]) => (
          entry.status === 'success' &&
          isMemoSearchQuery(entry.filters) &&
          entry.pages.every(isMemoSearchPage)
        ))
        .map(([key, entry]) => ({
          key,
          filters: entry.filters as Record<string, unknown>,
          pageSize: entry.pageSize,
          pages: entry.pages,
          dataUpdatedAt: entry.dataUpdatedAt,
        })),
    },
    stats: {
      data: state.stats.data,
      dataUpdatedAt: state.stats.dataUpdatedAt,
    },
    tagTree: {
      data: state.tagTree.data,
      dataUpdatedAt: state.tagTree.dataUpdatedAt,
    },
  }
}

function fromSnapshot(snapshot: unknown): WorkspaceState {
  if (!isRecord(snapshot) || snapshot.version !== 1) return createEmptyWorkspaceState()
  if (!isRecord(snapshot.memos) || !Array.isArray(snapshot.memos.detail) || !Array.isArray(snapshot.memos.list)) {
    return createEmptyWorkspaceState()
  }
  if (!isRecord(snapshot.stats) || typeof snapshot.stats.dataUpdatedAt !== 'number') {
    return createEmptyWorkspaceState()
  }
  if (!isRecord(snapshot.tagTree) || typeof snapshot.tagTree.dataUpdatedAt !== 'number') {
    return createEmptyWorkspaceState()
  }

  const state = createEmptyWorkspaceState()

  for (const item of snapshot.memos.detail) {
    if (!isRecord(item) || typeof item.dataUpdatedAt !== 'number' || !isMemo(item.memo)) {
      return createEmptyWorkspaceState()
    }
    state.memos.detail.set(item.memo.id, {
      status: 'success',
      error: null,
      dataUpdatedAt: item.dataUpdatedAt,
      memo: item.memo,
    })
  }

  for (const item of snapshot.memos.list) {
    if (!isRecord(item)) return createEmptyWorkspaceState()
    if (
      typeof item.key !== 'string' ||
      !isMemoSearchQuery(item.filters) ||
      typeof item.pageSize !== 'number' ||
      typeof item.dataUpdatedAt !== 'number' ||
      !Array.isArray(item.pages) ||
      !item.pages.every(isMemoSearchPage)
    ) {
      return createEmptyWorkspaceState()
    }
    state.memos.list.set(item.key, {
      status: 'success',
      error: null,
      dataUpdatedAt: item.dataUpdatedAt,
      filters: item.filters,
      pageSize: item.pageSize,
      pages: item.pages,
      isLoadingMore: false,
      loadMoreError: null,
    })
  }

  if (snapshot.stats.data !== null && !isWorkspaceStats(snapshot.stats.data)) {
    return createEmptyWorkspaceState()
  }
  state.stats = {
    status: snapshot.stats.data ? 'success' : 'idle',
    error: null,
    dataUpdatedAt: snapshot.stats.dataUpdatedAt,
    data: snapshot.stats.data,
  }

  if (snapshot.tagTree.data !== null) {
    if (!Array.isArray(snapshot.tagTree.data) || !snapshot.tagTree.data.every(isTagTreeMeta)) {
      return createEmptyWorkspaceState()
    }
  }
  state.tagTree = {
    status: snapshot.tagTree.data ? 'success' : 'idle',
    error: null,
    dataUpdatedAt: snapshot.tagTree.dataUpdatedAt,
    data: snapshot.tagTree.data ? sortTagTreeMetaDeep(snapshot.tagTree.data) : null,
    untaggedCount: 0,
  }

  return state
}

export function loadWorkspaceSnapshot(mode: WorkspaceRuntimeMode): WorkspaceState {
  return fromSnapshot(readWxStorage(STORAGE_KEYS[mode]))
}

export function saveWorkspaceSnapshot(mode: WorkspaceRuntimeMode, state: WorkspaceState): void {
  writeWxStorage(STORAGE_KEYS[mode], toSnapshot(state))
}

export function clearWorkspaceSnapshot(mode: WorkspaceRuntimeMode): void {
  removeWxStorage(STORAGE_KEYS[mode])
}
