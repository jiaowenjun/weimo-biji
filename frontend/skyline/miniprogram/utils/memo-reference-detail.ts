import type { Memo } from '../models/memo'
import { ownMemoIdFromRef, uniqueOwnMemoIds } from './memo-ref-id'
import {
  buildMemoCardItem,
  tagsForMemoCardDisplay,
  type MemoCardItem,
} from './memo-list-presentation'

export interface MemoReferenceDetailProjection {
  rootCard: MemoCardItem | null
  referenceCards: MemoCardItem[]
  referencedByCards: MemoCardItem[]
}

export type MemoReferenceDetailCardsState = Pick<
  MemoReferenceDetailProjection,
  'rootCard' | 'referenceCards' | 'referencedByCards'
>

interface MemoReferenceDetailCardMutationOptions {
  includeRootCard?: boolean
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

export function buildMemoReferenceCards(memos: Memo[], previewMemos: Memo[]): MemoCardItem[] {
  const memoById = new Map<number, Memo>()
  previewMemos.forEach((memo) => memoById.set(memo.id, memo))
  memos.forEach((memo) => memoById.set(memo.id, memo))

  const resolveMemoById = (id: number) => memoById.get(id)
  return memos.map((memo) =>
    buildMemoCardItem(memo, {
      resolveMemoById,
      richText: true,
    }),
  )
}

export function buildMemoReferenceDetailProjection(
  root: Memo | null,
  memos: Memo[],
): MemoReferenceDetailProjection {
  if (!root) {
    return {
      rootCard: null,
      referenceCards: [],
      referencedByCards: [],
    }
  }

  const rootCard = buildMemoReferenceCards([root], memos)[0] ?? null
  const ownRelationIds = uniqueOwnMemoIds([...root.refs, ...root.referencedBy])
  const relationCards = buildMemoReferenceCards(
    ownRelationIds
      .map((id) => memos.find((memo) => memo.id === id))
      .filter((memo): memo is Memo => !!memo),
    memos,
  )
  const relationCardById = new Map(relationCards.map((card) => [card.id, card]))
  const referenceCards = root.refs
    .map((ref) => {
      const ownId = ownMemoIdFromRef(ref)
      return ownId !== null ? relationCardById.get(ownId) : undefined
    })
    .filter((card): card is MemoCardItem => !!card)
  const referencedByCards = root.referencedBy
    .map((ref) => {
      const ownId = ownMemoIdFromRef(ref)
      return ownId !== null ? relationCardById.get(ownId) : undefined
    })
    .filter((card): card is MemoCardItem => !!card)

  return {
    rootCard,
    referenceCards,
    referencedByCards,
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
    if (card.id !== memoId) return card
    changed = true
    return { ...card, tags: tagsForMemoCardDisplay(tags) }
  })
  return changed ? next : cards
}

function removeCards(cards: MemoCardItem[], memoId: number): MemoCardItem[] {
  const next = cards.filter((card) => card.id !== memoId)
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
    referencedByCards: updateCardsTags(state.referencedByCards, memoId, tags),
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
    referencedByCards: removeCards(state.referencedByCards, memoId),
  }
}

export function buildMemoCardItemFromMemo(memo: Memo, allMemos: Memo[]): MemoCardItem {
  const memoById = new Map(allMemos.map((m) => [m.id, m]))
  return buildMemoCardItem(memo, {
    resolveMemoById: (id) => memoById.get(id),
    richText: true,
  })
}
