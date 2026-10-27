import type { Memo, MemoSearchQuery, MemoWriteRequest } from '../../models/memo'
import type { MemoListEntry } from '../memo-cache-types'
import {
  insertMemoCacheEntry,
  removeMemoCacheEntry,
  removeMemoTagInCache,
  renameMemoTagsInCache,
  syncMemoCacheEntry,
  syncMemoReferenceBacklinks,
} from '../memo-cache'
import { invalidateWorkspace } from '../invalidate-workspace'
import type { AggregateResources, WorkspaceStoreCtx } from './types'

interface MemoResourceCtx extends WorkspaceStoreCtx {
  memoInflight: Map<string, Promise<void>>
  memoDetailInflight: Map<number, Promise<Memo>>
}

function memoMatchesListEntry(entry: MemoListEntry, memoId: number): boolean {
  return entry.pages.some((page) => page.items.some((item) => item.id === memoId))
}

export function createMemoResource(
  ctx: MemoResourceCtx,
  aggregates: AggregateResources,
) {
  function ensureListEntry(key: string, filters: MemoSearchQuery, pageSize: number): MemoListEntry {
    const existing = ctx.state.memos.list.get(key)
    if (existing) return existing

    const next: MemoListEntry = {
      status: 'idle',
      error: null,
      dataUpdatedAt: 0,
      filters,
      pageSize,
      pages: [],
      isLoadingMore: false,
      loadMoreError: null,
    }
    ctx.state.memos.list.set(key, next)
    return next
  }

  function syncPageItemsToDetail(entry: MemoListEntry): void {
    const now = ctx.now()
    entry.pages.forEach((page) => {
      page.items.forEach((memo) => {
        ctx.state.memos.detail.set(memo.id, {
          status: 'success',
          error: null,
          dataUpdatedAt: now,
          memo,
        })
      })
    })
  }

  function syncMemoDetail(memo: Memo): void {
    ctx.state.memos.detail.set(memo.id, {
      status: 'success',
      error: null,
      dataUpdatedAt: ctx.now(),
      memo,
    })
    syncMemoCacheEntry(ctx.state, memo)
  }

  function markListsAffectedByExitChange(memoId: number): void {
    for (const [key, entry] of ctx.state.memos.list) {
      if (memoMatchesListEntry(entry, memoId)) {
        ctx.state.memos.list.set(key, { ...entry })
      }
    }
  }

  function invalidateAggregates(backfill: { stats: boolean; tagTree: boolean }): void {
    invalidateWorkspace(ctx.state, { memos: false, ...backfill })
    if (backfill.stats) {
      aggregates.stats.invalidateFromMutation()
    }
    if (backfill.tagTree) {
      aggregates.tagTree.invalidateFromMutation()
    }
    ctx.emit()
    if (backfill.stats) {
      void aggregates.stats.ensure()
    }
    if (backfill.tagTree) {
      void aggregates.tagTree.ensure()
    }
  }

  async function fetchListFirstPage(key: string, runtimeVersion: number): Promise<void> {
    const entry = ctx.state.memos.list.get(key)!
    ctx.state.memos.list.set(key, { ...entry, status: 'loading', error: null })
    ctx.emit()

    try {
      const page = await ctx.services.searchMemos(entry.filters, null, entry.pageSize)
      if (!ctx.isRuntimeCurrent(runtimeVersion)) return

      const cur = ctx.state.memos.list.get(key)!
      const next: MemoListEntry = {
        ...cur,
        status: 'success',
        error: null,
        dataUpdatedAt: ctx.now(),
        pages: [page],
      }
      ctx.state.memos.list.set(key, next)
      syncPageItemsToDetail(next)
      ctx.emit()
    } catch (err) {
      if (!ctx.isRuntimeCurrent(runtimeVersion)) return

      const cur = ctx.state.memos.list.get(key)!
      ctx.state.memos.list.set(key, {
        ...cur,
        status: 'error',
        error: (err as Error).message,
      })
      ctx.emit()
      throw err
    }
  }

  function startFirstPageFetch(key: string, runtimeVersion: number): Promise<void> {
    const promise = fetchListFirstPage(key, runtimeVersion).finally(() => {
      if (ctx.memoInflight.get(key) === promise) {
        ctx.memoInflight.delete(key)
      }
    })
    ctx.memoInflight.set(key, promise)
    return promise
  }

  async function ensureMemoList(key: string, filters: MemoSearchQuery, pageSize: number): Promise<void> {
    const existing = ctx.state.memos.list.get(key)
    if (ctx.isFresh(existing)) return

    const inflight = ctx.memoInflight.get(key)
    if (inflight) return inflight

    ensureListEntry(key, filters, pageSize)
    return startFirstPageFetch(key, ctx.getRuntimeVersion())
  }

  async function fetchMemoDetail(id: number, runtimeVersion: number): Promise<Memo> {
    const memo = await ctx.services.getMemo(id)
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return memo

    syncMemoDetail(memo)
    ctx.emit()
    return memo
  }

  function startMemoDetailFetch(id: number, runtimeVersion: number): Promise<Memo> {
    const promise = fetchMemoDetail(id, runtimeVersion).finally(() => {
      if (ctx.memoDetailInflight.get(id) === promise) {
        ctx.memoDetailInflight.delete(id)
      }
    })
    ctx.memoDetailInflight.set(id, promise)
    return promise
  }

  async function ensureMemoDetail(id: number): Promise<Memo> {
    const existing = ctx.state.memos.detail.get(id)
    if (existing && ctx.isFresh(existing)) return existing.memo

    const inflight = ctx.memoDetailInflight.get(id)
    if (inflight) return inflight

    return startMemoDetailFetch(id, ctx.getRuntimeVersion())
  }

  async function ensureMemoDetails(ids: number[]): Promise<Memo[]> {
    const requestedIds = ids.filter((id) => Number.isFinite(id))
    const uniqueIds = Array.from(new Set(requestedIds))
    const missingIds = uniqueIds.filter((id) => !ctx.isFresh(ctx.state.memos.detail.get(id)))

    if (missingIds.length > 0) {
      const runtimeVersion = ctx.getRuntimeVersion()
      const fetched = await ctx.services.getMemos(missingIds)
      if (ctx.isRuntimeCurrent(runtimeVersion)) {
        fetched.forEach(syncMemoDetail)
        ctx.emit()
      }
    }

    const missingAfterFetch = uniqueIds.filter((id) => !ctx.state.memos.detail.get(id)?.memo)
    if (missingAfterFetch.length > 0) {
      throw new Error(`Memo detail missing: ${missingAfterFetch.join(', ')}`)
    }

    return requestedIds.map((id) => ctx.state.memos.detail.get(id)!.memo)
  }

  async function refreshMemoList(key: string): Promise<void> {
    const entry = ctx.state.memos.list.get(key)
    if (!entry) return

    ctx.state.memos.list.set(key, { ...entry, dataUpdatedAt: 0 })
    const inflight = ctx.memoInflight.get(key)
    if (inflight) return inflight

    return startFirstPageFetch(key, ctx.getRuntimeVersion())
  }

  async function loadMoreMemoList(key: string): Promise<void> {
    const runtimeVersion = ctx.getRuntimeVersion()
    const entry = ctx.state.memos.list.get(key)
    if (!entry) return

    const last = entry.pages[entry.pages.length - 1]
    if (!last?.hasMore || !last.nextCursor || entry.isLoadingMore) return

    ctx.state.memos.list.set(key, { ...entry, isLoadingMore: true, loadMoreError: null })
    ctx.emit()

    try {
      const page = await ctx.services.searchMemos(entry.filters, last.nextCursor, entry.pageSize)
      if (!ctx.isRuntimeCurrent(runtimeVersion)) return

      const cur = ctx.state.memos.list.get(key)!
      const next: MemoListEntry = {
        ...cur,
        isLoadingMore: false,
        loadMoreError: null,
        pages: [...cur.pages, page],
      }
      ctx.state.memos.list.set(key, next)
      syncPageItemsToDetail(next)
      ctx.emit()
    } catch (err) {
      if (!ctx.isRuntimeCurrent(runtimeVersion)) return

      const cur = ctx.state.memos.list.get(key)!
      ctx.state.memos.list.set(key, {
        ...cur,
        isLoadingMore: false,
        loadMoreError: (err as Error).message,
      })
      ctx.emit()
    }
  }

  async function createMemo(payload: MemoWriteRequest): Promise<Memo> {
    const runtimeVersion = ctx.getRuntimeVersion()
    const id = await ctx.services.createMemo(payload)
    const now = new Date().toISOString()
    const memo: Memo = {
      id,
      content: payload.content,
      tags: payload.tags,
      refs: payload.refs ? [...payload.refs] : [],
      referencedBy: [],
      createdAt: now,
      updatedAt: now,
    }
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return memo

    insertMemoCacheEntry(ctx.state, memo)
    syncMemoReferenceBacklinks(ctx.state, memo.id, [], memo.refs)
    invalidateAggregates({ stats: true, tagTree: true })
    return memo
  }

  async function updateMemo(id: number, payload: MemoWriteRequest): Promise<Memo> {
    const runtimeVersion = ctx.getRuntimeVersion()
    const cur = ctx.state.memos.detail.get(id)?.memo
    await ctx.services.updateMemo(id, payload)
    const previousRefs = cur?.refs ?? []

    const memo: Memo = {
      id,
      content: payload.content,
      tags: payload.tags,
      refs: payload.refs ? [...payload.refs] : [...previousRefs],
      referencedBy: [...(cur?.referencedBy ?? [])],
      createdAt: cur?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return memo

    syncMemoCacheEntry(ctx.state, memo)
    syncMemoReferenceBacklinks(ctx.state, memo.id, previousRefs, memo.refs)
    const tagSetSame = !!cur &&
      cur.tags.length === payload.tags.length &&
      cur.tags.every((tag) => payload.tags.includes(tag))
    invalidateAggregates({ stats: true, tagTree: !tagSetSame })
    return memo
  }

  async function deleteMemo(id: number): Promise<void> {
    const runtimeVersion = ctx.getRuntimeVersion()
    await ctx.services.deleteMemo(id)
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return

    removeMemoCacheEntry(ctx.state, id)
    invalidateAggregates({ stats: true, tagTree: true })
  }

  async function deleteMemoWithExitAnimation(id: number, exitMs: number): Promise<void> {
    const runtimeVersion = ctx.getRuntimeVersion()
    ctx.state.exitingMemoIds.add(id)
    markListsAffectedByExitChange(id)
    ctx.emit()

    try {
      await ctx.services.deleteMemo(id)
    } catch (err) {
      if (!ctx.isRuntimeCurrent(runtimeVersion)) throw err

      ctx.state.exitingMemoIds.delete(id)
      markListsAffectedByExitChange(id)
      ctx.emit()
      throw err
    }

    if (!ctx.isRuntimeCurrent(runtimeVersion)) return
    if (exitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, exitMs))
    }
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return

    ctx.state.exitingMemoIds.delete(id)
    removeMemoCacheEntry(ctx.state, id)
    invalidateAggregates({ stats: true, tagTree: true })
  }

  async function renameTag(oldTag: string, newTag: string): Promise<string> {
    const runtimeVersion = ctx.getRuntimeVersion()
    await ctx.services.renameTag(oldTag, newTag)
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return newTag

    renameMemoTagsInCache(ctx.state, oldTag, newTag)
    invalidateAggregates({ stats: false, tagTree: true })
    return newTag
  }

  async function deleteTag(tag: string): Promise<void> {
    const runtimeVersion = ctx.getRuntimeVersion()
    await ctx.services.deleteTag(tag)
    if (!ctx.isRuntimeCurrent(runtimeVersion)) return

    removeMemoTagInCache(ctx.state, tag)
    invalidateAggregates({ stats: false, tagTree: true })
  }

  function resetForRuntimeReplace(): void {
    ctx.memoInflight.clear()
    ctx.memoDetailInflight.clear()
  }

  return {
    ensureMemoList,
    ensureMemoDetail,
    ensureMemoDetails,
    refreshMemoList,
    loadMoreMemoList,
    createMemo,
    updateMemo,
    deleteMemo,
    deleteMemoWithExitAnimation,
    renameTag,
    deleteTag,
    resetForRuntimeReplace,
  }
}
