import type { MemoQueryDraft, MemoSearchQuery } from '../models/memo'
import { buildMemoDateFilter, formatMemoDateFilterLabel } from './memo-date-filter'
import type { MemoCreatedAtSort } from './memo-list-sort-prefs'
import { TAG_NONE_LITERAL } from './tag-none'

export function createEmptyMemoQueryDraft(): MemoQueryDraft {
  return {
    keyword: '',
    selectedTag: '',
    dateMode: 'day',
    dateValue: '',
    listFacet: 'none',
  }
}

export function cloneMemoQueryDraft(draft: MemoQueryDraft): MemoQueryDraft {
  return {
    keyword: draft.keyword,
    selectedTag: draft.selectedTag,
    dateMode: draft.dateMode,
    dateValue: draft.dateValue,
    listFacet: draft.listFacet,
  }
}

export function normalizeMemoQueryDraft(
  draft?: Partial<MemoQueryDraft> | null,
): MemoQueryDraft {
  const keyword = typeof draft?.keyword === 'string' ? draft.keyword.trim() : ''
  const selectedTag =
    typeof draft?.selectedTag === 'string' ? draft.selectedTag.trim() : ''
  const rawDateValue =
    typeof draft?.dateValue === 'string' ? draft.dateValue.trim() : ''
  const dateMode =
    draft?.dateMode === 'month' || draft?.dateMode === 'year'
      ? draft.dateMode
      : 'day'
  const listFacet =
    draft?.listFacet === 'annotation' ||
    draft?.listFacet === 'markdown-quote' ||
    draft?.listFacet === 'heading' ||
    draft?.listFacet === 'unordered-list'
      ? draft.listFacet
      : 'none'

  const filter = buildMemoDateFilter(dateMode, rawDateValue)
  if (!filter) {
    return {
      keyword,
      selectedTag,
      dateMode: 'day',
      dateValue: '',
      listFacet,
    }
  }

  return {
    keyword,
    selectedTag,
    dateMode: filter.kind,
    dateValue: rawDateValue,
    listFacet,
  }
}

export function isSameMemoQueryDraft(
  left: MemoQueryDraft,
  right: MemoQueryDraft,
): boolean {
  const a = normalizeMemoQueryDraft(left)
  const b = normalizeMemoQueryDraft(right)

  return (
    a.keyword === b.keyword &&
    a.selectedTag === b.selectedTag &&
    a.dateMode === b.dateMode &&
    a.dateValue === b.dateValue &&
    a.listFacet === b.listFacet
  )
}

export function buildMemoSearchQueryFromDraft(
  draft: MemoQueryDraft,
): MemoSearchQuery {
  const normalized = normalizeMemoQueryDraft(draft)
  const query: MemoSearchQuery = {}

  if (normalized.keyword) {
    query.text = { contains: normalized.keyword }
  }

  if (normalized.selectedTag) {
    if (normalized.selectedTag === TAG_NONE_LITERAL) {
      query.has_no_tag = true
    } else {
      query.tag = normalized.selectedTag
    }
  }

  if (normalized.dateValue) {
    const filter = buildMemoDateFilter(
      normalized.dateMode,
      normalized.dateValue,
    )
    if (filter) {
      query.created_at = filter
    }
  }

  if (normalized.listFacet === 'annotation') {
    query.has_annotation = true
  }
  if (normalized.listFacet === 'markdown-quote') {
    query.has_markdown_quote = true
  }
  if (normalized.listFacet === 'heading') {
    query.has_heading = true
  }
  if (normalized.listFacet === 'unordered-list') {
    query.has_unordered_list = true
  }

  return query
}

/** 首页列表：在筛选条件上附加创建时间排序；`desc` 不传字段以与历史缓存键一致 */
export function buildMemoListSearchQuery(
  draft: MemoQueryDraft,
  sort: MemoCreatedAtSort,
): MemoSearchQuery {
  const query = buildMemoSearchQueryFromDraft(draft)
  if (sort === 'asc') {
    query.created_at_sort = 'asc'
  }
  return query
}

export function formatMemoQueryDateLabel(draft: MemoQueryDraft): string {
  const normalized = normalizeMemoQueryDraft(draft)
  if (!normalized.dateValue) {
    return ''
  }

  return formatMemoDateFilterLabel(
    buildMemoDateFilter(normalized.dateMode, normalized.dateValue),
  )
}

export function hasActiveMemoQuery(draft: MemoQueryDraft): boolean {
  const normalized = normalizeMemoQueryDraft(draft)
  return Boolean(
    normalized.keyword || normalized.selectedTag || normalized.dateValue || normalized.listFacet !== 'none',
  )
}

export function formatMemoFacetLabel(facet: MemoQueryDraft['listFacet'] | undefined): string {
  switch (facet) {
    case 'annotation':
      return '有批注'
    case 'markdown-quote':
      return '有引用'
    case 'heading':
      return '有标题'
    case 'unordered-list':
      return '有列表'
    default:
      return ''
  }
}
