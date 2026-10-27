import type { Memo, MemoSearchPage, MemoSearchQuery } from '../models/memo'

export interface CacheEntryBase {
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  dataUpdatedAt: number
}

export interface MemoListEntry extends CacheEntryBase {
  filters: MemoSearchQuery
  pageSize: number
  pages: MemoSearchPage[]
  isLoadingMore: boolean
  loadMoreError: string | null
}

export interface MemoDetailEntry extends CacheEntryBase {
  memo: Memo
}

export function isMemo(value: unknown): value is Memo {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Memo>
  return (
    typeof v.id === 'number' &&
    typeof v.content === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string' &&
    Array.isArray(v.tags) &&
    Array.isArray(v.refs) &&
    Array.isArray(v.referencedBy)
  )
}

export function isMemoArray(value: unknown): value is Memo[] {
  return Array.isArray(value) && value.every(isMemo)
}
