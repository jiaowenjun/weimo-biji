import type { Memo, MemoRefId } from '../models/memo'
import { appendMemoRefId, ownMemoIdFromRef, removeMemoRefId } from '../utils/memo-ref-id'
import type { MemoDetailEntry } from './memo-cache-types'
import {
  prependMemoListData,
  transformMemoListData,
} from './memo-cache-list-data'
import { remapMemoTagPath } from './memo-cache-filters'
import { visitMemoCacheEntries, type VisitableState } from './memo-cache-visitor'

type MemoTransform = (memo: Memo) => Memo | undefined

function transformCachedMemos(state: VisitableState, transform: MemoTransform): void {
  const detailIdsToRemove = new Set<number>()
  visitMemoCacheEntries(state, {
    onDetail: (id, entry) => {
      const next = transform(entry.memo)
      if (next === undefined) {
        detailIdsToRemove.add(id)
        return
      }
      if (next !== entry.memo) {
        state.memos.detail.set(id, { ...entry, memo: next, dataUpdatedAt: Date.now() })
      }
    },
    onList: (key, entry) => {
      const nextPages = transformMemoListData(entry.pages, entry.filters, transform)
      if (nextPages !== entry.pages) {
        state.memos.list.set(key, { ...entry, pages: nextPages, dataUpdatedAt: Date.now() })
      }
    },
  })
  detailIdsToRemove.forEach((id) => state.memos.detail.delete(id))
}

export function insertMemoCacheEntry(state: VisitableState, memo: Memo): void {
  const detailEntry: MemoDetailEntry = {
    status: 'success',
    error: null,
    dataUpdatedAt: Date.now(),
    memo,
  }
  state.memos.detail.set(memo.id, detailEntry)
  visitMemoCacheEntries(state, {
    onList: (key, entry) => {
      const nextPages = prependMemoListData(entry.pages, entry.filters, memo)
      if (nextPages !== entry.pages) {
        state.memos.list.set(key, { ...entry, pages: nextPages, dataUpdatedAt: Date.now() })
      }
    },
  })
}

export function syncMemoCacheEntry(state: VisitableState, memo: Memo): void {
  transformCachedMemos(state, (m) => (m.id === memo.id ? memo : m))
}

export function syncMemoReferenceBacklinks(
  state: VisitableState,
  referrerId: number,
  previousRefs: MemoRefId[],
  nextRefs: MemoRefId[],
): void {
  const previous = new Set(previousRefs.map(ownMemoIdFromRef).filter((id): id is number => id !== null))
  const next = new Set(nextRefs.map(ownMemoIdFromRef).filter((id): id is number => id !== null))
  const affected = new Set([...previous, ...next])
  if (affected.size === 0) return
  const referrerRef = String(referrerId)

  transformCachedMemos(state, (memo) => {
    if (!affected.has(memo.id)) return memo

    let referencedBy = memo.referencedBy
    if (previous.has(memo.id) && !next.has(memo.id)) {
      referencedBy = removeMemoRefId(referencedBy, referrerRef)
    }
    if (next.has(memo.id)) {
      referencedBy = appendMemoRefId(referencedBy, referrerRef)
    }
    if (referencedBy === memo.referencedBy) return memo
    return { ...memo, referencedBy }
  })
}

export function removeMemoCacheEntry(state: VisitableState, id: number): void {
  const ref = String(id)
  transformCachedMemos(state, (memo) => {
    if (memo.id === id) return undefined

    const refs = removeMemoRefId(memo.refs, ref)
    const referencedBy = removeMemoRefId(memo.referencedBy, ref)
    if (refs === memo.refs && referencedBy === memo.referencedBy) return memo
    return { ...memo, refs, referencedBy }
  })
}

export function renameMemoTagsInCache(
  state: VisitableState,
  oldTag: string,
  newTag: string,
): void {
  transformCachedMemos(state, (memo) => {
    const nextTags = memo.tags.map((tag) => remapMemoTagPath(tag, oldTag, newTag))
    const changed = nextTags.some((tag, index) => tag !== memo.tags[index])
    if (!changed) {
      return memo
    }
    return {
      ...memo,
      tags: nextTags,
    }
  })
}

export function removeMemoTagInCache(state: VisitableState, deletedTag: string): void {
  const prefix = `${deletedTag}/`
  transformCachedMemos(state, (memo) => {
    const nextTags = memo.tags.filter((t) => t !== deletedTag && !t.startsWith(prefix))
    if (nextTags.length === memo.tags.length) return memo
    return { ...memo, tags: nextTags }
  })
}
