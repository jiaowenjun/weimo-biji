import { describe, expect, it } from 'vitest'
import type { Memo } from '../../models/memo'
import {
  buildMemoCardItemFromMemo,
  buildMemoReferenceCards,
  buildMemoReferenceDetailProjection,
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
    expect(projection.referenceCards[0]?.referencedByPreviews.map((preview) => preview.id)).toEqual(['10', '21'])
    expect(projection.referencedByCards.map((card) => card.id)).toEqual([11])
    expect(projection.referencedByCards[0]?.referencePreview?.id).toBe('10')
  })

  it('keeps relation card referenced-by previews date formatted in self detail', () => {
    const root = makeMemo(10, {
      content: 'Root memo',
      refs: ['1'],
    })
    const ownQuotedMemo = makeMemo(1, {
      content: 'Own quoted memo',
      referencedBy: ['10'],
    })

    const projection = buildMemoReferenceDetailProjection(root, [root, ownQuotedMemo])

    expect(projection.referenceCards[0]?.referencedByPreviews[0]?.displayText).toBe(
      '2026-04-24：Root memo',
    )
  })

  it('builds reference cards preserving the combined ref order while dropping non-own refs', () => {
    const root = makeMemo(10, {
      refs: ['1', 'bob/7', '2'],
    })
    const ownMemoA = makeMemo(1, { content: 'Own quoted A' })
    const ownMemoB = makeMemo(2, { content: 'Own quoted B' })

    const projection = buildMemoReferenceDetailProjection(root, [
      root,
      ownMemoA,
      ownMemoB,
    ])

    expect(projection.referenceCards.map((card) => card.id)).toEqual([1, 2])
  })

  it('builds referenced-by cards preserving the combined order while dropping non-own refs', () => {
    const root = makeMemo(10, {
      referencedBy: ['11', 'bob/9', '12'],
    })
    const ownMemoA = makeMemo(11, { content: 'Own referrer A' })
    const ownMemoB = makeMemo(12, { content: 'Own referrer B' })

    const projection = buildMemoReferenceDetailProjection(root, [
      root,
      ownMemoA,
      ownMemoB,
    ])

    expect(projection.referencedByCards.map((card) => card.id)).toEqual([11, 12])
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
})

describe('memo-reference-detail local card updates', () => {
  it('updates tags for the matching card across every rendered detail section', () => {
    const rootCard = makeCard(1, { tags: ['old'] })
    const reference = makeCard(1, { tags: ['old'] })
    const otherReference = makeCard(7, { tags: ['other'] })
    const referencedBy = makeCard(1, { tags: ['old'] })
    const state = {
      rootCard,
      referenceCards: [reference, otherReference],
      referencedByCards: [referencedBy],
    }

    const next = updateMemoReferenceDetailCardTags(state, 1, ['new'])

    expect(next.rootCard?.tags).toEqual(['new'])
    expect(next.referenceCards.map((card) => card.tags)).toEqual([['new'], ['other']])
    expect(next.referencedByCards[0]?.tags).toEqual(['new'])
  })

  it('removes the deleted card from every rendered detail section', () => {
    const rootCard = makeCard(1)
    const reference = makeCard(1)
    const otherReference = makeCard(7)
    const referencedBy = makeCard(1)
    const otherReferencedBy = makeCard(9)
    const state = {
      rootCard,
      referenceCards: [reference, otherReference],
      referencedByCards: [referencedBy, otherReferencedBy],
    }

    const next = removeMemoReferenceDetailCard(state, 1)

    expect(next.rootCard).toBeNull()
    expect(next.referenceCards).toEqual([otherReference])
    expect(next.referencedByCards).toEqual([otherReferencedBy])
  })

  it('does not update the root card when includeRootCard is false', () => {
    const rootCard = makeCard(7, { tags: ['root'] })
    const reference = makeCard(7, { tags: ['old'] })
    const state = {
      rootCard,
      referenceCards: [reference],
      referencedByCards: [],
    }

    const next = updateMemoReferenceDetailCardTags(state, 7, ['new'], {
      includeRootCard: false,
    })

    expect(next.rootCard).toBe(rootCard)
    expect(next.referenceCards[0]?.tags).toEqual(['new'])
  })

  it('does not remove the root card when includeRootCard is false', () => {
    const rootCard = makeCard(7)
    const reference = makeCard(7)
    const state = {
      rootCard,
      referenceCards: [reference],
      referencedByCards: [],
    }

    const next = removeMemoReferenceDetailCard(state, 7, {
      includeRootCard: false,
    })

    expect(next.rootCard).toBe(rootCard)
    expect(next.referenceCards).toEqual([])
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
    expect(card.referencePreview).not.toBeNull()
    expect(card.referencedByPreviews).toHaveLength(1)
  })

  it('uses the 无 placeholder for tag-less memos and empty previews without relations', () => {
    const simpleMemo = makeMemo(5, { content: 'Plain memo' })
    const card = buildMemoCardItemFromMemo(simpleMemo, [simpleMemo])
    expect(card.tags).toEqual(['无'])
    expect(card.referencePreview).toBeNull()
    expect(card.referencedByPreviews).toHaveLength(0)
  })
})
