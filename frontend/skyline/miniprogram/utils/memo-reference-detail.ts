import type { Memo, MemoRefId } from '../models/memo'
import {
  ownMemoIdFromRef,
  parseFriendMemoRef,
  uniqueOwnMemoIds,
} from './memo-ref-id'
import {
  buildMemoCardItem,
  buildMemoReferenceFallbackText,
  buildMemoReferenceOwnerSummaryText,
  tagsForMemoCardDisplay,
  type MemoCardItem,
  type MemoReferencePreview,
  type MemoReferencePreviewRelation,
} from './memo-list-presentation'

export interface MemoReferenceDetailProjection {
  rootCard: MemoCardItem | null
  referenceCards: MemoCardItem[]
  ownReferenceCards: MemoCardItem[]
  friendReferenceCards: MemoCardItem[]
  referencedByCards: MemoCardItem[]
  ownReferencedByCards: MemoCardItem[]
  friendReferencedByCards: MemoCardItem[]
}

export type MemoReferenceDetailCardsState = Pick<
  MemoReferenceDetailProjection,
  | 'rootCard'
  | 'referenceCards'
  | 'ownReferenceCards'
  | 'friendReferenceCards'
  | 'referencedByCards'
  | 'ownReferencedByCards'
  | 'friendReferencedByCards'
>

interface MemoReferenceDetailCardMutationOptions {
  includeRootCard?: boolean
}

interface MemoReferencePreviewOptions {
  resolveReferencePreview?: (
    id: MemoRefId,
    relation: MemoReferencePreviewRelation,
  ) => MemoReferencePreview | undefined
  friendReferenceMemos?: Map<MemoRefId, Memo>
  referenceOwnerLabel?: string
  referencedByOwnerLabel?: string
  /** 与当前引用链相关的好友昵称（单好友场景）；写入好友卡片 `ownerNickname`。 */
  friendNickname?: string | null
}

interface FriendMemoReferenceDetailOptions {
  friendUsername?: string
  friendNickname?: string
  resolveReferencePreview?: (id: MemoRefId) => MemoReferencePreview | undefined
}

export function collectMemoReferenceDetailFetchIds(root: Memo): number[] {
  return uniqueOwnMemoIds([...root.refs, ...root.referencedBy])
}

export function collectMemoReferencePreviewFetchIds(root: Memo, relationMemos: Memo[]): number[] {
  const knownIds = new Set([root.id, ...relationMemos.map((memo) => memo.id)])
  const previewIds = relationMemos.flatMap((memo) => [...memo.refs, ...memo.referencedBy])

  return uniqueOwnMemoIds(previewIds).filter((id) => !knownIds.has(id))
}

export function collectMemoReferenceListPreviewFetchIds(referenceMemos: Memo[]): number[] {
  const knownIds = new Set(referenceMemos.map((memo) => memo.id))
  const previewIds = referenceMemos.flatMap((memo) => [...memo.refs, ...memo.referencedBy])

  return uniqueOwnMemoIds(previewIds).filter((id) => !knownIds.has(id))
}

export function collectFriendMemoReferenceRefs(memos: Memo[]): MemoRefId[] {
  return collectFriendMemoRefsByRelation(memos, 'refs')
}

export function collectFriendMemoReferencedByRefs(memos: Memo[]): MemoRefId[] {
  return collectFriendMemoRefsByRelation(memos, 'referencedBy')
}

function collectFriendMemoRefsByRelation(
  memos: Memo[],
  relation: 'refs' | 'referencedBy',
): MemoRefId[] {
  const seen = new Set<MemoRefId>()
  const refs: MemoRefId[] = []
  memos.forEach((memo) => {
    memo[relation].forEach((ref) => {
      if (!parseFriendMemoRef(ref) || seen.has(ref)) return
      seen.add(ref)
      refs.push(ref)
    })
  })
  return refs
}

/**
 * 从已 hydrate 的好友关系卡片 memo 上收集尚未在 knownMemos 中的**本地**笔记 ID，
 * 用于补齐关系区好友卡 `referencePreview` / `referencedByPreviews` 所需的 `resolveMemoById`。
 * 同时扫描 `refs` 与 `referencedBy`（此前仅 referencedBy 会导致 outgoing 引用行降级为 `笔记{{ID}}`）。
 */
export function collectFriendReferenceReferencedByFetchIds(
  friendReferenceMemos: Map<MemoRefId, Memo>,
  knownMemos: Memo[],
): number[] {
  const knownIds = new Set(knownMemos.map((memo) => memo.id))
  const relatedIds = Array.from(friendReferenceMemos.values()).flatMap((memo) => [
    ...memo.refs,
    ...memo.referencedBy,
  ])

  return uniqueOwnMemoIds(relatedIds).filter((id) => !knownIds.has(id))
}

export function buildFriendMemoReferencePreview(
  ref: MemoRefId,
  memo: Memo,
  friend?: { username: string; nickname?: string | null } | null,
): MemoReferencePreview | null {
  const parsed = parseFriendMemoRef(ref)
  if (!parsed) return null
  const ownerLabel = friend?.username === parsed.username
    ? friend.nickname || friend.username
    : parsed.username
  return {
    id: ref,
    displayText: buildMemoReferenceOwnerSummaryText(
      ownerLabel,
      memo.content,
      buildMemoReferenceFallbackText(ref),
    ),
  }
}

export function buildMemoReferenceCards(
  memos: Memo[],
  previewMemos: Memo[],
  options: MemoReferencePreviewOptions = {},
): MemoCardItem[] {
  const memoById = new Map<number, Memo>()
  previewMemos.forEach((memo) => memoById.set(memo.id, memo))
  memos.forEach((memo) => memoById.set(memo.id, memo))

  const resolveMemoById = (id: number) => memoById.get(id)
  return memos.map((memo) =>
    buildMemoCardItem(memo, {
      resolveMemoById,
      richText: true,
      resolveReferencePreview: options.resolveReferencePreview,
      referenceOwnerLabel: options.referenceOwnerLabel,
      referencedByOwnerLabel: options.referencedByOwnerLabel,
    }),
  )
}

export function buildMemoReferenceDetailProjection(
  root: Memo | null,
  memos: Memo[],
  options: MemoReferencePreviewOptions = {},
): MemoReferenceDetailProjection {
  if (!root) {
    return {
      rootCard: null,
      referenceCards: [],
      ownReferenceCards: [],
      friendReferenceCards: [],
      referencedByCards: [],
      ownReferencedByCards: [],
      friendReferencedByCards: [],
    }
  }

  const rootCard = buildMemoReferenceCards([root], memos, options)[0] ?? null
  const ownRelationIds = uniqueOwnMemoIds([...root.refs, ...root.referencedBy])
  const ownRelationOptions: MemoReferencePreviewOptions = {
    resolveReferencePreview: options.resolveReferencePreview,
  }
  const relationCards = buildMemoReferenceCards(
    ownRelationIds
      .map((id) => memos.find((memo) => memo.id === id))
      .filter((memo): memo is Memo => !!memo),
    memos,
    ownRelationOptions,
  )
  const relationCardById = new Map(relationCards.map((card) => [card.id, card]))
  const friendReferenceCardsByRef = buildFriendRelationCardMap(root.refs, root, memos, options)
  const friendReferencedByCardsByRef = buildFriendRelationCardMap(root.referencedBy, root, memos, options)
  const referenceCards = root.refs
    .map((ref) => {
      const ownId = ownMemoIdFromRef(ref)
      if (ownId !== null) return relationCardById.get(ownId)
      return friendReferenceCardsByRef.get(ref)
    })
    .filter((card): card is MemoCardItem => !!card)
  const referencedByCards = root.referencedBy
    .map((ref) => {
      const ownId = ownMemoIdFromRef(ref)
      if (ownId !== null) return relationCardById.get(ownId)
      return friendReferencedByCardsByRef.get(ref)
    })
    .filter((card): card is MemoCardItem => !!card)

  return {
    rootCard,
    referenceCards,
    ownReferenceCards: referenceCards.filter((card) => !card.ownerUsername),
    friendReferenceCards: referenceCards.filter((card) => !!card.ownerUsername),
    referencedByCards,
    ownReferencedByCards: referencedByCards.filter((card) => !card.ownerUsername),
    friendReferencedByCards: referencedByCards.filter((card) => !!card.ownerUsername),
  }
}

function updateCardTags(
  card: MemoCardItem | null,
  memoId: number,
  tags: string[],
): MemoCardItem | null {
  if (!card || card.id !== memoId) return card
  return { ...card, tags: tagsForMemoCardDisplay(tags) }
}

function updateCardsTags(
  cards: MemoCardItem[],
  memoId: number,
  tags: string[],
): MemoCardItem[] {
  let changed = false
  const next = cards.map((card) => {
    if (card.ownerUsername || card.id !== memoId) return card
    changed = true
    return { ...card, tags: tagsForMemoCardDisplay(tags) }
  })
  return changed ? next : cards
}

function removeCards(cards: MemoCardItem[], memoId: number): MemoCardItem[] {
  const next = cards.filter((card) => card.ownerUsername || card.id !== memoId)
  return next.length === cards.length ? cards : next
}

export function updateMemoReferenceDetailCardTags(
  state: MemoReferenceDetailCardsState,
  memoId: number,
  tags: string[],
  options: MemoReferenceDetailCardMutationOptions = {},
): MemoReferenceDetailCardsState {
  const rootCard = options.includeRootCard === false
    ? state.rootCard
    : updateCardTags(state.rootCard, memoId, tags)
  return {
    rootCard,
    referenceCards: updateCardsTags(state.referenceCards, memoId, tags),
    ownReferenceCards: updateCardsTags(state.ownReferenceCards, memoId, tags),
    friendReferenceCards: updateCardsTags(state.friendReferenceCards, memoId, tags),
    referencedByCards: updateCardsTags(state.referencedByCards, memoId, tags),
    ownReferencedByCards: updateCardsTags(state.ownReferencedByCards, memoId, tags),
    friendReferencedByCards: updateCardsTags(state.friendReferencedByCards, memoId, tags),
  }
}

export function removeMemoReferenceDetailCard(
  state: MemoReferenceDetailCardsState,
  memoId: number,
  options: MemoReferenceDetailCardMutationOptions = {},
): MemoReferenceDetailCardsState {
  const rootCard = options.includeRootCard === false
    ? state.rootCard
    : state.rootCard?.id === memoId ? null : state.rootCard
  return {
    rootCard,
    referenceCards: removeCards(state.referenceCards, memoId),
    ownReferenceCards: removeCards(state.ownReferenceCards, memoId),
    friendReferenceCards: removeCards(state.friendReferenceCards, memoId),
    referencedByCards: removeCards(state.referencedByCards, memoId),
    ownReferencedByCards: removeCards(state.ownReferencedByCards, memoId),
    friendReferencedByCards: removeCards(state.friendReferencedByCards, memoId),
  }
}

function buildFriendRelationCardMap(
  refs: MemoRefId[],
  root: Memo,
  memos: Memo[],
  options: MemoReferencePreviewOptions,
): Map<MemoRefId, MemoCardItem> {
  const result = new Map<MemoRefId, MemoCardItem>()
  const friendReferenceMemos = options.friendReferenceMemos
  if (!friendReferenceMemos || friendReferenceMemos.size === 0) return result

  const ownMemoById = new Map<number, Memo>()
  for (const memo of [root, ...memos]) {
    if (!ownMemoById.has(memo.id)) ownMemoById.set(memo.id, memo)
  }

  refs.forEach((ref) => {
    const parsed = parseFriendMemoRef(ref)
    if (!parsed || result.has(ref)) return
    const friendMemo = friendReferenceMemos.get(ref)
    if (!friendMemo) return
    const card = buildMemoCardItem(friendMemo, {
      resolveMemoById: (id) => ownMemoById.get(id),
      richText: true,
      resolveReferencePreview: options.resolveReferencePreview,
      referenceOwnerLabel: options.referencedByOwnerLabel,
      referencedByOwnerLabel: options.referencedByOwnerLabel,
    })
    const friendNick = String(options.friendNickname || '').trim()
    result.set(ref, {
      ...card,
      ownerUsername: parsed.username,
      ...(friendNick ? { ownerNickname: friendNick } : {}),
    })
  })

  return result
}

export function buildFriendMemoReferenceDetailProjection(
  root: Memo | null,
  relationMemos: Memo[],
  options: FriendMemoReferenceDetailOptions = {},
): MemoReferenceDetailProjection {
  if (!root) {
    return {
      rootCard: null,
      referenceCards: [],
      ownReferenceCards: [],
      friendReferenceCards: [],
      referencedByCards: [],
      ownReferencedByCards: [],
      friendReferencedByCards: [],
    }
  }

  const relationMemoById = new Map(relationMemos.map((memo) => [memo.id, memo]))
  const pickOwnRelationMemos = (refs: MemoRefId[]): Memo[] =>
    uniqueOwnMemoIds(refs)
      .map((id) => relationMemoById.get(id))
      .filter((memo): memo is Memo => !!memo)

  const referenceMemos = pickOwnRelationMemos(root.refs)
  const referencedByMemos = pickOwnRelationMemos(root.referencedBy)
  const previewMemos = [
    root,
    ...relationMemos,
  ]
  const friendRefPreview = buildFriendRootReferencePreview(root, previewMemos, options)
  const resolveReferencePreview = (id: MemoRefId): MemoReferencePreview | undefined =>
    (friendRefPreview && id === friendRefPreview.id ? friendRefPreview : undefined)
      ?? options.resolveReferencePreview?.(id)

  const referenceCards = buildMemoReferenceCards(referenceMemos, previewMemos, {
    resolveReferencePreview,
  })
  const referencedByCards = buildMemoReferenceCards(referencedByMemos, previewMemos, {
    resolveReferencePreview,
  })
  const friendUsername = String(options.friendUsername || '').trim()
  const friendNickname = String(options.friendNickname || '').trim()
  const rawRootCard = buildMemoReferenceCards([root], relationMemos, {
    referencedByOwnerLabel: '我',
  })[0] ?? null
  const rootCard = rawRootCard
    ? {
        ...rawRootCard,
        ...(friendUsername ? { ownerUsername: friendUsername } : {}),
        ...(friendNickname ? { ownerNickname: friendNickname } : {}),
      }
    : null

  return {
    rootCard,
    referenceCards,
    ownReferenceCards: referenceCards,
    friendReferenceCards: [],
    referencedByCards,
    ownReferencedByCards: referencedByCards,
    friendReferencedByCards: [],
  }
}

export function buildMemoCardItemFromMemo(
  memo: Memo,
  allMemos: Memo[],
  options?: { ownerUsername?: string; ownerNickname?: string },
): MemoCardItem {
  const memoById = new Map(allMemos.map((m) => [m.id, m]))
  const card = buildMemoCardItem(memo, {
    resolveMemoById: (id) => memoById.get(id),
    richText: true,
  })
  let next: MemoCardItem = card
  if (options?.ownerUsername) {
    next = { ...next, ownerUsername: options.ownerUsername }
  }
  const nick = String(options?.ownerNickname || '').trim()
  if (nick) {
    next = { ...next, ownerNickname: nick }
  }
  return next
}

function buildFriendRootReferencePreview(
  root: Memo,
  relationMemos: Memo[],
  options: FriendMemoReferenceDetailOptions,
): MemoReferencePreview | null {
  const expectedRef = options.friendUsername ? `${options.friendUsername}/${root.id}` : ''
  const ref = expectedRef || (
    relationMemos
      .flatMap((memo) => [...memo.refs, ...memo.referencedBy])
      .find((candidate) => parseFriendMemoRef(candidate)?.memoId === root.id)
  )
  if (!ref) return null

  const parsed = parseFriendMemoRef(ref)
  const ownerLabel = options.friendNickname || options.friendUsername || parsed?.username || ''
  return {
    id: ref,
    displayText: buildMemoReferenceOwnerSummaryText(
      ownerLabel,
      root.content,
      buildMemoReferenceFallbackText(ref),
    ),
  }
}
