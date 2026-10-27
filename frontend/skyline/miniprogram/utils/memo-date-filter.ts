import type { MemoDateFilter } from '../models/memo'

export type MemoDateFilterMode = MemoDateFilter['kind']

function isValidDay(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function buildMemoDateFilter(
  mode: MemoDateFilterMode,
  value: string,
): MemoDateFilter | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  if (mode === 'day') {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return undefined

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    if (!isValidDay(year, month, day)) {
      return undefined
    }

    return { kind: 'day', year, month, day }
  }

  if (mode === 'month') {
    const match = trimmed.match(/^(\d{4})-(\d{2})$/)
    if (!match) return undefined

    const year = Number(match[1])
    const month = Number(match[2])

    if (month < 1 || month > 12) {
      return undefined
    }

    return { kind: 'month', year, month }
  }

  const match = trimmed.match(/^(\d{4})$/)
  if (!match) return undefined

  return { kind: 'year', year: Number(match[1]) }
}

export function formatMemoDateFilterLabel(filter?: MemoDateFilter) {
  if (!filter) {
    return ''
  }

  if (filter.kind === 'day') {
    return `${filter.year}年${filter.month}月${filter.day}日`
  }

  if (filter.kind === 'month') {
    return `${filter.year}年${filter.month}月`
  }

  return `${filter.year}年`
}

export function formatLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalMonthInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function formatLocalYearInputValue(date = new Date()) {
  return String(date.getFullYear())
}
