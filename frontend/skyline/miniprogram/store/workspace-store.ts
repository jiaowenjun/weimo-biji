import type { Memo, MemoSearchPage, MemoSearchQuery, MemoWriteRequest } from '../models/memo'
import type { TagTreeMeta } from '../models/tag'
import type { WorkspaceStats } from '../models/workspace'
import type {
  CacheEntryBase,
  MemoDetailEntry,
  MemoListEntry,
} from './memo-cache-types'
import { createMemoResource } from './workspace-core/memo-resource'
import { createStatsResource } from './workspace-core/stats-resource'
import { createTagTreeResource } from './workspace-core/tag-tree-resource'
import type { AggregateSlots, WorkspaceStoreCtx } from './workspace-core/types'

export interface WorkspaceServices {
  searchMemos: (filters: MemoSearchQuery, cursor: string | null, pageSize: number) => Promise<MemoSearchPage>
  getMemo: (id: number) => Promise<Memo>
  getMemos: (ids: number[]) => Promise<Memo[]>
  getWorkspaceStats: () => Promise<WorkspaceStats>
  getTagTree: () => Promise<TagTreeMeta>
  createMemo: (payload: MemoWriteRequest) => Promise<number>
  updateMemo: (id: number, payload: MemoWriteRequest) => Promise<number>
  deleteMemo: (id: number) => Promise<number>
  renameTag: (oldTag: string, newTag: string) => Promise<string>
  deleteTag: (tag: string) => Promise<void>
}

export interface WorkspaceState {
  memos: {
    detail: Map<number, MemoDetailEntry>
    list: Map<string, MemoListEntry>
  }
  stats: CacheEntryBase & { data: WorkspaceStats | null }
  tagTree: CacheEntryBase & { data: TagTreeMeta[] | null; untaggedCount: number }
  exitingMemoIds: Set<number>
}

export interface WorkspaceRuntimeConfig {
  services: WorkspaceServices
  state: WorkspaceState
}

export function createEmptyWorkspaceState(): WorkspaceState {
  return {
    memos: {
      detail: new Map(),
      list: new Map(),
    },
    stats: { status: 'idle', error: null, dataUpdatedAt: 0, data: null },
    tagTree: { status: 'idle', error: null, dataUpdatedAt: 0, data: null, untaggedCount: 0 },
    exitingMemoIds: new Set<number>(),
  }
}

export interface WorkspaceStore {
  getState(): WorkspaceState
  subscribe(listener: () => void): () => void
  replaceRuntime(runtime: WorkspaceRuntimeConfig): void
  ensureMemoList(key: string, filters: MemoSearchQuery, pageSize: number): Promise<void>
  ensureMemoDetail(id: number): Promise<Memo>
  ensureMemoDetails(ids: number[]): Promise<Memo[]>
  refreshMemoList(key: string): Promise<void>
  loadMoreMemoList(key: string): Promise<void>
  ensureStats(): Promise<void>
  refreshStats(): Promise<void>
  ensureTagTree(): Promise<void>
  refreshTagTree(): Promise<void>
  createMemo(payload: MemoWriteRequest): Promise<Memo>
  updateMemo(id: number, payload: MemoWriteRequest): Promise<Memo>
  deleteMemo(id: number): Promise<void>
  deleteMemoWithExitAnimation(id: number, exitMs: number): Promise<void>
  renameTag(oldTag: string, newTag: string): Promise<string>
  deleteTag(tag: string): Promise<void>
}

const FRESH_MS = 600_000

interface InternalCtx extends WorkspaceStoreCtx {
  state: WorkspaceState
  listeners: Set<() => void>
  memoInflight: Map<string, Promise<void>>
  memoDetailInflight: Map<number, Promise<Memo>>
  aggregateSlots: AggregateSlots
  services: WorkspaceServices
  runtimeVersion: number
}

function emit(ctx: InternalCtx) {
  ctx.listeners.forEach((l) => l())
}

function isFresh(entry: { dataUpdatedAt: number } | undefined) {
  return !!entry && entry.dataUpdatedAt > 0 && Date.now() - entry.dataUpdatedAt < FRESH_MS
}

function isCurrentRuntime(ctx: InternalCtx, runtimeVersion: number) {
  return ctx.runtimeVersion === runtimeVersion
}

export function createWorkspaceStore(
  opts: { services: WorkspaceServices; initialState?: WorkspaceState },
): WorkspaceStore {
  const ctx: InternalCtx = {
    state: opts.initialState ?? createEmptyWorkspaceState(),
    listeners: new Set(),
    memoInflight: new Map(),
    memoDetailInflight: new Map(),
    aggregateSlots: {
      stats: { inflight: null, pendingCause: null, inflightSource: null },
      tagTree: { inflight: null, pendingCause: null, inflightSource: null },
    },
    services: opts.services,
    runtimeVersion: 0,
    now: () => Date.now(),
    emit: () => emit(ctx),
    subscribe: (listener) => {
      ctx.listeners.add(listener)
      return () => {
        ctx.listeners.delete(listener)
      }
    },
    isFresh,
    getRuntimeVersion: () => ctx.runtimeVersion,
    isRuntimeCurrent: (runtimeVersion) => isCurrentRuntime(ctx, runtimeVersion),
  }

  const stats = createStatsResource(ctx)
  const tagTree = createTagTreeResource(ctx)
  const memos = createMemoResource(ctx, { stats, tagTree })

  const store: WorkspaceStore = {
    getState: () => ctx.state,
    subscribe: ctx.subscribe,
    replaceRuntime(runtime) {
      ctx.runtimeVersion += 1
      memos.resetForRuntimeReplace()
      stats.resetForRuntimeReplace()
      tagTree.resetForRuntimeReplace()
      ctx.services = runtime.services
      ctx.state = runtime.state
      ctx.emit()
    },

    ensureMemoList: memos.ensureMemoList,
    ensureMemoDetail: memos.ensureMemoDetail,
    ensureMemoDetails: memos.ensureMemoDetails,
    refreshMemoList: memos.refreshMemoList,
    loadMoreMemoList: memos.loadMoreMemoList,

    async ensureStats() {
      return stats.ensure()
    },

    async refreshStats() {
      return stats.refresh()
    },

    async ensureTagTree() {
      return tagTree.ensure()
    },

    async refreshTagTree() {
      return tagTree.refresh()
    },

    createMemo: memos.createMemo,
    updateMemo: memos.updateMemo,
    deleteMemo: memos.deleteMemo,
    deleteMemoWithExitAnimation: memos.deleteMemoWithExitAnimation,
    renameTag: memos.renameTag,
    deleteTag: memos.deleteTag,
  }

  return store
}
