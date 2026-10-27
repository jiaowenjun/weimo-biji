export type Tag = string
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
  tags: Tag[]
  content: string
  refs?: MemoRefId[]
  referenced_by?: MemoRefId[]
}

export interface Memo {
  id: number
  createdAt: string
  updatedAt: string
  tags: Tag[]
  content: string
  refs: MemoRefId[]
  referencedBy: MemoRefId[]
}

export interface MemoSearchPageDto {
  items: MemoDto[]
  next_cursor: string | null
  has_more: boolean
  total_count: number
}

export interface MemoSearchPage {
  items: Memo[]
  nextCursor: string | null
  hasMore: boolean
  totalCount: number
}

export type MemoDateFilter =
  | { kind: 'day'; year: number; month: number; day: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }

export interface MemoTextFilter {
  contains: string
}

export interface MemoSearchQuery {
  tag?: Tag
  created_at?: MemoDateFilter
  text?: MemoTextFilter
  has_annotation?: boolean
  has_markdown_quote?: boolean
  has_heading?: boolean
  has_unordered_list?: boolean
  has_no_tag?: boolean
  /** 创建时间排序；缺省或由客户端省略时服务端视为 `desc` */
  created_at_sort?: 'asc' | 'desc'
}

export interface MemoQueryDraft {
  keyword: string
  selectedTag: string
  dateMode: MemoDateFilter['kind']
  dateValue: string
  listFacet: 'none' | 'annotation' | 'markdown-quote' | 'heading' | 'unordered-list'
}

/** 与全站/后端 `MemoSearchRequest` 搜索请求体字段对齐（如 weimo-server、weimo-react）；勿因本仓库未显式 import 而删除。 */
export interface MemoSearchRequest extends MemoSearchQuery {
  cursor?: string | null
  page_size?: number
}

export interface MemoWriteRequest {
  content: string
  tags: string[]
  refs?: MemoRefId[]
}
