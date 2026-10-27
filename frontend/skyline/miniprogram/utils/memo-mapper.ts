import type {
  Memo,
  MemoDto,
  MemoRefId,
  MemoSearchPage,
  MemoSearchPageDto,
  MemoUtcArray,
} from '../models/memo'

function isLeapYear(year: number) {
  if (year % 400 === 0) return true
  if (year % 100 === 0) return false
  return year % 4 === 0
}

function ordinalToMonthDay(year: number, ordinalDay: number) {
  const monthDays = [
    31,
    isLeapYear(year) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ]

  let remaining = ordinalDay
  for (let i = 0; i < monthDays.length; i++) {
    if (remaining <= monthDays[i]) {
      return { monthIndex: i, day: remaining }
    }
    remaining -= monthDays[i]
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
    year, ordinalDay, hour, minute, second, nanosecond,
    offsetHour, offsetMinute, offsetSecond,
  ]

  if (!values.every(v => typeof v === 'number' && Number.isFinite(v))) {
    return null
  }

  const monthDay = ordinalToMonthDay(year, ordinalDay)
  if (!monthDay) return null

  const milliseconds = Math.floor(nanosecond / 1_000_000)
  const utcMs = Date.UTC(
    year, monthDay.monthIndex, monthDay.day,
    hour, minute, second, milliseconds,
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

export function mapMemo(dto: MemoDto): Memo {
  return {
    id: dto.id,
    createdAt: memoUtcArrayToIso(dto.ct_utc) ?? '',
    updatedAt: memoUtcArrayToIso(dto.mt_utc) ?? '',
    tags: dto.tags,
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
