import type { Memo, MemoQueryDraft, MemoSearchPage, MemoSearchQuery } from '../../models/memo'
import type { TagTreeMeta } from '../../models/tag'
import type { WorkspaceStats } from '../../models/workspace'
import type { MemoCardItem } from '../memo-list-presentation'
import type { CardActionsHost } from '../memo-list-card-actions'

export type HomeMemoScope = { kind: 'self' }

export type ScopeRefreshResult =
  | { kind: 'binding'; key: string }
  | { kind: 'page'; page: MemoSearchPage }

export interface MemoListRelationOptions {
  referenceMemos?: Memo[]
  referencedByMemos?: Memo[]
  inferredReferenceMemos?: Memo[]
}

export interface CardActionContext {
  memoCards: MemoCardItem[]
  host: CardActionsHost
  refreshList: () => Promise<void>
}

export interface MemoScopePageState {
  memoQuery: MemoQueryDraft
  memoDateLabel: string
  stats: WorkspaceStats | null
  tagTreeNodes: TagTreeMeta[]
}

export interface MemoScopeStrategy {
  readonly kind: 'self'

  buildSearchQuery(draft: MemoQueryDraft): MemoSearchQuery
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
