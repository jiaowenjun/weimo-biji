import type { MemoListEntry, MemoDetailEntry } from './memo-cache-types'

export interface VisitableState {
  memos: {
    detail: Map<number, MemoDetailEntry>
    list: Map<string, MemoListEntry>
  }
}

export interface CacheVisitor {
  onDetail?: (key: number, entry: MemoDetailEntry) => void
  onList?: (key: string, entry: MemoListEntry) => void
}

export function visitMemoCacheEntries(state: VisitableState, v: CacheVisitor): void {
  if (v.onDetail) state.memos.detail.forEach((e, k) => v.onDetail!(k, e))
  if (v.onList) state.memos.list.forEach((e, k) => v.onList!(k, e))
}
