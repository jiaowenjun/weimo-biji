import type { FriendProfile } from '../../models/friend'
import type { Memo, MemoQueryDraft, MemoSearchPage, MemoSearchQuery } from '../../models/memo'
import type { TagTreeMeta } from '../../models/tag'
import type { WorkspaceStats } from '../../models/workspace'
import type { FriendMemoSearchFilters } from '../../services/friend'
import type { MemoCardItem } from '../memo-list-presentation'
import type { CardActionsHost } from '../memo-list-card-actions'

export type HomeMemoScope =
  | { kind: 'self' }
  | {
      kind: 'friend'
      /** 进入 friend scope 时锁定的好友 profile 快照；`syncFriendSummary()` 会用最新摘要刷新它。 */
      targetFriend: FriendProfile
    }

export type ScopeRefreshResult =
  | { kind: 'binding'; key: string }
  | { kind: 'page'; page: MemoSearchPage }

export interface MemoListRelationOptions {
  friendUsername?: string
  friendNickname?: string
  referenceMemos?: Memo[]
  referencedByMemos?: Memo[]
  inferredReferenceMemos?: Memo[]
}

export interface CardActionContext {
  memoCards: MemoCardItem[]
  host: CardActionsHost
  friend?: FriendProfile
  refreshList: () => Promise<void>
}

export interface MemoScopePageState {
  memoQuery: MemoQueryDraft
  friendMemoQuery: MemoQueryDraft
  memoDateLabel: string
  friendMemoDateLabel: string
  stats: WorkspaceStats | null
  friendStats: WorkspaceStats | null
  tagTreeNodes: TagTreeMeta[]
  friendTagTreeNodes: TagTreeMeta[]
}

export interface MemoScopeStrategy {
  readonly kind: 'self' | 'friend'

  getFriend(): FriendProfile | undefined
  buildSearchQuery(draft: MemoQueryDraft): MemoSearchQuery | FriendMemoSearchFilters
  refresh(draft: MemoQueryDraft, pageSize: number): Promise<ScopeRefreshResult>
  loadMore(draft: MemoQueryDraft, cursor: string, pageSize: number): Promise<ScopeRefreshResult>
  resolveRelations(page: MemoSearchPage): Promise<MemoListRelationOptions>

  getCurrentQuery(data: MemoScopePageState): MemoQueryDraft
  getCurrentDateLabel(data: MemoScopePageState): string
  getStats(data: MemoScopePageState): WorkspaceStats | null
  getTagTreeNodes(data: MemoScopePageState): TagTreeMeta[]

  onCardDoubleTap(ctx: CardActionContext, memoId: number): void
  onCardQuote(ctx: CardActionContext, memoId: number): void
  onCardReferenceTap(memoId: number): void
}
