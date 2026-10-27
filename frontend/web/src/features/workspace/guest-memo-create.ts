import type { MemoCreateInput } from './use-memo-create'
import type { Memo } from './workspace-types'

function createGuestMemoId(memos: Memo[]) {
  return memos.reduce((maxId, memo) => Math.max(maxId, memo.id), 0) + 1
}

export function buildGuestMemo(
  memos: Memo[],
  { content, tags }: MemoCreateInput,
  now = new Date().toISOString(),
): Memo {
  return {
    id: createGuestMemoId(memos),
    content,
    tags,
    createdAt: now,
    updatedAt: now,
    refs: [],
    referencedBy: [],
  }
}
