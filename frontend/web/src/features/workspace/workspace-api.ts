import { requestProtectedJson } from '@/features/auth/auth-api'

import {
  friendSummarySchema,
  memoDtoSchema,
  memoSearchPageDtoSchema,
  mutationIdSchema,
  tagMutationResultSchema,
  tagTreeMetaSchema,
  workspaceStatsSchema,
} from './workspace-contracts'
import type { MemoSearchQuery, MemoWriteRequest } from './workspace-types'

export function getWorkspaceStats(token: string) {
  return requestProtectedJson('/me/stats', token, workspaceStatsSchema)
}

export function getTagTree(token: string) {
  return requestProtectedJson('/tag/meta', token, tagTreeMetaSchema)
}

function encodeTagPathParam(tag: string) {
  return encodeURIComponent(tag.replaceAll('/', '|'))
}

export function renameTag(token: string, oldTag: string, newTag: string) {
  return requestProtectedJson(
    `/tag/${encodeTagPathParam(oldTag)}`,
    token,
    tagMutationResultSchema,
    {
      body: JSON.stringify({ new_tag: newTag }),
      method: 'PUT',
    },
  )
}

export function deleteTag(token: string, tag: string) {
  return requestProtectedJson(
    `/tag/${encodeTagPathParam(tag)}`,
    token,
    tagMutationResultSchema,
    {
      method: 'DELETE',
    },
  )
}

function friendPath(username: string) {
  return encodeURIComponent(String(username || '').trim())
}

export function getFriendSummary(token: string) {
  return requestProtectedJson('/friend/me', token, friendSummarySchema)
}

export function getFriendStats(token: string, friendUsername: string) {
  return requestProtectedJson(
    `/friend/${friendPath(friendUsername)}/stats`,
    token,
    workspaceStatsSchema,
  )
}

export function getFriendTagTree(token: string, friendUsername: string) {
  return requestProtectedJson(
    `/friend/${friendPath(friendUsername)}/tag/meta`,
    token,
    tagTreeMetaSchema,
  )
}

export function getFriendMemo(token: string, friendUsername: string, id: number) {
  return requestProtectedJson(
    `/friend/${friendPath(friendUsername)}/memos/${id}`,
    token,
    memoDtoSchema,
  )
}

function buildMemoSearchPayload(
  filters: MemoSearchQuery = {},
  cursor: string | null = null,
  pageSize = 8,
) {
  const payload: Record<string, unknown> = {
    page_size: pageSize,
  }

  if (cursor) {
    payload.cursor = cursor
  }

  if (filters.created_at) {
    payload.created_at = filters.created_at
  }

  if (filters.tag) {
    payload.tag = filters.tag
  }

  if (filters.text?.contains) {
    payload.text = { contains: filters.text.contains }
  }

  if (filters.has_annotation) {
    payload.has_annotation = true
  }

  if (filters.has_markdown_quote) {
    payload.has_markdown_quote = true
  }

  if (filters.has_heading) {
    payload.has_heading = true
  }

  if (filters.has_unordered_list) {
    payload.has_unordered_list = true
  }

  if (filters.has_no_tag) {
    payload.has_no_tag = true
  }

  if (filters.created_at_sort === 'asc') {
    payload.created_at_sort = 'asc'
  }

  return payload
}

export function searchMemos(
  token: string,
  filters: MemoSearchQuery = {},
  cursor: string | null = null,
  pageSize = 8,
) {
  const payload = buildMemoSearchPayload(filters, cursor, pageSize)

  return requestProtectedJson('/memo/search', token, memoSearchPageDtoSchema, {
    body: JSON.stringify(payload),
    method: 'POST',
  })
}

export function searchFriendMemos(
  token: string,
  friendUsername: string,
  filters: MemoSearchQuery = {},
  cursor: string | null = null,
  pageSize = 8,
) {
  const payload = buildMemoSearchPayload(filters, cursor, pageSize)

  return requestProtectedJson(
    `/friend/${friendPath(friendUsername)}/memos/search`,
    token,
    memoSearchPageDtoSchema,
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
  )
}

export function updateMemo(
  token: string,
  id: number,
  payload: MemoWriteRequest,
) {
  return requestProtectedJson(`/memo/${id}`, token, mutationIdSchema, {
    body: JSON.stringify(payload),
    method: 'PUT',
  })
}

export function createMemo(
  token: string,
  payload: MemoWriteRequest,
) {
  return requestProtectedJson('/memo', token, mutationIdSchema, {
    body: JSON.stringify(payload),
    method: 'POST',
  })
}

export function deleteMemo(token: string, id: number) {
  return requestProtectedJson(`/memo/${id}`, token, mutationIdSchema, {
    method: 'DELETE',
  })
}
