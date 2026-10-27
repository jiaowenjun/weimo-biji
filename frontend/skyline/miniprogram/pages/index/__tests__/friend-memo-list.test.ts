import { describe, expect, it } from 'vitest'
import {
  buildFriendMemoSearchFiltersFromDraft,
  collectFriendMemoReferenceOwnIds,
  collectFriendMemoReferencedByOwnIds,
  createFriendMemoListState,
  friendMemoListLoadFailedPatch,
  friendMemoListLoadStartPatch,
  friendMemoListPagePatch,
} from '../friend-memo-list'

describe('friend memo list state', () => {
  it('starts empty and uninitialized', () => {
    expect(createFriendMemoListState()).toEqual({
      cards: [],
      nextCursor: null,
      hasMore: false,
      initialized: false,
      refreshing: false,
      loadingMore: false,
      initialLoadFailed: false,
      loadMoreFailed: false,
    })
  })

  it('builds friend memo search filters from tag drafts', () => {
    expect(buildFriendMemoSearchFiltersFromDraft({
      keyword: 'ignored',
      selectedTag: 'work',
      dateMode: 'day',
      dateValue: '',
    })).toEqual({ tag: 'work', text: { contains: 'ignored' } })
  })

  it('builds friend memo search filters from day drafts', () => {
    expect(buildFriendMemoSearchFiltersFromDraft({
      keyword: '',
      selectedTag: '',
      dateMode: 'day',
      dateValue: '2026-05-01',
    })).toEqual({
      createdAt: { kind: 'day', year: 2026, month: 5, day: 1 },
    })
  })

  it('includes text filter when keyword is present', () => {
    expect(buildFriendMemoSearchFiltersFromDraft({
      keyword: 'hello',
      selectedTag: '',
      dateMode: 'day',
      dateValue: '',
    })).toEqual({ text: { contains: 'hello' } })
  })

  it('builds first page patch', () => {
    const patch = friendMemoListPagePatch({
      items: [{
        id: 7,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: ['friend'],
        content: 'friend memo',
        refs: [],
        referencedBy: ['3'],
      }],
      nextCursor: 'next',
      hasMore: true,
      totalCount: 1,
    }, false)

    expect(patch.memoCards).toHaveLength(1)
    expect(patch.memoRenderCards).toBe(patch.memoCards)
    expect(patch.memoNextCursor).toBe('next')
    expect(patch.memoHasMore).toBe(true)
    expect(patch.memoListInitialized).toBe(true)
  })

  it('projects friend memo referenced-by rows as my annotation summaries', () => {
    const page = {
      items: [{
        id: 7,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: ['friend'],
        content: 'friend memo',
        refs: [],
        referencedBy: ['3'],
      }],
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    }

    expect(collectFriendMemoReferencedByOwnIds(page)).toEqual([3])

    const patch = friendMemoListPagePatch(page, false, [], {
      referencedByMemos: [{
        id: 3,
        createdAt: '2026-04-30T01:00:00.000Z',
        updatedAt: '2026-04-30T01:00:00.000Z',
        tags: [],
        content: 'my annotation memo',
        refs: ['bob/7'],
        referencedBy: [],
      }],
    })

    expect(patch.memoCards[0]?.referencedByPreviews[0]?.displayText).toBe('我: my annotation memo')
  })

  it('projects friend memo refs to my memo summaries', () => {
    const page = {
      items: [{
        id: 7,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: ['friend'],
        content: 'friend annotation',
        refs: ['1'],
        referencedBy: [],
      }],
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    }

    expect(collectFriendMemoReferenceOwnIds(page)).toEqual([1])

    const patch = friendMemoListPagePatch(page, false, [], {
      referenceMemos: [{
        id: 1,
        createdAt: '2026-04-29T01:00:00.000Z',
        updatedAt: '2026-04-29T01:00:00.000Z',
        tags: [],
        content: 'my original memo',
        refs: [],
        referencedBy: [],
      }],
    })

    expect(patch.memoCards[0]?.referencePreview?.displayText).toBe('我: my original memo')
  })

  it('infers missing friend memo refs from my cached referenced-by relation', () => {
    const page = {
      items: [{
        id: 7,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: ['friend'],
        content: 'friend annotation',
        refs: [],
        referencedBy: [],
      }],
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    }

    const patch = friendMemoListPagePatch(page, false, [], {
      friendUsername: 'bob',
      inferredReferenceMemos: [{
        id: 1,
        createdAt: '2026-04-29T01:00:00.000Z',
        updatedAt: '2026-04-29T01:00:00.000Z',
        tags: [],
        content: 'my original memo',
        refs: [],
        referencedBy: ['bob/7'],
      }],
    })

    expect(patch.memoCards[0]?.referenceId).toBe('1')
    expect(patch.memoCards[0]?.referencePreview?.displayText).toBe('我: my original memo')
  })

  it('appends page cards to previous cards', () => {
    const first = friendMemoListPagePatch({
      items: [{
        id: 7,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: [],
        content: 'first',
        refs: [],
        referencedBy: [],
      }],
      nextCursor: 'next',
      hasMore: true,
      totalCount: 2,
    }, false)
    const second = friendMemoListPagePatch({
      items: [{
        id: 8,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        tags: [],
        content: 'second',
        refs: [],
        referencedBy: [],
      }],
      nextCursor: null,
      hasMore: false,
      totalCount: 2,
    }, true, first.memoCards)

    expect(second.memoCards.map((card) => card.id)).toEqual([7, 8])
    expect(second.memoRenderCards).toBe(second.memoCards)
  })

  it('distinguishes initial and load-more failures', () => {
    expect(friendMemoListLoadFailedPatch(false)).toMatchObject({
      memoListInitialLoadFailed: true,
      memoListLoadMoreFailed: false,
    })
    expect(friendMemoListLoadFailedPatch(true)).toMatchObject({
      memoListInitialLoadFailed: false,
      memoListLoadMoreFailed: true,
    })
  })

  it('sets loading flags for refresh and load more', () => {
    expect(friendMemoListLoadStartPatch(false)).toMatchObject({
      memoListRefreshing: true,
      memoListLoadingMore: false,
    })
    expect(friendMemoListLoadStartPatch(true)).toMatchObject({
      memoListRefreshing: false,
      memoListLoadingMore: true,
    })
  })
})
