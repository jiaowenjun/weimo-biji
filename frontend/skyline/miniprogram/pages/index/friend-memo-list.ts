import type { Memo, MemoQueryDraft, MemoRefId, MemoSearchPage } from '../../models/memo'
import type { FriendMemoSearchFilters } from '../../services/friend'
import { ownMemoIdFromRef, parseFriendMemoRef } from '../../utils/memo-ref-id'
import {
  buildMemoCardItem,
  type MemoCardItem,
} from '../../utils/memo-list-presentation'
import {
  applyMemoParagraphSpacingForHighlight,
  highlightMemoNodes,
} from '../../utils/memo-highlight'
import type { MemoCreatedAtSort } from '../../utils/memo-list-sort-prefs'
import { buildMemoSearchQueryFromDraft } from '../../utils/memo-query'

export interface FriendMemoListState {
  cards: MemoCardItem[]
  nextCursor: string | null
  hasMore: boolean
  initialized: boolean
  refreshing: boolean
  loadingMore: boolean
  initialLoadFailed: boolean
  loadMoreFailed: boolean
}

export function createFriendMemoListState(): FriendMemoListState {
  return {
    cards: [],
    nextCursor: null,
    hasMore: false,
    initialized: false,
    refreshing: false,
    loadingMore: false,
    initialLoadFailed: false,
    loadMoreFailed: false,
  }
}

export function buildFriendMemoSearchFiltersFromDraft(
  draft: MemoQueryDraft,
  memoCreatedAtSort: MemoCreatedAtSort,
): FriendMemoSearchFilters {
  const query = buildMemoSearchQueryFromDraft(draft)
  const filters: FriendMemoSearchFilters = {}
  if (query.tag) filters.tag = query.tag
  if (query.created_at) filters.createdAt = query.created_at
  if (query.text) filters.text = query.text
  if (query.has_annotation) filters.hasAnnotation = true
  if (query.has_markdown_quote) filters.hasMarkdownQuote = true
  if (query.has_heading) filters.hasHeading = true
  if (query.has_unordered_list) filters.hasUnorderedList = true
  if (memoCreatedAtSort === 'asc') filters.createdAtSort = 'asc'
  return filters
}

export function friendMemoListLoadStartPatch(loadMore: boolean) {
  return {
    memoListRefreshing: !loadMore,
    memoListLoadingMore: loadMore,
    memoListInitialLoadFailed: false,
    memoListLoadMoreFailed: false,
  }
}

export function friendMemoListLoadFailedPatch(loadMore: boolean) {
  return {
    memoListRefreshing: false,
    memoListLoadingMore: false,
    memoListInitialLoadFailed: !loadMore,
    memoListLoadMoreFailed: loadMore,
  }
}

export function collectFriendMemoReferenceOwnIds(page: MemoSearchPage): number[] {
  return collectPageOwnMemoIds(page, (memo) => memo.refs)
}

export function collectFriendMemoReferencedByOwnIds(page: MemoSearchPage): number[] {
  return collectPageOwnMemoIds(page, (memo) => memo.referencedBy)
}

export function collectFriendMemoRelationOwnIds(page: MemoSearchPage): number[] {
  return collectPageOwnMemoIds(page, (memo) => [
    ...memo.refs,
    ...memo.referencedBy,
  ])
}

function collectPageOwnMemoIds(
  page: MemoSearchPage,
  selectRefs: (memo: Memo) => MemoRefId[],
): number[] {
  const seen = new Set<number>()
  const ids: number[] = []
  page.items.forEach((memo) => {
    selectRefs(memo).forEach((ref) => {
      const id = ownMemoIdFromRef(ref)
      if (id === null || seen.has(id)) return
      seen.add(id)
      ids.push(id)
    })
  })
  return ids
}

export function friendMemoListPagePatch(
  page: MemoSearchPage,
  append: boolean,
  previousCards: MemoCardItem[] = [],
  options: {
    friendUsername?: string
    friendNickname?: string
    referenceMemos?: Memo[]
    referencedByMemos?: Memo[]
    inferredReferenceMemos?: Memo[]
    highlightKeyword?: string
  } = {},
) {
  const relationMemoById = new Map<number, Memo>()
  options.referenceMemos?.forEach((memo) => relationMemoById.set(memo.id, memo))
  options.referencedByMemos?.forEach((memo) => relationMemoById.set(memo.id, memo))
  options.inferredReferenceMemos?.forEach((memo) => relationMemoById.set(memo.id, memo))

  const inferredRefsByFriendMemoId = new Map<number, string[]>()
  const friendUsernameKey = options.friendUsername?.trim()
  if (friendUsernameKey) {
    options.inferredReferenceMemos?.forEach((ownMemo) => {
      ownMemo.referencedBy.forEach((ref) => {
        const parsed = parseFriendMemoRef(ref)
        if (!parsed || parsed.username !== friendUsernameKey) return
        const refs = inferredRefsByFriendMemoId.get(parsed.memoId) ?? []
        const ownRef = String(ownMemo.id)
        if (!refs.includes(ownRef)) refs.push(ownRef)
        inferredRefsByFriendMemoId.set(parsed.memoId, refs)
      })
    })
  }

  const nextCards = page.items.map((memo) => {
    const inferredRefs = inferredRefsByFriendMemoId.get(memo.id) ?? []
    const refs = [...memo.refs]
    inferredRefs.forEach((ref) => {
      if (!refs.includes(ref)) refs.push(ref)
    })
    const memoForCard = refs.length === memo.refs.length ? memo : { ...memo, refs }
    const card = buildMemoCardItem(memoForCard, {
      richText: true,
      resolveMemoById: (id) => relationMemoById.get(id),
      referenceOwnerLabel: '我',
      referencedByOwnerLabel: '我',
    })
    if (options.highlightKeyword && card.contentNodes.length > 0) {
      card.contentNodes = applyMemoParagraphSpacingForHighlight(
        highlightMemoNodes(card.contentNodes, options.highlightKeyword),
      )
    }
    return card
  })

  const friendNicknameTrimmed = options.friendNickname?.trim()
  const stampedNext =
    friendUsernameKey
      ? nextCards.map((c) => ({
          ...c,
          ownerUsername: friendUsernameKey,
          ...(friendNicknameTrimmed ? { ownerNickname: friendNicknameTrimmed } : {}),
        }))
      : nextCards
  const cards = append ? [...previousCards, ...stampedNext] : stampedNext

  return {
    memoCards: cards,
    memoRenderCards: cards,
    memoNextCursor: page.nextCursor,
    memoHasMore: page.hasMore,
    memoListInitialized: true,
    memoListRefreshing: false,
    memoListLoadingMore: false,
    memoListInitialLoadFailed: false,
    memoListLoadMoreFailed: false,
  }
}
