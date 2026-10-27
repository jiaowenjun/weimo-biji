import { describe, expect, it } from 'vitest'
import type { Memo } from '../../models/memo'
import {
  buildFriendMemoReferenceDetailProjection,
  buildFriendMemoReferencePreview,
  buildMemoCardItemFromMemo,
  buildMemoReferenceCards,
  buildMemoReferenceDetailProjection,
  collectFriendReferenceReferencedByFetchIds,
  collectFriendMemoReferencedByRefs,
  collectFriendMemoReferenceRefs,
  collectMemoReferenceDetailFetchIds,
  collectMemoReferenceListPreviewFetchIds,
  collectMemoReferencePreviewFetchIds,
  removeMemoReferenceDetailCard,
  updateMemoReferenceDetailCardTags,
} from '../memo-reference-detail'
import type { MemoCardItem } from '../memo-list-presentation'

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  return {
    id,
    content: `memo-${id}`,
    tags: [],
    createdAt: '2026-04-24T10:00:00.000Z',
    updatedAt: '2026-04-24T10:00:00.000Z',
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function makeCard(id: number, overrides: Partial<MemoCardItem> = {}): MemoCardItem {
  return {
    id,
    ownerUsername: '',
    createdAtText: '2026-04-24',
    content: `card-${id}`,
    contentNodes: [],
    tags: [],
    referenceId: null,
    referencePreview: null,
    referencedByPreviews: [],
    exiting: false,
    renderRichText: true,
    ...overrides,
  }
}

describe('memo-reference-detail projection', () => {
  it('collects direct relation ids first and preview ids second', () => {
    const root = makeMemo(10, { refs: ['1', '2', 'bob/7'], referencedBy: ['11'] })
    const relationMemos = [
      makeMemo(1, { referencedBy: ['10', '21', 'bob/8'] }),
      makeMemo(2, { refs: ['3'] }),
      makeMemo(11, { refs: ['10'], referencedBy: ['12'] }),
    ]

    expect(collectMemoReferenceDetailFetchIds(root)).toEqual([1, 2, 11])
    expect(collectMemoReferencePreviewFetchIds(root, relationMemos)).toEqual([21, 3, 12])
  })

  it('builds root, reference, and referenced-by card groups with relation bars intact', () => {
    const root = makeMemo(10, {
      content: 'Root',
      refs: ['1', 'bob/7'],
      referencedBy: ['11', 'bob/9'],
    })
    const memos = [
      root,
      makeMemo(1, { content: 'Quoted', referencedBy: ['10', '21'] }),
      makeMemo(11, { content: 'Referrer', refs: ['10'] }),
      makeMemo(21, { content: 'Other referrer' }),
    ]

    const projection = buildMemoReferenceDetailProjection(root, memos)

    expect(projection.rootCard?.id).toBe(10)
    expect(projection.rootCard?.referencePreview?.displayText).toBe('2026-04-24：Quoted')
    expect(projection.referenceCards.map((card) => card.id)).toEqual([1])
    expect(projection.ownReferenceCards.map((card) => card.id)).toEqual([1])
    expect(projection.friendReferenceCards).toEqual([])
    expect(projection.referenceCards[0]?.referencedByPreviews.map((preview) => preview.id)).toEqual(['10', '21'])
    expect(projection.referencedByCards.map((card) => card.id)).toEqual([11])
    expect(projection.ownReferencedByCards.map((card) => card.id)).toEqual([11])
    expect(projection.friendReferencedByCards).toEqual([])
    expect(projection.referencedByCards[0]?.referencePreview?.id).toBe('10')
  })

  it('uses friend nickname and friend memo summary for cross-user outgoing refs', () => {
    const root = makeMemo(10, {
      content: 'My annotation',
      refs: ['bob/7'],
      referencedBy: [],
    })
    const friendMemo = makeMemo(7, {
      content: 'Friend memo summary',
      referencedBy: ['10'],
    })

    const projection = buildMemoReferenceDetailProjection(root, [root], {
      resolveReferencePreview: (ref) =>
        ref === 'bob/7'
          ? { id: ref, displayText: 'Bob: Friend memo summary' }
          : undefined,
      friendReferenceMemos: new Map([['bob/7', friendMemo]]),
      referencedByOwnerLabel: '我',
    })

    expect(projection.rootCard?.referencePreview?.displayText).toBe('Bob: Friend memo summary')
    expect(projection.referenceCards.map((card) => card.id)).toEqual([7])
    expect(projection.ownReferenceCards).toEqual([])
    expect(projection.friendReferenceCards.map((card) => card.id)).toEqual([7])
    expect(projection.referenceCards[0]?.ownerUsername).toBe('bob')
    expect(projection.referenceCards[0]?.content).toBe('Friend memo summary')
    expect(projection.referenceCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: My annotation')
  })

  it('keeps own relation card referenced-by previews date formatted in self detail', () => {
    const root = makeMemo(10, {
      content: 'Root memo',
      refs: ['1'],
    })
    const ownQuotedMemo = makeMemo(1, {
      content: 'Own quoted memo',
      referencedBy: ['10'],
    })

    const projection = buildMemoReferenceDetailProjection(root, [root, ownQuotedMemo], {
      referencedByOwnerLabel: '我',
    })

    expect(projection.ownReferenceCards[0]?.referencedByPreviews[0]?.displayText).toBe(
      '2026-04-24：Root memo',
    )
  })

  it('splits own and friend references while preserving the combined order', () => {
    const root = makeMemo(10, {
      refs: ['1', 'bob/7', '2'],
    })
    const ownMemoA = makeMemo(1, { content: 'Own quoted A' })
    const ownMemoB = makeMemo(2, { content: 'Own quoted B' })
    const friendMemo = makeMemo(7, { content: 'Friend memo summary' })

    const projection = buildMemoReferenceDetailProjection(root, [
      root,
      ownMemoA,
      ownMemoB,
    ], {
      friendReferenceMemos: new Map([['bob/7', friendMemo]]),
    })

    expect(projection.referenceCards.map((card) => `${card.ownerUsername || 'me'}:${card.id}`)).toEqual([
      'me:1',
      'bob:7',
      'me:2',
    ])
    expect(projection.ownReferenceCards.map((card) => card.id)).toEqual([1, 2])
    expect(projection.friendReferenceCards.map((card) => card.id)).toEqual([7])
  })

  it('splits own and friend referenced-by cards while preserving the combined order', () => {
    const root = makeMemo(10, {
      referencedBy: ['11', 'bob/9', '12'],
    })
    const ownMemoA = makeMemo(11, { content: 'Own referrer A' })
    const ownMemoB = makeMemo(12, { content: 'Own referrer B' })
    const friendMemo = makeMemo(9, { content: 'Friend referrer' })

    const projection = buildMemoReferenceDetailProjection(root, [
      root,
      ownMemoA,
      ownMemoB,
    ], {
      friendReferenceMemos: new Map([['bob/9', friendMemo]]),
    })

    expect(projection.referencedByCards.map((card) => `${card.ownerUsername || 'me'}:${card.id}`)).toEqual([
      'me:11',
      'bob:9',
      'me:12',
    ])
    expect(projection.ownReferencedByCards.map((card) => card.id)).toEqual([11, 12])
    expect(projection.friendReferencedByCards.map((card) => card.id)).toEqual([9])
  })

  it('collects missing own annotation memos from hydrated friend reference cards', () => {
    const currentAnnotation = makeMemo(4, { refs: ['bob/7'], content: 'Second annotation' })
    const friendMemo = makeMemo(7, {
      content: 'Friend memo summary',
      referencedBy: ['3', '4', 'carol/9'],
    })

    expect(collectFriendReferenceReferencedByFetchIds(
      new Map([['bob/7', friendMemo]]),
      [currentAnnotation],
    )).toEqual([3])
  })

  it('collects missing own memo ids from friend card refs', () => {
    const friendMemo = makeMemo(7, { refs: ['1136'], referencedBy: ['100'] })
    expect(collectFriendReferenceReferencedByFetchIds(
      new Map([['bob/7', friendMemo]]),
      [makeMemo(100)],
    )).toEqual([1136])
  })

  it('hydrates friend reference card outgoing refs to my memos for 我 summary not 笔记ID fallback', () => {
    const root = makeMemo(100, { content: '木生与淑柔', refs: ['bob/7'], referencedBy: [] })
    const friendMemo = makeMemo(7, {
      content: 'Friend longer text',
      refs: ['1136'],
      referencedBy: ['100'],
    })
    const nestedMyMemo = makeMemo(1136, { content: 'Another branch of my notes' })
    const opts = {
      friendReferenceMemos: new Map([['bob/7', friendMemo]]),
      referencedByOwnerLabel: '我',
    }

    const missingNested = buildMemoReferenceDetailProjection(root, [root], opts)
    expect(missingNested.friendReferenceCards[0]?.referencePreview?.displayText).toBe('笔记1136')
    expect(missingNested.friendReferenceCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: 木生与淑柔')

    const withNested = buildMemoReferenceDetailProjection(root, [root, nestedMyMemo], opts)
    expect(withNested.friendReferenceCards[0]?.referencePreview?.displayText).toBe('我: Another branch of my notes')
    expect(withNested.friendReferenceCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: 木生与淑柔')
  })

  it('uses own annotations for friend reference card referenced-by previews even when ids collide', () => {
    const currentAnnotation = makeMemo(7, {
      refs: ['bob/7'],
      content: 'My annotation',
    })
    const friendMemo = makeMemo(7, {
      content: 'Friend memo summary',
      referencedBy: ['7'],
    })

    const projection = buildMemoReferenceDetailProjection(currentAnnotation, [currentAnnotation], {
      friendReferenceMemos: new Map([['bob/7', friendMemo]]),
      referencedByOwnerLabel: '我',
    })

    expect(projection.referenceCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: My annotation')
  })

  it('collects friend refs and builds friend memo summary previews', () => {
    const memos = [
      makeMemo(10, { refs: ['bob/7', '1'], referencedBy: ['bob/9'] }),
      makeMemo(11, { refs: ['bob/7', 'carol/8'], referencedBy: ['bob/9', 'carol/10'] }),
    ]

    expect(collectFriendMemoReferenceRefs(memos)).toEqual(['bob/7', 'carol/8'])
    expect(collectFriendMemoReferencedByRefs(memos)).toEqual(['bob/9', 'carol/10'])
    expect(buildFriendMemoReferencePreview('bob/7', makeMemo(7, {
      content: 'Friend memo summary',
    }), {
      username: 'bob',
      nickname: 'Bob',
    })).toEqual({
      id: 'bob/7',
      displayText: 'Bob: Friend memo summary',
    })
  })

  it('builds standalone reference cards for unsaved compose refs with relation bars intact', () => {
    const referenceMemos = [
      makeMemo(1, { content: 'Quoted A', referencedBy: ['10', '21'] }),
      makeMemo(2, { content: 'Quoted B', refs: ['3', 'bob/7'] }),
    ]
    const previewMemos = [
      makeMemo(21, { content: 'Other referrer' }),
      makeMemo(3, { content: 'Nested quoted memo' }),
    ]

    expect(collectMemoReferenceListPreviewFetchIds(referenceMemos)).toEqual([10, 21, 3])

    const cards = buildMemoReferenceCards(referenceMemos, [...referenceMemos, ...previewMemos])

    expect(cards.map((card) => card.id)).toEqual([1, 2])
    expect(cards[0]?.referencedByPreviews.map((preview) => preview.displayText)).toEqual([
      '笔记10',
      '2026-04-24：Other referrer',
    ])
    expect(cards[1]?.referencePreview?.displayText).toBe('2026-04-24：Nested quoted memo')
  })

  it('builds friend detail projection without exposing friend outgoing refs', () => {
    const root = makeMemo(7, {
      refs: [],
      referencedBy: ['3'],
      content: 'friend memo',
    })
    const annotation = makeMemo(3, {
      refs: ['bob/7'],
      referencedBy: [],
      content: 'my annotation',
    })

    const projection = buildFriendMemoReferenceDetailProjection(root, [annotation], {
      friendUsername: 'bob',
      friendNickname: 'Bob',
    })

    expect(projection.rootCard?.ownerUsername).toBe('bob')
    expect(projection.rootCard?.ownerNickname).toBe('Bob')
    expect(projection.referenceCards).toEqual([])
    expect(projection.rootCard?.referencedByPreviews[0]?.displayText).toBe('我: my annotation')
    expect(projection.referencedByCards.map((card) => card.id)).toEqual([3])
    expect(projection.referencedByCards[0]?.referencePreview?.displayText).toBe('Bob: friend memo')
  })

  it('shows my quoted memos in friend detail when a friend memo references mine', () => {
    const root = makeMemo(7, {
      refs: ['1'],
      referencedBy: [],
      content: 'friend annotation',
    })
    const quotedMemo = makeMemo(1, {
      content: 'my original memo',
      referencedBy: ['bob/7'],
    })

    const projection = buildFriendMemoReferenceDetailProjection(root, [quotedMemo], {
      friendUsername: 'bob',
      friendNickname: 'Bob',
    })

    expect(projection.referenceCards.map((card) => card.id)).toEqual([1])
    expect(projection.ownReferenceCards.map((card) => card.id)).toEqual([1])
    expect(projection.friendReferenceCards).toEqual([])
    expect(projection.referencedByCards).toEqual([])
    expect(projection.ownReferenceCards[0]?.referencedByPreviews[0]?.displayText).toBe(
      'Bob: friend annotation',
    )
  })

  it('formats own nested refs in friend detail own reference cards with date summaries', () => {
    const root = makeMemo(7, {
      refs: ['1'],
      content: 'friend annotation',
    })
    const quotedMemo = makeMemo(1, {
      content: 'my quoted memo',
      refs: ['1093'],
      referencedBy: ['bob/7'],
    })
    const nestedOwnMemo = makeMemo(1093, {
      content: 'my nested source',
      createdAt: '2026-04-29T12:46:00.000Z',
    })

    const projection = buildFriendMemoReferenceDetailProjection(root, [
      quotedMemo,
      nestedOwnMemo,
    ], {
      friendUsername: 'bob',
      friendNickname: 'Bob',
    })

    expect(projection.ownReferenceCards[0]?.referencePreview?.displayText).toBe(
      '2026-04-29：my nested source',
    )
  })

  it('formats own card outgoing friend refs in friend detail with friend summaries', () => {
    const root = makeMemo(9, {
      refs: ['3'],
      content: 'friend note C',
    })
    const myAnnotation = makeMemo(3, {
      refs: ['bob/7'],
      referencedBy: ['bob/9'],
      content: 'my note B',
    })

    const missingPreview = buildFriendMemoReferenceDetailProjection(root, [myAnnotation], {
      friendUsername: 'bob',
      friendNickname: 'Bob',
    })
    expect(missingPreview.ownReferenceCards[0]?.referencePreview?.displayText).toBe('笔记bob/7')

    const projection = buildFriendMemoReferenceDetailProjection(root, [myAnnotation], {
      friendUsername: 'bob',
      friendNickname: 'Bob',
      resolveReferencePreview: (ref) =>
        ref === 'bob/7'
          ? { id: ref, displayText: 'Bob: friend note A summary' }
          : undefined,
    })

    expect(projection.ownReferenceCards[0]?.referencePreview?.displayText).toBe(
      'Bob: friend note A summary',
    )
  })
})

describe('memo-reference-detail local card updates', () => {
  it('updates tags for the matching card across every rendered detail section', () => {
    const rootCard = makeCard(1, { tags: ['old'] })
    const ownReference = makeCard(1, { tags: ['old'] })
    const friendReference = makeCard(7, { tags: ['friend'], ownerUsername: 'bob' })
    const ownReferencedBy = makeCard(1, { tags: ['old'] })
    const friendReferencedBy = makeCard(9, { tags: ['friend'], ownerUsername: 'bob' })
    const state = {
      rootCard,
      referenceCards: [ownReference, friendReference],
      ownReferenceCards: [ownReference],
      friendReferenceCards: [friendReference],
      referencedByCards: [ownReferencedBy, friendReferencedBy],
      ownReferencedByCards: [ownReferencedBy],
      friendReferencedByCards: [friendReferencedBy],
    }

    const next = updateMemoReferenceDetailCardTags(state, 1, ['new'])

    expect(next.rootCard?.tags).toEqual(['new'])
    expect(next.referenceCards.map((card) => card.tags)).toEqual([['new'], ['friend']])
    expect(next.ownReferenceCards[0]?.tags).toEqual(['new'])
    expect(next.referencedByCards.map((card) => card.tags)).toEqual([['new'], ['friend']])
    expect(next.ownReferencedByCards[0]?.tags).toEqual(['new'])
    expect(next.friendReferenceCards[0]).toBe(friendReference)
    expect(next.friendReferencedByCards[0]).toBe(friendReferencedBy)
  })

  it('removes the deleted card from every rendered detail section', () => {
    const rootCard = makeCard(1)
    const ownReference = makeCard(1)
    const friendReference = makeCard(7, { ownerUsername: 'bob' })
    const ownReferencedBy = makeCard(1)
    const friendReferencedBy = makeCard(9, { ownerUsername: 'bob' })
    const state = {
      rootCard,
      referenceCards: [ownReference, friendReference],
      ownReferenceCards: [ownReference],
      friendReferenceCards: [friendReference],
      referencedByCards: [ownReferencedBy, friendReferencedBy],
      ownReferencedByCards: [ownReferencedBy],
      friendReferencedByCards: [friendReferencedBy],
    }

    const next = removeMemoReferenceDetailCard(state, 1)

    expect(next.rootCard).toBeNull()
    expect(next.referenceCards).toEqual([friendReference])
    expect(next.ownReferenceCards).toEqual([])
    expect(next.friendReferenceCards).toEqual([friendReference])
    expect(next.referencedByCards).toEqual([friendReferencedBy])
    expect(next.ownReferencedByCards).toEqual([])
    expect(next.friendReferencedByCards).toEqual([friendReferencedBy])
  })

  it('does not update friend cards or a friend root that shares my memo id', () => {
    const friendRoot = makeCard(7, { tags: ['friend-root'] })
    const ownReference = makeCard(7, { tags: ['old'] })
    const friendReference = makeCard(7, { tags: ['friend'], ownerUsername: 'bob' })
    const state = {
      rootCard: friendRoot,
      referenceCards: [ownReference, friendReference],
      ownReferenceCards: [ownReference],
      friendReferenceCards: [friendReference],
      referencedByCards: [],
      ownReferencedByCards: [],
      friendReferencedByCards: [],
    }

    const next = updateMemoReferenceDetailCardTags(state, 7, ['new'], {
      includeRootCard: false,
    })

    expect(next.rootCard).toBe(friendRoot)
    expect(next.referenceCards.map((card) => card.tags)).toEqual([['new'], ['friend']])
    expect(next.ownReferenceCards[0]?.tags).toEqual(['new'])
    expect(next.friendReferenceCards[0]).toBe(friendReference)
  })

  it('does not remove friend cards or a friend root that shares my memo id', () => {
    const friendRoot = makeCard(7)
    const ownReference = makeCard(7)
    const friendReference = makeCard(7, { ownerUsername: 'bob' })
    const state = {
      rootCard: friendRoot,
      referenceCards: [ownReference, friendReference],
      ownReferenceCards: [ownReference],
      friendReferenceCards: [friendReference],
      referencedByCards: [],
      ownReferencedByCards: [],
      friendReferencedByCards: [],
    }

    const next = removeMemoReferenceDetailCard(state, 7, {
      includeRootCard: false,
    })

    expect(next.rootCard).toBe(friendRoot)
    expect(next.referenceCards).toEqual([friendReference])
    expect(next.ownReferenceCards).toEqual([])
    expect(next.friendReferenceCards).toEqual([friendReference])
  })
})

describe('buildMemoCardItemFromMemo', () => {
  function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
    return {
      id,
      content: `memo-${id}`,
      tags: [],
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
      refs: [],
      referencedBy: [],
      ...overrides,
    }
  }

  it('builds a card item with reference previews resolved from allMemos', () => {
    const baseMemo = makeMemo(42, { tags: ['工作'], content: 'Hello world', refs: ['10'], referencedBy: ['20'] })
    const refMemo = makeMemo(10, { content: 'Referenced memo', referencedBy: ['42'] })
    const byMemo = makeMemo(20, { content: 'Referencing memo', refs: ['42'] })

    const card = buildMemoCardItemFromMemo(baseMemo, [baseMemo, refMemo, byMemo])
    expect(card.id).toBe(42)
    expect(card.tags).toEqual(['工作'])
    expect(card.content).toBe('Hello world')
    expect(card.ownerUsername).toBe('')
    expect(card.referencePreview).not.toBeNull()
    expect(card.referencedByPreviews).toHaveLength(1)
  })

  it('sets ownerUsername when provided', () => {
    const simpleMemo = makeMemo(5, { content: 'Friend memo' })
    const card = buildMemoCardItemFromMemo(simpleMemo, [simpleMemo], { ownerUsername: 'bob' })
    expect(card.ownerUsername).toBe('bob')
    expect(card.tags).toEqual(['无'])
    expect(card.referencePreview).toBeNull()
    expect(card.referencedByPreviews).toHaveLength(0)
  })
})
