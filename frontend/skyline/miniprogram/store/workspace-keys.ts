import type { MemoSearchQuery } from '../models/memo'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k])
    }
    return out
  }
  return value
}

export function memoListKeyFromQuery(filters: MemoSearchQuery, pageSize: number): string {
  return `memos:list:${pageSize}:${JSON.stringify(sortKeys(filters))}`
}
