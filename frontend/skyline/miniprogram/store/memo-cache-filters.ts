import type { Memo, MemoDateFilter, MemoSearchQuery } from '../models/memo'

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
  return memo.content.includes(t)
}

function matchesAnnotationFilter(memo: Memo, hasAnnotation?: boolean): boolean {
  if (!hasAnnotation) return true
  const hasRefs = memo.refs.length > 0
  const isReferenced = memo.referencedBy.length > 0
  return hasRefs || isReferenced
}

function matchesMarkdownQuoteFilter(memo: Memo, hasMarkdownQuote?: boolean): boolean {
  if (!hasMarkdownQuote) return true
  return memo.content.split('\n').some((line) => {
    const t = line.trimStart()
    return t === '>' || t.startsWith('> ') || t === '>=' || t.startsWith('>= ')
  })
}

function matchesHeadingFilter(memo: Memo, hasHeading?: boolean): boolean {
  if (!hasHeading) return true
  return memo.content.split('\n').some((line) => {
    const t = line.trimStart()
    let hashes = 0
    while (hashes < t.length && t[hashes] === '#') hashes++
    if (hashes < 1 || hashes > 6) return false
    const after = t.slice(hashes)
    return after.length === 0 || after.startsWith(' ')
  })
}

function isHorizontalRule(line: string, marker: string): boolean {
  if (marker !== '*' && marker !== '-') return false
  let count = 0
  for (const c of line) {
    if (c === marker) count++
    else if (c !== ' ' && c !== '\t') return false
  }
  return count >= 3
}

function matchesUnorderedListFilter(memo: Memo, hasUnorderedList?: boolean): boolean {
  if (!hasUnorderedList) return true
  return memo.content.split('\n').some((line) => {
    const t = line.trimStart()
    if (t.length < 2) return false
    const marker = t[0]
    if (marker !== '*' && marker !== '+' && marker !== '-') return false
    const next = t[1]
    if (next !== ' ' && next !== '\t') return false
    return !isHorizontalRule(t, marker)
  })
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
