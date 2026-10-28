import type { CardNote } from '@/components/note-card'

import { WdfDocument, renderPlain } from 'weimo-wdf'
import type { WdfDocument as WdfDocumentType } from 'weimo-wdf'

import type {
  Memo,
  MemoDto,
  MemoRefId,
  MemoSearchPage,
  MemoSearchPageDto,
  MemoUtcArray,
} from './workspace-types'

export const REFERENCE_SUMMARY_MAX_LENGTH = 52

export interface MemoReferencePreview {
  id: MemoRefId
  displayText: string
}

export interface MemoReferenceSummaryCache {
  get(id: number): string | undefined
  set(id: number, displayText: string): void
}

export interface MemoReferencePreviewResolver {
  getMemoById(id: number): Memo | undefined
  summaryCache?: MemoReferenceSummaryCache
}

export function createMemoReferencePreviewResolver({
  getMemoById,
  summaryCache,
}: MemoReferencePreviewResolver): MemoReferencePreviewResolver {
  return {
    getMemoById,
    summaryCache,
  }
}

function isLeapYear(year: number) {
  if (year % 400 === 0) return true
  if (year % 100 === 0) return false
  return year % 4 === 0
}

function ordinalToMonthDay(year: number, ordinalDay: number) {
  const monthDays = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]

  let remaining = ordinalDay
  for (let index = 0; index < monthDays.length; index += 1) {
    if (remaining <= monthDays[index]) {
      return { monthIndex: index, day: remaining }
    }
    remaining -= monthDays[index]
  }

  return null
}

export function memoUtcArrayToIso(input: MemoUtcArray | number[]) {
  if (!Array.isArray(input)) return null

  const year = input[0]
  const ordinalDay = input[1]
  const hour = input[2]
  const minute = input[3]
  const second = input[4]
  const nanosecond = input[5]
  const offsetHour = input[6] ?? 0
  const offsetMinute = input[7] ?? 0
  const offsetSecond = input[8] ?? 0

  const values = [
    year,
    ordinalDay,
    hour,
    minute,
    second,
    nanosecond,
    offsetHour,
    offsetMinute,
    offsetSecond,
  ]

  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return null
  }

  const monthDay = ordinalToMonthDay(year, ordinalDay)
  if (!monthDay) return null

  const milliseconds = Math.floor(nanosecond / 1_000_000)
  const utcMs = Date.UTC(
    year,
    monthDay.monthIndex,
    monthDay.day,
    hour,
    minute,
    second,
    milliseconds,
  )
  const offsetSeconds = offsetHour * 3600 + offsetMinute * 60 + offsetSecond
  const date = new Date(utcMs - offsetSeconds * 1000)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function normalizeMemoRefs(ids: unknown): MemoRefId[] {
  if (!Array.isArray(ids)) return []

  return ids
    .map((id) => {
      if (typeof id === 'string') return id.trim()
      if (typeof id === 'number' && Number.isFinite(id)) return String(id)
      return ''
    })
    .filter((id): id is MemoRefId => id.length > 0)
}

function normalizeMemoTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0)
}

export function mapMemo(dto: MemoDto): Memo {
  return {
    id: dto.id,
    createdAt: memoUtcArrayToIso(dto.ct_utc) ?? '',
    updatedAt: memoUtcArrayToIso(dto.mt_utc) ?? '',
    tags: normalizeMemoTags(dto.tags),
    content: dto.content,
    refs: normalizeMemoRefs(dto.refs),
    referencedBy: normalizeMemoRefs(dto.referenced_by),
  }
}

export function mapMemoSearchPage(dto: MemoSearchPageDto): MemoSearchPage {
  return {
    items: dto.items.map(mapMemo),
    nextCursor: dto.next_cursor,
    hasMore: dto.has_more,
    totalCount: dto.total_count,
  }
}

export function mergeMemoSearchPages(pages: MemoSearchPage[]): MemoSearchPage {
  const lastPage = pages[pages.length - 1]

  return {
    items: pages.flatMap((page) => page.items),
    nextCursor: lastPage?.nextCursor ?? null,
    hasMore: lastPage?.hasMore ?? false,
    totalCount: lastPage?.totalCount ?? 0,
  }
}

export function formatMemoTimestamp(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function summarizeMemoContent(content: WdfDocumentType): string {
  const oneLine = renderPlain(content).replace(/\s+/g, ' ').trim()
  if (oneLine.length <= REFERENCE_SUMMARY_MAX_LENGTH) return oneLine

  return `${oneLine.slice(0, REFERENCE_SUMMARY_MAX_LENGTH)}...`
}

export function buildMemoReferenceFallbackText(id: MemoRefId): string {
  return `笔记${id}`
}

function toReferenceDateText(dateText: string): string {
  return dateText.trim().split(/\s+/)[0] ?? ''
}

export function buildMemoReferenceDisplayText(
  dateText: string,
  content: WdfDocumentType,
): string {
  const dateOnlyText = toReferenceDateText(dateText)
  const summary = summarizeMemoContent(content)

  if (!dateOnlyText && !summary) return ''
  if (!dateOnlyText) return summary
  if (!summary) return dateOnlyText

  return `${dateOnlyText}：${summary}`
}

function toOwnMemoId(ref: MemoRefId): number | null {
  if (ref.includes('/')) return null

  const id = Number(ref)

  return Number.isFinite(id) && id > 0 ? id : null
}

function buildMemoReferencePreview(
  id: MemoRefId,
  resolver: MemoReferencePreviewResolver,
): MemoReferencePreview {
  const fallbackText = buildMemoReferenceFallbackText(id)
  const ownId = toOwnMemoId(id)
  if (ownId === null) return { id, displayText: fallbackText }

  const cachedSummary = resolver.summaryCache?.get(ownId)
  if (cachedSummary) return { id, displayText: cachedSummary }

  const memo = resolver.getMemoById(ownId)

  if (!memo) return { id, displayText: fallbackText }

  const displayText = buildMemoReferenceDisplayText(
    formatMemoTimestamp(memo.createdAt),
    memo.content,
  )

  const preview = {
    id,
    displayText: displayText || fallbackText,
  }

  resolver.summaryCache?.set(ownId, preview.displayText)

  return preview
}

function toMemoReferencePreviewResolver(
  resolverOrMemoById: MemoReferencePreviewResolver | ReadonlyMap<number, Memo>,
): MemoReferencePreviewResolver {
  if ('getMemoById' in resolverOrMemoById) return resolverOrMemoById

  return {
    getMemoById: (id) => resolverOrMemoById.get(id),
  }
}

export function buildMemoReferencePreviews(
  memo: Memo,
  resolverOrMemoById: MemoReferencePreviewResolver | ReadonlyMap<number, Memo>,
) {
  const resolver = toMemoReferencePreviewResolver(resolverOrMemoById)
  const referenceId = memo.refs[0] ?? null
  const referencePreview = referenceId
    ? buildMemoReferencePreview(referenceId, resolver)
    : null
  const referencedByPreviews = memo.referencedBy.map((id) =>
    buildMemoReferencePreview(id, resolver),
  )

  return {
    referencePreview,
    referencedByPreviews,
  }
}

export function toCardNote(memo: Memo): CardNote {
  const tags = normalizeMemoTags(memo.tags)

  return {
    content: memo.content,
    createdAtText: formatMemoTimestamp(memo.createdAt),
    tags: tags.length > 0 ? tags : undefined,
  }
}

export function createEmptyCardNote(createdAtText: string): CardNote {
  return {
    content: WdfDocument.empty(),
    createdAtText,
  }
}
