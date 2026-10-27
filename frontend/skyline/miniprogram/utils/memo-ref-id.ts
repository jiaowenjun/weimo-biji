import type { MemoRefId } from '../models/memo'

export interface FriendMemoRefParts {
  username: string
  memoId: number
}

export function ownMemoIdFromRef(ref: MemoRefId): number | null {
  if (ref.includes('/')) return null
  const id = Number(ref)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function parseFriendMemoRef(ref: MemoRefId): FriendMemoRefParts | null {
  const parts = ref.split('/')
  if (parts.length !== 2 || !parts[0]) return null
  const memoId = Number(parts[1])
  if (!Number.isFinite(memoId) || memoId <= 0) return null
  return { username: parts[0], memoId }
}

export function uniqueOwnMemoIds(refs: MemoRefId[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const ref of refs) {
    const id = ownMemoIdFromRef(ref)
    if (id === null || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function appendMemoRefId(ids: MemoRefId[], id: MemoRefId): MemoRefId[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function removeMemoRefId(ids: MemoRefId[], id: MemoRefId): MemoRefId[] {
  if (!ids.includes(id)) return ids
  return ids.filter((candidate) => candidate !== id)
}
