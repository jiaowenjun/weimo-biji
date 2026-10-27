import type { MemoReferencePreviewResolver } from './memo-data'
import type { Memo } from './workspace-types'

export type WorkspaceMemoDetailRelationItem = { kind: 'memo'; memo: Memo }

export interface WorkspaceMemoDetailProjection {
  rootMemo: Memo
  referenceItems: WorkspaceMemoDetailRelationItem[]
  referencedByItems: WorkspaceMemoDetailRelationItem[]
}

function orderedItemsByRef(
  refs: readonly string[],
  memoById: ReadonlyMap<number, Memo>,
  resolver: MemoReferencePreviewResolver,
) {
  const seen = new Set<number>()
  const seenRefs = new Set<string>()
  const items: WorkspaceMemoDetailRelationItem[] = []

  for (const ref of refs) {
    if (seenRefs.has(ref)) continue
    seenRefs.add(ref)
    if (ref.includes('/')) continue

    const id = Number(ref)
    if (!Number.isFinite(id) || seen.has(id)) continue

    const memo = memoById.get(id) ?? resolver.getMemoById(id)
    if (!memo) continue

    seen.add(id)
    items.push({ kind: 'memo', memo })
  }

  return items
}

export function buildWorkspaceMemoDetailProjection(
  memo: Memo,
  memos: readonly Memo[],
  resolver: MemoReferencePreviewResolver,
): WorkspaceMemoDetailProjection {
  const memoById = new Map(memos.map((item) => [item.id, item]))

  return {
    rootMemo: memo,
    referenceItems: orderedItemsByRef(memo.refs, memoById, resolver),
    referencedByItems: orderedItemsByRef(memo.referencedBy, memoById, resolver),
  }
}
