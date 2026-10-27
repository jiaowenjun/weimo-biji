import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo } from '../../models/memo'
import {
  emptyMemoReferenceDetailData,
  loadMemoReferenceListData,
  loadSelfMemoReferenceDetailData,
} from '../memo-reference-detail-loader'

const ensureMemoDetailMock = vi.fn()
const ensureMemoDetailsMock = vi.fn()

vi.mock('../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    ensureMemoDetail: (memoId: number) => ensureMemoDetailMock(memoId),
    ensureMemoDetails: (memoIds: number[]) => ensureMemoDetailsMock(memoIds),
  },
}))

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const ts = '2026-05-26T00:00:00.000Z'
  return {
    id,
    content: `memo ${id}`,
    tags: [],
    refs: [],
    referencedBy: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('memo-reference-detail-loader', () => {
  beforeEach(() => {
    ensureMemoDetailMock.mockReset()
    ensureMemoDetailsMock.mockReset()
  })

  it('loads the root, relation, and preview memos into a detail projection', async () => {
    const root = makeMemo(7, {
      content: 'my memo A',
      refs: ['3'],
    })
    const quotedMemo = makeMemo(3, {
      content: 'my memo B',
      refs: ['5'],
    })
    const nestedMemo = makeMemo(5, {
      content: 'my memo C',
    })

    ensureMemoDetailMock.mockResolvedValue(root)
    ensureMemoDetailsMock.mockImplementation((memoIds: number[]) => {
      if (memoIds.length === 1 && memoIds[0] === 3) {
        return Promise.resolve([quotedMemo])
      }
      if (memoIds.length === 1 && memoIds[0] === 5) {
        return Promise.resolve([nestedMemo])
      }
      return Promise.resolve([])
    })

    const projection = await loadSelfMemoReferenceDetailData(7)

    expect(ensureMemoDetailMock).toHaveBeenCalledWith(7)
    expect(projection.rootCard?.id).toBe(7)
    expect(projection.referenceCards.map((card) => card.id)).toEqual([3])
    expect(projection.referenceCards[0]?.referencePreview?.displayText).toBe('2026-05-26：my memo C')
  })

  it('skips relation and preview fetches for a memo without relations', async () => {
    const root = makeMemo(7, { content: 'my memo A' })

    ensureMemoDetailMock.mockResolvedValue(root)

    const projection = await loadSelfMemoReferenceDetailData(7)

    expect(ensureMemoDetailsMock).not.toHaveBeenCalled()
    expect(projection.rootCard?.id).toBe(7)
    expect(projection.referenceCards).toEqual([])
    expect(projection.referencedByCards).toEqual([])
  })

  it('builds reference cards for references-only mode while dropping non-own refs', async () => {
    const ownMemo = makeMemo(3, {
      content: 'my memo B',
      refs: ['5'],
    })
    const ownNestedMemo = makeMemo(5, {
      content: 'my memo C',
    })

    ensureMemoDetailsMock.mockImplementation((memoIds: number[]) => {
      if (memoIds.length === 1 && memoIds[0] === 3) {
        return Promise.resolve([ownMemo])
      }
      if (memoIds.length === 1 && memoIds[0] === 5) {
        return Promise.resolve([ownNestedMemo])
      }
      return Promise.resolve([])
    })

    const projection = await loadMemoReferenceListData(['3', 'bob/7'])

    expect(projection.referenceCards.map((card) => card.id)).toEqual([3])
    expect(projection.referenceCards[0]?.referencePreview?.displayText).toBe('2026-05-26：my memo C')
  })

  it('emptyMemoReferenceDetailData returns the empty projection shape', () => {
    expect(emptyMemoReferenceDetailData()).toEqual({
      rootCard: null,
      referenceCards: [],
      referencedByCards: [],
    })
  })
})
