import type { CacheEntryBase, MemoListEntry } from './memo-cache-types'
import type { TagTreeMeta } from '../models/tag'
import type { WorkspaceStats } from '../models/workspace'

export interface InvalidatableState {
  memos: { detail: Map<number, unknown>; list: Map<string, MemoListEntry> }
  stats: CacheEntryBase & { data: WorkspaceStats | null }
  tagTree: CacheEntryBase & { data: TagTreeMeta[] | null }
}

export interface WorkspaceInvalidationScope {
  memos?: boolean
  stats?: boolean
  tagTree?: boolean
}

export function invalidateWorkspace(
  state: InvalidatableState,
  { memos = false, stats = true, tagTree = true }: WorkspaceInvalidationScope = {},
): void {
  if (stats) state.stats.dataUpdatedAt = 0
  if (tagTree) state.tagTree.dataUpdatedAt = 0
  if (memos) {
    state.memos.list.forEach((entry, key) => {
      state.memos.list.set(key, { ...entry, dataUpdatedAt: 0 })
    })
  }
}
