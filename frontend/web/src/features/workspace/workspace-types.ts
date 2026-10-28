import type { WdfDocument } from 'weimo-wdf'

export type WdfMemoContent = WdfDocument

export type DailyNoteCount = Array<[number, number]>

export interface WorkspaceStats {
  note_count: number
  tag_count: number
  word_count: number
  daily_note_count: DailyNoteCount
}

export interface TagTreeMeta {
  label: string
  tag: string
  item_count: number
  children: TagTreeMeta[]
  untagged_count?: number
}

export type MemoRefId = string

export type MemoUtcArray = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export interface MemoDto {
  id: number
  ct_utc: MemoUtcArray
  mt_utc: MemoUtcArray
  tags: string[]
  content: WdfDocument
  refs?: MemoRefId[]
  referenced_by?: MemoRefId[]
}

export interface MemoSearchPageDto {
  items: MemoDto[]
  next_cursor: string | null
  has_more: boolean
  total_count: number
}

export interface Memo {
  id: number
  createdAt: string
  updatedAt: string
  tags: string[]
  content: WdfDocument
  refs: MemoRefId[]
  referencedBy: MemoRefId[]
}

export interface MemoSearchPage {
  items: Memo[]
  nextCursor: string | null
  hasMore: boolean
  totalCount: number
}

export interface MemoWriteRequest {
  content: WdfDocument
  tags: string[]
  refs?: MemoRefId[]
}

export type MemoDateFilter =
  | { kind: 'day'; year: number; month: number; day: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }

export interface MemoTextFilter {
  contains: string
}

export interface MemoSearchQuery {
  tag?: string
  created_at?: MemoDateFilter
  text?: MemoTextFilter
  has_annotation?: boolean
  has_markdown_quote?: boolean
  has_heading?: boolean
  has_unordered_list?: boolean
  has_no_tag?: boolean
  created_at_sort?: 'asc' | 'desc'
}
