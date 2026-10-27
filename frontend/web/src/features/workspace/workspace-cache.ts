import type { QueryClient, QueryKey } from '@tanstack/react-query'
import {
  createWorkspaceListCacheCore,
  invalidateWorkspaceCollections as invalidateCollections,
  workspaceItemMatchesFilters,
} from '@weimo/workspace-core/cache'

import type { Memo, MemoSearchQuery } from './workspace-types'

export {
  WORKSPACE_CACHE_GC_TIME_MS,
  WORKSPACE_CACHE_STALE_TIME_MS,
} from '@weimo/workspace-core/cache'

export interface WorkspaceMemoCacheIndex {
  getMemoById(id: number): Memo | undefined
  getSummaryCache(): Map<number, string>
}

export type WorkspaceMemoCacheOwner =
  | { kind: 'self'; scope: string }
  | { kind: 'friend'; scope: string; friendUsername: string }

function memoCacheListQueryPrefix(owner: WorkspaceMemoCacheOwner) {
  if (owner.kind === 'friend') {
    return [
      'workspace',
      owner.scope,
      'friend',
      owner.friendUsername,
      'memos',
      'list',
    ] as const
  }

  return ['workspace', owner.scope, 'memos', 'list'] as const
}

function memoListQueryPrefix(scope: string) {
  return memoCacheListQueryPrefix({ kind: 'self', scope })
}

function memoListFiltersFromQueryKey(queryKey: QueryKey): MemoSearchQuery {
  const meta = queryKey[4]
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}

  const filters = (meta as { filters?: MemoSearchQuery }).filters
  return filters ?? {}
}

function isMemo(value: unknown): value is Memo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const item = value as Partial<Memo>
  return (
    typeof item.id === 'number' &&
    typeof item.content === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    Array.isArray(item.tags) &&
    Array.isArray(item.refs) &&
    Array.isArray(item.referencedBy)
  )
}

export function memoMatchesFilters(memo: Memo, filters: MemoSearchQuery) {
  return workspaceItemMatchesFilters(
    memo,
    filters,
    (item, activeFilters) =>
      !activeFilters.has_annotation ||
      item.refs.length > 0 ||
      item.referencedBy.length > 0,
  )
}

const memoListCache = createWorkspaceListCacheCore<Memo, MemoSearchQuery>({
  isItem: isMemo,
  filtersFromQueryKey: memoListFiltersFromQueryKey,
  matchesFilters: memoMatchesFilters,
})

export async function invalidateWorkspaceCollections(
  queryClient: QueryClient,
  scope: string,
) {
  await invalidateCollections(queryClient, [
    memoListQueryPrefix(scope),
    ['workspace', scope, 'stats'],
    ['workspace', scope, 'tag-tree'],
  ])
}

export function collectWorkspaceMemoListCacheMemos(
  queryClient: QueryClient,
  owner: WorkspaceMemoCacheOwner,
): Memo[] {
  return memoListCache.collect(queryClient, memoCacheListQueryPrefix(owner))
}

export function createWorkspaceMemoCacheIndex(
  queryClient: QueryClient,
  owner: WorkspaceMemoCacheOwner,
  seedMemos: readonly Memo[] = [],
): WorkspaceMemoCacheIndex {
  const memoById = new Map(
    collectWorkspaceMemoListCacheMemos(queryClient, owner).map((memo) => [
      memo.id,
      memo,
    ]),
  )
  for (const memo of seedMemos) memoById.set(memo.id, memo)
  const summaryCache = new Map<number, string>()

  return {
    getMemoById(id: number) {
      return memoById.get(id)
    },
    getSummaryCache() {
      return summaryCache
    },
  }
}

export function syncRenamedTagInWorkspaceCache(
  queryClient: QueryClient,
  scope: string,
  oldTag: string,
  newTag: string,
) {
  memoListCache.syncRenamedTag(
    queryClient,
    memoListQueryPrefix(scope),
    oldTag,
    newTag,
  )
}

export function syncDeletedTagInWorkspaceCache(
  queryClient: QueryClient,
  scope: string,
  deletedTag: string,
) {
  memoListCache.syncDeletedTag(
    queryClient,
    memoListQueryPrefix(scope),
    deletedTag,
  )
}

function removeMemoRefId(refs: string[], ref: string) {
  const nextRefs = refs.filter((item) => item !== ref)
  return nextRefs.length === refs.length ? refs : nextRefs
}

export function removeMemoFromWorkspaceCache(
  queryClient: QueryClient,
  scope: string,
  id: number,
) {
  const ref = String(id)
  memoListCache.transform(queryClient, memoListQueryPrefix(scope), (memo) => {
    if (memo.id === id) return undefined

    const refs = removeMemoRefId(memo.refs, ref)
    const referencedBy = removeMemoRefId(memo.referencedBy, ref)
    if (refs === memo.refs && referencedBy === memo.referencedBy) return memo

    return { ...memo, refs, referencedBy }
  })
}
