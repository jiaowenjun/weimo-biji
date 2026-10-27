import type { MemoQueryDraft } from '../../models/memo'
import type { MemoScopeStrategy } from '../../utils/memo-scope'
import type { MemoCardItem } from '../../utils/memo-list-presentation'
import { normalizeMemoQueryDraft } from '../../utils/memo-query'
import {
  friendMemoListLoadFailedPatch,
  friendMemoListLoadStartPatch,
  friendMemoListPagePatch,
} from './friend-memo-list'

export interface FriendMemoListHost {
  data: {
    memoCards: MemoCardItem[]
    memoNextCursor: string | null
    memoHasMore: boolean
    memoListRefreshing: boolean
    memoListLoadingMore: boolean
  }
  setData(patch: Record<string, unknown>): void
  updateEmptyState(): void
  _strategy: MemoScopeStrategy
}

export async function refreshFriendMemoList(
  host: FriendMemoListHost,
  draft: MemoQueryDraft,
  pageSize: number,
): Promise<void> {
  host.setData(friendMemoListLoadStartPatch(false))
  try {
    const result = await host._strategy.refresh(draft, pageSize)
    if (result.kind === 'page') {
      const relations = await host._strategy.resolveRelations(result.page)
      const keyword = normalizeMemoQueryDraft(draft).keyword
      host.setData(friendMemoListPagePatch(result.page, false, [], { ...relations, highlightKeyword: keyword }))
      host.updateEmptyState()
    }
  } catch {
    host.setData(friendMemoListLoadFailedPatch(false))
  }
}

export async function loadMoreFriendMemoList(
  host: FriendMemoListHost,
  draft: MemoQueryDraft,
  pageSize: number,
): Promise<void> {
  if (
    host.data.memoListRefreshing ||
    host.data.memoListLoadingMore ||
    !host.data.memoHasMore ||
    !host.data.memoNextCursor
  ) {
    return
  }
  host.setData(friendMemoListLoadStartPatch(true))
  try {
    const result = await host._strategy.loadMore(draft, host.data.memoNextCursor, pageSize)
    if (result.kind === 'page') {
      const relations = await host._strategy.resolveRelations(result.page)
      const keyword = normalizeMemoQueryDraft(draft).keyword
      host.setData(friendMemoListPagePatch(result.page, true, host.data.memoCards, { ...relations, highlightKeyword: keyword }))
    }
  } catch {
    host.setData(friendMemoListLoadFailedPatch(true))
  }
}
