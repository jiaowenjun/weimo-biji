import type { DailyNoteCount } from '../models/workspace'

export interface HeatmapCell {
  date: string
  level: number
}

export interface HeatmapMonthLabel {
  name: string
  columnIndex: number
}

export interface HeatmapColumn {
  cells: HeatmapCell[]
  index: number
}

function startOfIsoWeek(date: Date) {
  const current = new Date(date)
  const day = current.getDay()
  const diff = day === 0 ? -6 : 1 - day
  current.setDate(current.getDate() + diff)
  current.setHours(0, 0, 0, 0)
  return current
}

function endOfIsoWeek(date: Date) {
  const current = startOfIsoWeek(date)
  current.setDate(current.getDate() + 6)
  current.setHours(23, 59, 59, 999)
  return current
}

function formatDateKey(input: Date) {
  const y = input.getFullYear()
  const m = String(input.getMonth() + 1).padStart(2, '0')
  const d = String(input.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateInt(input: Date) {
  return Number(formatDateKey(input).replaceAll('-', ''))
}

function getHeatmapLevel(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

export function buildHeatmapCells(data: DailyNoteCount, totalDays = 84): HeatmapCell[] {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - totalDays)

  const start = startOfIsoWeek(startDate)
  const end = endOfIsoWeek(endDate)
  const map = new Map<number, number>(data)
  const result: HeatmapCell[] = []

  const cursor = new Date(start)
  while (cursor <= end) {
    const count = map.get(formatDateInt(cursor)) ?? 0
    result.push({
      date: formatDateKey(cursor),
      level: getHeatmapLevel(count),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

export function buildHeatmapColumns(cells: HeatmapCell[]): HeatmapColumn[] {
  const columns: HeatmapColumn[] = []
  for (let i = 0; i < cells.length; i += 7) {
    columns.push({
      cells: cells.slice(i, i + 7),
      index: columns.length,
    })
  }
  return columns
}

export function buildHeatmapMonthLabels(cells: HeatmapCell[]): HeatmapMonthLabel[] {
  const labels: HeatmapMonthLabel[] = []

  for (let index = 0; index < cells.length; index += 7) {
    const column = cells.slice(index, index + 7)
    const monthStart = column.find((cell) => {
      const day = Number(cell.date.split('-')[2])
      return day === 1
    })

    if (monthStart) {
      const month = Number(monthStart.date.split('-')[1])
      labels.push({
        name: `${month}月`,
        columnIndex: index / 7,
      })
    }
  }

  return labels
}
