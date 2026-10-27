import { useMemo } from 'react'
import { useQueries, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/use-auth'
import type { UserProfile } from '@/features/auth/auth-types'

import {
  buildMemoFriendReferencePreview,
  mapMemo,
  mapMemoSearchPage,
  mergeMemoSearchPages,
  parseFriendMemoRef,
} from './memo-data'
import {
  createMemo,
  deleteMemo,
  deleteTag,
  getFriendMemo,
  getFriendStats,
  getFriendSummary,
  getFriendTagTree,
  getTagTree,
  getWorkspaceStats,
  renameTag,
  searchFriendMemos,
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
import type { FriendProfile, Memo, MemoRefId, MemoSearchQuery, MemoWriteRequest } from './workspace-types'

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
  friendSummary: (scope: string) =>
    [...workspaceQueryKeys.all, scope, 'friend', 'summary'] as const,
  friendStats: (scope: string, friendUsername: string) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'friend',
      friendUsername,
      'stats',
    ] as const,
  friendTagTree: (scope: string, friendUsername: string) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'friend',
      friendUsername,
      'tag-tree',
    ] as const,
  friendMemo: (scope: string, friendUsername: string, memoId: number) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'friend',
      friendUsername,
      'memos',
      memoId,
    ] as const,
  friendMemoLists: (scope: string, friendUsername: string) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'friend',
      friendUsername,
      'memos',
      'list',
    ] as const,
  friendMemoList: (
    scope: string,
    friendUsername: string,
    pageSize: number,
    filters: MemoSearchQuery = {},
  ) =>
    [
      ...workspaceQueryKeys.all,
      scope,
      'friend',
      friendUsername,
      'memos',
      'list',
      { pageSize, filters: sortQueryKeyValue(filters) },
    ] as const,
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

export function useFriendSummaryQuery() {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useQuery({
    enabled,
    queryKey: workspaceQueryKeys.friendSummary(scope),
    queryFn: async () => {
      const result = await getFriendSummary(token)

      return result.data
    },
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

export function useFriendWorkspaceStatsQuery(friendUsername: string) {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useQuery({
    enabled: enabled && Boolean(friendUsername),
    queryKey: workspaceQueryKeys.friendStats(scope, friendUsername),
    queryFn: async () => {
      const result = await getFriendStats(token, friendUsername)

      return result.data
    },
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

export function useFriendTagTreeQuery(friendUsername: string) {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useQuery({
    enabled: enabled && Boolean(friendUsername),
    queryKey: workspaceQueryKeys.friendTagTree(scope, friendUsername),
    queryFn: async () => {
      const result = await getFriendTagTree(token, friendUsername)

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

export function useFriendMemoListQuery(
  friendUsername: string,
  filters: MemoSearchQuery = {},
) {
  const { enabled, scope, token } = useWorkspaceQueryScope()

  return useInfiniteQuery({
    enabled: enabled && Boolean(friendUsername),
    queryKey: workspaceQueryKeys.friendMemoList(
      scope,
      friendUsername,
      MEMO_LIST_PAGE_SIZE,
      filters,
    ),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await searchFriendMemos(
        token,
        friendUsername,
        filters,
        pageParam,
        MEMO_LIST_PAGE_SIZE,
      )

      return mapMemoSearchPage(result.data)
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    select: (data) => mergeMemoSearchPages(data.pages),
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })
}

interface FriendReferenceRef {
  ref: MemoRefId
  username: string
  memoId: number
}

function parseOwnMemoId(ref: MemoRefId) {
  if (ref.includes('/')) return null

  const memoId = Number(ref)

  return Number.isInteger(memoId) && memoId > 0 ? memoId : null
}

function collectFriendReferenceRefs(
  memos: readonly Memo[],
  owningFriendUsername: string,
): FriendReferenceRef[] {
  const seen = new Set<MemoRefId>()
  const refs: FriendReferenceRef[] = []

  for (const memo of memos) {
    for (const ref of [...memo.refs, ...memo.referencedBy]) {
      if (seen.has(ref)) continue

      const parsed = parseFriendMemoRef(ref)
      const owningFriendMemoId = !parsed && owningFriendUsername
        ? parseOwnMemoId(ref)
        : null
      const resolvedRef = parsed ?? (owningFriendMemoId === null
        ? null
        : {
            username: owningFriendUsername,
            memoId: owningFriendMemoId,
          })
      if (!resolvedRef) continue

      seen.add(ref)
      refs.push({
        ref,
        username: resolvedRef.username,
        memoId: resolvedRef.memoId,
      })
    }
  }

  return refs
}

function friendLabel(friend: FriendProfile | undefined, username: string) {
  return friend?.nickname?.trim() || friend?.username?.trim() || username
}

export function useFriendReferencePreviewMap(
  memos: readonly Memo[],
  owningFriendUsername: string = '',
) {
  const { enabled, scope, token } = useWorkspaceQueryScope()
  const friendRefs = useMemo(
    () => collectFriendReferenceRefs(memos, owningFriendUsername),
    [memos, owningFriendUsername],
  )

  const friendSummaryQuery = useQuery({
    enabled: enabled && friendRefs.length > 0,
    queryKey: workspaceQueryKeys.friendSummary(scope),
    queryFn: async () => {
      const result = await getFriendSummary(token)

      return result.data
    },
    gcTime: WORKSPACE_CACHE_GC_TIME_MS,
    staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
  })

  const friendsByUsername = useMemo(
    () =>
      new Map(
        (friendSummaryQuery.data?.friends ?? []).map((friend) => [
          friend.username,
          friend,
        ]),
      ),
    [friendSummaryQuery.data],
  )

  const friendMemoQueries = useQueries({
    queries: friendRefs.map((ref) => ({
      enabled:
        enabled &&
        friendSummaryQuery.isSuccess &&
        friendsByUsername.has(ref.username),
      queryKey: workspaceQueryKeys.friendMemo(scope, ref.username, ref.memoId),
      queryFn: async () => {
        const result = await getFriendMemo(token, ref.username, ref.memoId)

        return mapMemo(result.data)
      },
      gcTime: WORKSPACE_CACHE_GC_TIME_MS,
      staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS,
    })),
  })

  return useMemo(() => {
    const previews = new Map<MemoRefId, ReturnType<typeof buildMemoFriendReferencePreview>>()
    const friendMemos = new Map<MemoRefId, Memo>()

    friendMemoQueries.forEach((query, index) => {
      const memo = query.data
      if (!memo) return

      const ref = friendRefs[index]
      if (!ref) return

      friendMemos.set(ref.ref, memo)
      previews.set(
        ref.ref,
        buildMemoFriendReferencePreview(
          ref.ref,
          memo,
          friendLabel(friendsByUsername.get(ref.username), ref.username),
        ),
      )
    })

    return {
      memos: friendMemos,
      previews,
      refetch() {
        return Promise.allSettled(
          friendMemoQueries.map((query) => query.refetch()),
        ).then(() => {})
      },
    }
  }, [friendMemoQueries, friendRefs, friendsByUsername])
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
