import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/use-auth'
import type { UserProfile } from '@/features/auth/auth-types'

import { mapMemoSearchPage, mergeMemoSearchPages } from './memo-data'
import {
  createMemo,
  deleteMemo,
  deleteTag,
  getTagTree,
  getWorkspaceStats,
  renameTag,
  searchMemos,
  updateMemo,
} from './workspace-api'
import {
  invalidateWorkspaceCollections,
  removeMemoFromWorkspaceCache,
  syncDeletedTagInWorkspaceCache,
  syncRenamedTagInWorkspaceCache,
  WORKSPACE_CACHE_GC_TIME_MS,
  WORKSPACE_CACHE_STALE_TIME_MS,
} from './workspace-cache'
import type { MemoSearchQuery, MemoWriteRequest } from './workspace-types'

export const WORKSPACE_SIDEBAR_STALE_TIME_MS = WORKSPACE_CACHE_STALE_TIME_MS
export const MEMO_LIST_PAGE_SIZE = 8

function sortQueryKeyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortQueryKeyValue)

  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}

    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortQueryKeyValue((value as Record<string, unknown>)[key])
    }

    return sorted
  }

  return value
}

export const workspaceQueryKeys = {
  all: ['workspace'] as const,
  scope: (scope: string) => [...workspaceQueryKeys.all, scope] as const,
  stats: (scope: string) => [...workspaceQueryKeys.all, scope, 'stats'] as const,
  tagTree: (scope: string) => [...workspaceQueryKeys.all, scope, 'tag-tree'] as const,
  memoLists: (scope: string) =>
    [...workspaceQueryKeys.all, scope, 'memos', 'list'] as const,
  memoList: (
    scope: string,
    pageSize: number,
    filters: MemoSearchQuery = {},
  ) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'memos',
      'list',
      { pageSize, filters: sortQueryKeyValue(filters) },
    ] as const,
}

export function getWorkspaceQueryScope(user: UserProfile | null | undefined) {
  return user?.username ?? user?.login_name ?? 'anonymous'
}

function useWorkspaceQueryScope() {
  const { status, token, user } = useAuth()
  const enabled = status === 'authenticated' && Boolean(token)
  const scope = getWorkspaceQueryScope(user)

  return {
    enabled,
    scope,
    token: token ?? '',
  }
}

export function useWorkspaceStatsQuery() {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useQuery({
    enabled,
    queryKey: workspaceQueryKeys.stats(scope),
    queryFn: async () => {
      const result = await getWorkspaceStats(token)

      return result.data
    },
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

export function useTagTreeQuery() {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useQuery({
    enabled,
    queryKey: workspaceQueryKeys.tagTree(scope),
    queryFn: async () => {
      const result = await getTagTree(token)

      return result.data
    },
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

export function useMemoListQuery(filters: MemoSearchQuery = {}) {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useInfiniteQuery({
    enabled,
    queryKey: workspaceQueryKeys.memoList(scope, MEMO_LIST_PAGE_SIZE, filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await searchMemos(token, filters, pageParam, MEMO_LIST_PAGE_SIZE)

      return mapMemoSearchPage(result.data)
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    select: (data) => mergeMemoSearchPages(data.pages),
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

export function useCreateMemoMutation() {
  const queryClient = useQueryClient()
  const { scope, token } = useWorkspaceQueryScope()

  return useMutation({
    mutationFn: async (input: { payload: MemoWriteRequest }) => {
      const result = await createMemo(token, input.payload)

      return result.data
    },
    onSuccess: async () => {
      await invalidateWorkspaceCollections(queryClient, scope)
    },
  })
}

export function useUpdateMemoMutation() {
  const queryClient = useQueryClient()
  const { scope, token } = useWorkspaceQueryScope()

  return useMutation({
    mutationFn: async (input: { id: number; payload: MemoWriteRequest }) => {
      const result = await updateMemo(token, input.id, input.payload)

      return result.data
    },
    onSuccess: async () => {
      await invalidateWorkspaceCollections(queryClient, scope)
    },
  })
}

export function useDeleteMemoMutation() {
  const queryClient = useQueryClient()
  const { scope, token } = useWorkspaceQueryScope()

  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await deleteMemo(token, input.id)

      return result.data
    },
    onSuccess: async (_result, input) => {
      removeMemoFromWorkspaceCache(queryClient, scope, input.id)
      await invalidateWorkspaceCollections(queryClient, scope)
    },
  })
}

export function useRenameTagMutation() {
  const queryClient = useQueryClient()
  const { scope, token } = useWorkspaceQueryScope()

  return useMutation({
    mutationFn: async (input: { oldTag: string; newTag: string }) => {
      const result = await renameTag(token, input.oldTag, input.newTag)

      return result.data
    },
    onSuccess: async (_result, input) => {
      syncRenamedTagInWorkspaceCache(queryClient, scope, input.oldTag, input.newTag)
      await invalidateWorkspaceCollections(queryClient, scope)
    },
  })
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient()
  const { scope, token } = useWorkspaceQueryScope()

  return useMutation({
    mutationFn: async (input: { tag: string }) => {
      const result = await deleteTag(token, input.tag)

      return result.data
    },
    onSuccess: async (_result, input) => {
      syncDeletedTagInWorkspaceCache(queryClient, scope, input.tag)
      await invalidateWorkspaceCollections(queryClient, scope)
    },
  })
}

export function clearWorkspaceQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: workspaceQueryKeys.all })
}
