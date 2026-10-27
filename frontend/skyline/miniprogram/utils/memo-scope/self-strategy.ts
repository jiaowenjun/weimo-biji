import type { MemoQueryDraft } from '../../models/memo'
import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'
import { memoListKeyFromQuery } from '../../store/workspace-keys'
import type { MemoCreatedAtSort } from '../memo-list-sort-prefs'
import { readMemoCardDoubleTapBehavior } from '../memo-card-double-tap-prefs'
import {
  openEditComposeForCard,
  openMemoShareForCard,
  openQuoteComposeForCard,
} from '../memo-list-card-actions'
import { buildMemoListSearchQuery, normalizeMemoQueryDraft } from '../memo-query'
import { openMemoReferenceDetail } from '../navigation'
import type { CardActionContext, MemoScopeStrategy, ScopeRefreshResult } from './types'

function buildSelfMergedSearchQuery(draft: MemoQueryDraft, sort: MemoCreatedAtSort) {
  return buildMemoListSearchQuery(normalizeMemoQueryDraft(draft), sort)
}

export function createSelfScopeStrategy(getSort: () => MemoCreatedAtSort): MemoScopeStrategy {
  return {
    kind: 'self',

    getFriend() {
      return undefined
    },

    buildSearchQuery(draft: MemoQueryDraft) {
      return buildSelfMergedSearchQuery(draft, getSort())
    },

    async refresh(draft: MemoQueryDraft, pageSize: number): Promise<ScopeRefreshResult> {
      const query = buildSelfMergedSearchQuery(draft, getSort())
      const key = memoListKeyFromQuery(query, pageSize)
      await workspaceStore.ensureMemoList(key, query, pageSize)
      return { kind: 'binding', key }
    },

    async loadMore(draft: MemoQueryDraft, _cursor: string, pageSize: number): Promise<ScopeRefreshResult> {
      const query = buildSelfMergedSearchQuery(draft, getSort())
      const key = memoListKeyFromQuery(query, pageSize)
      await workspaceStore.loadMoreMemoList(key)
      return { kind: 'binding', key }
    },

    async resolveRelations() {
      return {}
    },

    getCurrentQuery(data) {
      return data.memoQuery
    },

    getCurrentDateLabel(data) {
      return data.memoDateLabel
    },

    getStats(data) {
      return data.stats
    },

    getTagTreeNodes(data) {
      return data.tagTreeNodes
    },

    onCardDoubleTap(ctx: CardActionContext, memoId: number) {
      if (readMemoCardDoubleTapBehavior() === 'preview') {
        openMemoShareForCard(ctx.memoCards, memoId)
        return
      }
      openEditComposeForCard(ctx.memoCards, memoId)
    },

    onCardQuote(ctx: CardActionContext, memoId: number) {
      openQuoteComposeForCard(ctx.memoCards, memoId)
    },

    onCardReferenceTap(memoId: number) {
      openMemoReferenceDetail(memoId)
    },
  }
}
