import type {
  FriendMemoDto,
  FriendMemoSearchPageDto,
  FriendNotificationList,
  FriendRequestDto,
  FriendSearchResult,
  FriendSummary,
  FriendUnreadCount,
} from '../models/friend'
import type { MemoDateFilter, MemoTextFilter } from '../models/memo'
import type { TagTreeMeta } from '../models/tag'
import type { WorkspaceStats } from '../models/workspace'
import { mapMemo, mapMemoSearchPage } from '../utils/memo-mapper'
import { request } from '../utils/request'

const FRIEND_MEMO_PAGE_SIZE = 8

/**
 * 将显式目标好友的 username 编码为 friend 资源 URL 路径段。
 * 这里的 `username` 表示 API 目标好友，不等于当前选中态或 `friends[]` 集合本身。
 */
function friendPath(username: string): string {
  return encodeURIComponent(String(username || '').trim())
}

export interface FriendMemoSearchFilters {
  tag?: string
  createdAt?: MemoDateFilter | null
  text?: MemoTextFilter | null
  hasAnnotation?: boolean
  hasMarkdownQuote?: boolean
  hasHeading?: boolean
  hasUnorderedList?: boolean
  /** 与服务端 `created_at_sort` 对齐；省略视为 desc */
  createdAtSort?: 'asc' | 'desc'
}

type FriendMemoSearchPayload = {
  cursor?: string
  page_size: number
  tag?: string
  created_at?: MemoDateFilter
  text?: MemoTextFilter
  has_annotation?: boolean
  has_markdown_quote?: boolean
  has_heading?: boolean
  has_unordered_list?: boolean
  created_at_sort?: 'asc'
}

export function getFriendSummary() {
  return request<FriendSummary>({ url: '/friend/me' })
}

export function getFriendUnreadCount() {
  return request<FriendUnreadCount>({ url: '/friend/unread-count' })
}

export function getFriendStats(friendUsername: string) {
  return request<WorkspaceStats>({ url: `/friend/${friendPath(friendUsername)}/stats` })
}

export function getFriendTagTree(friendUsername: string) {
  return request<TagTreeMeta>({ url: `/friend/${friendPath(friendUsername)}/tag/meta` })
}

export function searchFriendsByNickname(nickname: string) {
  return request<FriendSearchResult>({
    url: `/friend/search?nickname=${encodeURIComponent(nickname)}`,
  })
}

export function createFriendRequest(toUsername: string) {
  return request<FriendRequestDto, { to_username: string }>({
    url: '/friend/request',
    method: 'POST',
    data: { to_username: toUsername },
  })
}

export function getFriendNotifications() {
  return request<FriendNotificationList>({ url: '/friend/notifications' })
}

export function markFriendNotificationsRead() {
  return request<void>({
    url: '/friend/notifications/read',
    method: 'POST',
  })
}

export function acceptFriendRequest(requestId: string) {
  return request<FriendSummary>({
    url: `/friend/requests/${encodeURIComponent(requestId)}/accept`,
    method: 'POST',
  })
}

export function searchFriendMemos(
  friendUsername: string,
  filters: FriendMemoSearchFilters = {},
  cursor?: string | null,
  pageSize = FRIEND_MEMO_PAGE_SIZE,
) {
  const data: FriendMemoSearchPayload = { page_size: pageSize }
  const tag = typeof filters.tag === 'string' ? filters.tag.trim() : ''
  if (tag) data.tag = tag
  if (filters.createdAt) data.created_at = filters.createdAt
  if (filters.text) data.text = filters.text
  if (filters.hasAnnotation) data.has_annotation = true
  if (filters.hasMarkdownQuote) data.has_markdown_quote = true
  if (filters.hasHeading) data.has_heading = true
  if (filters.hasUnorderedList) data.has_unordered_list = true
  if (filters.createdAtSort === 'asc') data.created_at_sort = 'asc'
  if (cursor) data.cursor = cursor

  return request<FriendMemoSearchPageDto, FriendMemoSearchPayload>({
    url: `/friend/${friendPath(friendUsername)}/memos/search`,
    method: 'POST',
    data,
  }).then(mapMemoSearchPage)
}

export function getFriendMemo(friendUsername: string, id: number) {
  return request<FriendMemoDto>({
    url: `/friend/${friendPath(friendUsername)}/memos/${id}`,
    method: 'GET',
  }).then(mapMemo)
}
