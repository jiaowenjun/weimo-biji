import type { FriendProfile } from '../../models/friend'
import type { Memo, MemoQueryDraft, MemoSearchPage } from '../../models/memo'
import type { MemoCreatedAtSort } from '../memo-list-sort-prefs'
import { searchFriendMemos } from '../../services/friend'
import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'
import { readMemoCardDoubleTapBehavior } from '../memo-card-double-tap-prefs'
import { openFriendQuoteComposeForCard, openMemoShareForCard } from '../memo-list-card-actions'
import { openFriendMemoReferenceDetail } from '../navigation'
import {
  buildFriendMemoSearchFiltersFromDraft,
  collectFriendMemoRelationOwnIds,
} from '../../pages/index/friend-memo-list'
import type {
  CardActionContext,
  MemoListRelationOptions,
  MemoScopeStrategy,
  ScopeRefreshResult,
} from './types'

function collectCachedFriendReferencedOwnMemos(
  page: MemoSearchPage,
  friendUsername: string,
): Memo[] {
  const friendRefs = new Set(page.items.map((memo) => `${friendUsername}/${memo.id}`))
  const memoById = new Map<number, Memo>()
  const collectMemo = (memo: Memo) => {
    if (memo.referencedBy.some((ref) => friendRefs.has(ref))) {
      memoById.set(memo.id, memo)
    }
  }
  const state = workspaceStore.getState()
  state.memos.detail.forEach((entry) => collectMemo(entry.memo))
  state.memos.list.forEach((entry) => {
    entry.pages.forEach((memoPage) => memoPage.items.forEach(collectMemo))
  })
  return Array.from(memoById.values())
}

async function loadFriendMemoRelationMemos(page: MemoSearchPage): Promise<Memo[]> {
  const ids = collectFriendMemoRelationOwnIds(page)
  if (ids.length === 0) return []
  try {
    return await workspaceStore.ensureMemoDetails(ids)
  } catch {
    return []
  }
}

export function createFriendScopeStrategy(
  friend: FriendProfile,
  getSort: () => MemoCreatedAtSort,
): MemoScopeStrategy {
  const username = friend.username
  const nickname = friend.nickname

  return {
    kind: 'friend',

    getFriend() {
      return friend
    },

    buildSearchQuery(draft: MemoQueryDraft) {
      return buildFriendMemoSearchFiltersFromDraft(draft, getSort())
    },

    async refresh(draft: MemoQueryDraft, pageSize: number): Promise<ScopeRefreshResult> {
      const filters = buildFriendMemoSearchFiltersFromDraft(draft, getSort())
      const page = await searchFriendMemos(username, filters, null, pageSize)
      return { kind: 'page', page }
    },

    async loadMore(draft: MemoQueryDraft, cursor: string, pageSize: number): Promise<ScopeRefreshResult> {
      const filters = buildFriendMemoSearchFiltersFromDraft(draft, getSort())
      const page = await searchFriendMemos(username, filters, cursor, pageSize)
      return { kind: 'page', page }
    },

    async resolveRelations(page: MemoSearchPage): Promise<MemoListRelationOptions> {
      const inferredReferenceMemos = collectCachedFriendReferencedOwnMemos(page, username)
      const relationMemos = await loadFriendMemoRelationMemos(page)
      return {
        friendUsername: username,
        friendNickname: String(nickname || '').trim() || undefined,
        referenceMemos: relationMemos,
        referencedByMemos: relationMemos,
        inferredReferenceMemos,
      }
    },

    getCurrentQuery(data) {
      return data.friendMemoQuery
    },

    getCurrentDateLabel(data) {
      return data.friendMemoDateLabel
    },

    getStats(data) {
      return data.friendStats
    },

    getTagTreeNodes(data) {
      return data.friendTagTreeNodes
    },

    onCardDoubleTap(ctx: CardActionContext, memoId: number) {
      if (readMemoCardDoubleTapBehavior() === 'preview') {
        openMemoShareForCard(ctx.memoCards, memoId, username)
        return
      }
      openFriendQuoteComposeForCard(ctx.memoCards, memoId, username, {
        ownerLabel: nickname,
        onSaved: () => void ctx.refreshList(),
      })
    },

    onCardQuote(ctx: CardActionContext, memoId: number) {
      openFriendQuoteComposeForCard(ctx.memoCards, memoId, username, {
        ownerLabel: nickname,
        onSaved: () => void ctx.refreshList(),
      })
    },

    onCardReferenceTap(memoId: number) {
      openFriendMemoReferenceDetail(memoId, { ownerUsername: username })
    },
  }
}
