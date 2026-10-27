import type { MemoDto, MemoSearchPageDto, MemoSearchQuery, MemoWriteRequest } from '../models/memo'
import { request } from '../utils/request'
import { mapMemo, mapMemoSearchPage } from '../utils/memo-mapper'

const MEMO_PAGE_SIZE = 8

function buildSearchPayload(
  filters: MemoSearchQuery,
  cursor?: string | null,
  pageSize = MEMO_PAGE_SIZE,
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

export function createMemo(payload: MemoWriteRequest) {
  return request<number, MemoWriteRequest>({
    url: '/memo',
    method: 'POST',
    data: payload,
  })
}

export function updateMemo(id: number, payload: MemoWriteRequest) {
  return request<number, MemoWriteRequest>({
    url: `/memo/${id}`,
    method: 'PUT',
    data: payload,
  })
}

export function deleteMemo(id: number) {
  return request<number>({
    url: `/memo/${id}`,
    method: 'DELETE',
  })
}

export function getMemo(id: number) {
  return request<MemoDto>({
    url: `/memo/${id}`,
    method: 'GET',
  }).then(mapMemo)
}

export function getMemos(ids: number[]) {
  if (ids.length === 0) return Promise.resolve([])

  return request<MemoDto[], number[]>({
    url: '/memo/batch',
    method: 'POST',
    data: ids,
  }).then((items) => items.map(mapMemo))
}

export function searchMemos(
  filters: MemoSearchQuery = {},
  cursor?: string | null,
  pageSize = MEMO_PAGE_SIZE,
) {
  const data = buildSearchPayload(filters, cursor, pageSize)

  return request<MemoSearchPageDto, typeof data>({
    url: '/memo/search',
    method: 'POST',
    data,
  }).then(mapMemoSearchPage)
}
