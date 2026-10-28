import type { Memo, MemoDateFilter, MemoSearchQuery } from '../models/memo'
import { wdfDocumentToPlainText } from '../utils/wdf'

function matchesDateFilter(memo: Memo, filter?: MemoDateFilter): boolean {
  if (!filter) return true
  const d = new Date(memo.createdAt)
  if (Number.isNaN(d.getTime())) return false
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (filter.kind === 'day') return y === filter.year && m === filter.month && day === filter.day
  if (filter.kind === 'month') return y === filter.year && m === filter.month
  return y === filter.year
}

function matchesTagFilter(memo: Memo, tag?: string): boolean {
  const t = tag?.trim()
  if (!t) return true
  const prefix = `${t}/`
  return memo.tags.some((mt) => mt === t || mt.startsWith(prefix))
}

function matchesTextFilter(memo: Memo, contains?: string): boolean {
  const t = contains?.trim()
  if (!t) return true
  return wdfDocumentToPlainText(memo.content)
    .toLowerCase()
    .includes(t.toLowerCase())
}

function matchesAnnotationFilter(memo: Memo, hasAnnotation?: boolean): boolean {
  if (!hasAnnotation) return true
  const hasRefs = memo.refs.length > 0
  const isReferenced = memo.referencedBy.length > 0
  return hasRefs || isReferenced
}

function matchesMarkdownQuoteFilter(memo: Memo, hasMarkdownQuote?: boolean): boolean {
  if (!hasMarkdownQuote) return true
  return memo.content.root.content.some((block) => block.type === 'blockquote')
}

function matchesHeadingFilter(memo: Memo, hasHeading?: boolean): boolean {
  if (!hasHeading) return true
  return memo.content.root.content.some((block) => block.type === 'heading')
}

function matchesUnorderedListFilter(memo: Memo, hasUnorderedList?: boolean): boolean {
  if (!hasUnorderedList) return true
  return memo.content.root.content.some((block) => block.type === 'bullet_list')
}

export function memoMatchesFilters(memo: Memo, filters: MemoSearchQuery): boolean {
  return (
    matchesTagFilter(memo, filters.tag) &&
    matchesTextFilter(memo, filters.text?.contains) &&
    matchesDateFilter(memo, filters.created_at) &&
    matchesAnnotationFilter(memo, filters.has_annotation) &&
    matchesMarkdownQuoteFilter(memo, filters.has_markdown_quote) &&
    matchesHeadingFilter(memo, filters.has_heading) &&
    matchesUnorderedListFilter(memo, filters.has_unordered_list)
  )
}

export function remapMemoTagPath(tag: string, oldTag: string, newTag: string): string {
  if (tag === oldTag) return newTag
  const oldPrefix = `${oldTag}/`
  if (tag.startsWith(oldPrefix)) return `${newTag}${tag.slice(oldTag.length)}`
  return tag
}
