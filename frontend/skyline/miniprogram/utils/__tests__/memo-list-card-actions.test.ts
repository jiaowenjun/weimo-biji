import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectMemoCardDoubleTap,
  resetMemoCardTap,
  shouldSkipLoadMore,
  openEditComposeForCard,
  openFriendQuoteComposeForCard,
  openQuoteComposeForCard,
  confirmDeleteMemo,
  runMemoModifyTag,
  runMemoRemoveTagFromMemo,
  runMemoAddTagFromList,
  copyMemoContentForCard,
  dispatchMemoAddTag,
  dispatchMemoCardTap,
  dispatchMemoDelete,
  dispatchMemoEdit,
  dispatchMemoModifyTag,
  dispatchMemoQuote,
  dispatchMemoReferenceTap,
  dispatchMemoRemoveTag,
  MEMO_CARD_DOUBLE_TAP_THRESHOLD,
  MEMO_DELETE_EXIT_MS,
  type CardActionsHost,
  type MemoCardEventHost,
  type LoadMoreGuardState,
} from '../memo-list-card-actions'

import { resolvePermissions, type ViewerRole } from '../memo-permissions'
import { TAG_NONE_LITERAL } from '../tag-none'

vi.mock('../navigation', () => ({
  openMemoCompose: vi.fn(),
  openMemoComposeTagPicker: vi.fn(),
}))

vi.mock('../request', () => ({
  toErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}))

vi.mock('../theme', () => ({
  getDangerColor: vi.fn(() => '#FF3B30'),
  applyNavStatusBarStyle: vi.fn(),
}))

vi.mock('../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    deleteMemoWithExitAnimation: vi.fn(() => Promise.resolve()),
    updateMemo: vi.fn(() => Promise.resolve({ id: 1 })),
  },
}))

import { openMemoCompose, openMemoComposeTagPicker } from '../navigation'
import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'

const showModalMock = vi.fn()
const showToastMock = vi.fn()
const setClipboardDataMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  showModalMock.mockReset()
  showToastMock.mockReset()
  setClipboardDataMock.mockReset()
  ;(globalThis as any).wx = {
    showModal: showModalMock,
    showToast: showToastMock,
    setClipboardData: setClipboardDataMock,
  }
})

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function makeHost(): CardActionsHost {
  return {
    data: { memoCards: [] },
    _lastCardTapMemoId: null,
    _lastCardTapAt: 0,
    _deletingMemoId: null,
    _modifyingMemoId: null,
  }
}

function makeGuardState(overrides: Partial<LoadMoreGuardState> = {}): LoadMoreGuardState {
  return {
    initialized: true,
    initialLoadFailed: false,
    refreshing: false,
    loadingMore: false,
    loadMoreFailed: false,
    hasMore: true,
    nextCursor: 'cursor-1',
    ...overrides,
  }
}

describe('detectMemoCardDoubleTap', () => {
  it('first tap stores tracking and returns false', () => {
    const host = makeHost()
    expect(detectMemoCardDoubleTap(host, 1, 1000)).toBe(false)
    expect(host._lastCardTapMemoId).toBe(1)
    expect(host._lastCardTapAt).toBe(1000)
  })

  it('second tap on same memo within threshold returns true and clears tracking', () => {
    const host = makeHost()
    detectMemoCardDoubleTap(host, 1, 1000)
    expect(detectMemoCardDoubleTap(host, 1, 1000 + MEMO_CARD_DOUBLE_TAP_THRESHOLD)).toBe(true)
    expect(host._lastCardTapMemoId).toBeNull()
    expect(host._lastCardTapAt).toBe(0)
  })

  it('second tap beyond threshold restarts tracking and returns false', () => {
    const host = makeHost()
    detectMemoCardDoubleTap(host, 1, 1000)
    expect(
      detectMemoCardDoubleTap(host, 1, 1000 + MEMO_CARD_DOUBLE_TAP_THRESHOLD + 1),
    ).toBe(false)
    expect(host._lastCardTapMemoId).toBe(1)
    expect(host._lastCardTapAt).toBe(1000 + MEMO_CARD_DOUBLE_TAP_THRESHOLD + 1)
  })

  it('tap on a different memo restarts tracking and returns false', () => {
    const host = makeHost()
    detectMemoCardDoubleTap(host, 1, 1000)
    expect(detectMemoCardDoubleTap(host, 2, 1100)).toBe(false)
    expect(host._lastCardTapMemoId).toBe(2)
    expect(host._lastCardTapAt).toBe(1100)
  })
})

describe('resetMemoCardTap', () => {
  it('clears both tracking fields', () => {
    const host = makeHost()
    host._lastCardTapMemoId = 9
    host._lastCardTapAt = 5000
    resetMemoCardTap(host)
    expect(host._lastCardTapMemoId).toBeNull()
    expect(host._lastCardTapAt).toBe(0)
  })
})

describe('shouldSkipLoadMore', () => {
  it('returns false when ready to load more', () => {
    expect(shouldSkipLoadMore(makeGuardState())).toBe(false)
  })

  it('returns true when not initialized', () => {
    expect(shouldSkipLoadMore(makeGuardState({ initialized: false }))).toBe(true)
  })

  it('returns true when initial load failed', () => {
    expect(shouldSkipLoadMore(makeGuardState({ initialLoadFailed: true }))).toBe(true)
  })

  it('returns true when refreshing', () => {
    expect(shouldSkipLoadMore(makeGuardState({ refreshing: true }))).toBe(true)
  })

  it('returns true when loading more', () => {
    expect(shouldSkipLoadMore(makeGuardState({ loadingMore: true }))).toBe(true)
  })

  it('returns true when load more previously failed', () => {
    expect(shouldSkipLoadMore(makeGuardState({ loadMoreFailed: true }))).toBe(true)
  })

  it('returns true when there are no more pages', () => {
    expect(shouldSkipLoadMore(makeGuardState({ hasMore: false }))).toBe(true)
  })

  it('returns true when nextCursor is null', () => {
    expect(shouldSkipLoadMore(makeGuardState({ nextCursor: null }))).toBe(true)
  })
})

function hostWithCards(
  cards: {
    id: number
    content: string
    tags: string[]
    createdAtText?: string
    referenceId?: string | null
  }[],
): CardActionsHost {
  return {
    data: {
      memoCards: cards.map((c) => ({
        id: c.id,
        createdAtText: c.createdAtText ?? '',
        content: c.content,
        contentNodes: [],
        tags: c.tags,
        referenceId: c.referenceId ?? null,
        referencePreview: null,
        referencedByPreviews: [],
        exiting: false,
        renderRichText: false,
      })),
    },
    _lastCardTapMemoId: null,
    _lastCardTapAt: 0,
    _deletingMemoId: null,
    _modifyingMemoId: null,
  }
}

describe('openEditComposeForCard', () => {
  it('does nothing when card not found', () => {
    openEditComposeForCard([], 999)
    expect(openMemoCompose).not.toHaveBeenCalled()
  })

  it('opens compose in edit mode when card exists', () => {
    const cards = hostWithCards([{ id: 1, content: 'hello', tags: ['a'] }]).data.memoCards
    openEditComposeForCard(cards, 1)
    expect(openMemoCompose).toHaveBeenCalledWith(
      {
        mode: 'edit',
        memoId: 1,
        initialContent: 'hello',
        initialTags: ['a'],
        initialRefs: [],
        initialReferencePreview: null,
      },
      undefined,
      undefined,
    )
  })

  it('opens compose in edit mode with reference preview text when card has a ref', () => {
    const cards = hostWithCards([{ id: 1, content: 'hello', tags: ['a'], referenceId: '7' }]).data.memoCards
    cards[0].referencePreview = { id: '7', displayText: '2026-04-24：source memo' }

    openEditComposeForCard(cards, 1)

    expect(openMemoCompose).toHaveBeenCalledWith(
      {
        mode: 'edit',
        memoId: 1,
        initialContent: 'hello',
        initialTags: ['a'],
        initialRefs: ['7'],
        initialReferencePreview: '2026-04-24：source memo',
      },
      undefined,
      undefined,
    )
  })

  it('passes a save callback for edit compose refreshes', () => {
    const onSaved = vi.fn()
    const cards = hostWithCards([{ id: 1, content: 'hello', tags: ['a'] }]).data.memoCards

    openEditComposeForCard(cards, 1, onSaved)

    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        memoId: 1,
      }),
      onSaved,
      undefined,
    )
  })
})

describe('openQuoteComposeForCard', () => {
  it('does nothing when card not found', () => {
    openQuoteComposeForCard([], 999)
    expect(openMemoCompose).not.toHaveBeenCalled()
  })

  it('opens compose in create mode with initialRefs pointing at the quoted memo', () => {
    const cards = hostWithCards([{
      id: 7,
      content: 'A first line\nA second line',
      tags: ['source'],
      createdAtText: '2026-04-24 10:30',
    }]).data.memoCards
    openQuoteComposeForCard(cards, 7)
    expect(openMemoCompose).toHaveBeenCalledWith(
      {
        mode: 'create',
        initialContent: '',
        initialTags: ['source'],
        initialRefs: ['7'],
        initialReferencePreview: '2026-04-24：A first line A second line',
      },
      undefined,
      undefined,
    )
  })

  it('opens compose with empty initialTags when quoted card has no tags', () => {
    const cards = hostWithCards([{
      id: 7,
      content: 'x',
      tags: [],
      createdAtText: '2026-04-24 10:30',
    }]).data.memoCards
    openQuoteComposeForCard(cards, 7)
    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'create',
        initialTags: [],
      }),
      undefined,
      undefined,
    )
  })

  it('passes a save callback and route options for quote compose refreshes', () => {
    const onSaved = vi.fn()
    const cards = hostWithCards([{
      id: 7,
      content: 'quoted',
      tags: ['source'],
      createdAtText: '2026-04-24 10:30',
    }]).data.memoCards

    openQuoteComposeForCard(cards, 7, { onSaved, routeType: 'cupertino-inside' })

    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'create',
        initialRefs: ['7'],
      }),
      onSaved,
      { routeType: 'cupertino-inside' },
    )
  })
})

describe('openFriendQuoteComposeForCard', () => {
  it('opens compose for friend quote with cross-user ref and 批注/昵称 tag', () => {
    openFriendQuoteComposeForCard([
      {
        id: 7,
        createdAtText: '2026-04-30 10:00',
        content: 'friend memo',
        contentNodes: [],
        tags: ['friend'],
        referenceId: null,
        referencePreview: null,
        referencedByPreviews: [],
        exiting: false,
        renderRichText: true,
      },
    ], 7, 'bob', { ownerLabel: '鲍勃' })

    expect(openMemoCompose).toHaveBeenCalledWith(
      {
        mode: 'create',
        initialContent: '',
        initialTags: ['批注/鲍勃'],
        initialRefs: ['bob/7'],
        initialReferencePreview: '鲍勃: friend memo',
      },
      undefined,
      undefined,
    )
  })

  it('opens compose with empty tags when ownerLabel is omitted for friend quote', () => {
    openFriendQuoteComposeForCard([
      {
        id: 7,
        createdAtText: '2026-04-30 10:00',
        content: 'friend memo',
        contentNodes: [],
        tags: [],
        referenceId: null,
        referencePreview: null,
        referencedByPreviews: [],
        exiting: false,
        renderRichText: true,
      },
    ], 7, 'bob')

    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'create',
        initialTags: [],
        initialRefs: ['bob/7'],
      }),
      undefined,
      undefined,
    )
  })

  it('passes a save callback for friend quote compose refreshes', () => {
    const onSaved = vi.fn()
    openFriendQuoteComposeForCard([
      {
        id: 7,
        createdAtText: '2026-04-30 10:00',
        content: 'friend memo',
        contentNodes: [],
        tags: ['friend'],
        referenceId: null,
        referencePreview: null,
        referencedByPreviews: [],
        exiting: false,
        renderRichText: true,
      },
    ], 7, 'bob', { onSaved })

    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        initialRefs: ['bob/7'],
        initialTags: [],
      }),
      onSaved,
      undefined,
    )
  })

  it('does nothing without an owner username', () => {
    const cards = hostWithCards([{ id: 7, content: 'friend memo', tags: [] }]).data.memoCards

    openFriendQuoteComposeForCard(cards, 7, ' ')

    expect(openMemoCompose).not.toHaveBeenCalled()
  })
})

describe('confirmDeleteMemo', () => {
  it('skips when an inflight delete is already in progress', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: [] }])
    host._deletingMemoId = 7
    confirmDeleteMemo(host, 1)
    expect(showModalMock).not.toHaveBeenCalled()
  })

  it('opens delete modal and runs deletion on confirm', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: [] }])
    showModalMock.mockImplementation(({ success }: any) => success({ confirm: true }))
    confirmDeleteMemo(host, 1)
    expect(showModalMock).toHaveBeenCalledTimes(1)
    expect(workspaceStore.deleteMemoWithExitAnimation).toHaveBeenCalledWith(1, MEMO_DELETE_EXIT_MS)
  })

  it('skips deletion when user cancels modal', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: [] }])
    showModalMock.mockImplementation(({ success }: any) => success({ confirm: false }))
    confirmDeleteMemo(host, 1)
    expect(workspaceStore.deleteMemoWithExitAnimation).not.toHaveBeenCalled()
  })

  it('notifies the host after deletion succeeds', async () => {
    const host = hostWithCards([{ id: 1, content: '', tags: [] }])
    host.onMemoDeleted = vi.fn()
    showModalMock.mockImplementation(({ success }: any) => success({ confirm: true }))

    confirmDeleteMemo(host, 1)
    await flushPromises()

    expect(host.onMemoDeleted).toHaveBeenCalledWith(1)
  })
})

describe('runMemoModifyTag', () => {
  it('skips when an inflight modify is already in progress', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: ['old'] }])
    host._modifyingMemoId = 7
    runMemoModifyTag(host, 1, 'old')
    expect(openMemoComposeTagPicker).not.toHaveBeenCalled()
  })

  it('skips when card no longer matches single-tag invariant', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: ['old', 'extra'] }])
    runMemoModifyTag(host, 1, 'old')
    expect(openMemoComposeTagPicker).not.toHaveBeenCalled()
  })

  it('opens tag picker with single selected tag for default modify path', async () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['old'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['new'] })
    })
    runMemoModifyTag(host, 1, 'old')
    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'update',
        targetTag: 'old',
        selectedTags: ['old'],
      }),
      expect.any(Function),
      undefined,
    )
  })

  it('allowMultiTag opens picker with full card tags', () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['a', 'b'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation(() => {})
    runMemoModifyTag(host, 1, 'b', { allowMultiTag: true })
    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'update',
        targetTag: 'b',
        selectedTags: ['a', 'b'],
      }),
      expect.any(Function),
      undefined,
    )
  })

  it('allowMultiTag skips placeholder 无', () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['无'] }])
    runMemoModifyTag(host, 1, '无', { allowMultiTag: true })
    expect(openMemoComposeTagPicker).not.toHaveBeenCalled()
  })

  it('skips updateMemo when allowMultiTag result is set-equal to existing', () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['a', 'b'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['b', 'a'] })
    })
    runMemoModifyTag(host, 1, 'a', { allowMultiTag: true })
    expect(workspaceStore.updateMemo).not.toHaveBeenCalled()
    expect(host._modifyingMemoId).toBeNull()
  })

  it('opens tag picker in update mode and updates memo when result differs', async () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['old'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['new'] })
    })
    runMemoModifyTag(host, 1, 'old')
    expect(openMemoComposeTagPicker).toHaveBeenCalledTimes(1)
    expect(workspaceStore.updateMemo).toHaveBeenCalledWith(1, { content: 'c', tags: ['new'] })
  })

  it('notifies the host after tag update succeeds', async () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['old'] }])
    host.onMemoTagsUpdated = vi.fn()
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['new'] })
    })

    runMemoModifyTag(host, 1, 'old')
    await flushPromises()

    expect(host.onMemoTagsUpdated).toHaveBeenCalledWith(1, ['new'])
  })

  it('skips updateMemo when picker result matches existing tags', () => {
    const host = hostWithCards([{ id: 1, content: 'c', tags: ['old'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['old'] })
    })
    runMemoModifyTag(host, 1, 'old')
    expect(workspaceStore.updateMemo).not.toHaveBeenCalled()
    expect(host._modifyingMemoId).toBeNull()
  })
})

describe('runMemoRemoveTagFromMemo', () => {
  it('skips when modifying or deleting in flight', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: ['t'] }])
    host._modifyingMemoId = 1
    runMemoRemoveTagFromMemo(host, 1, 't')
    expect(showModalMock).not.toHaveBeenCalled()

    host._modifyingMemoId = null
    host._deletingMemoId = 1
    runMemoRemoveTagFromMemo(host, 1, 't')
    expect(showModalMock).not.toHaveBeenCalled()
  })

  it('skips placeholder 无', () => {
    const host = hostWithCards([{ id: 1, content: '', tags: ['无'] }])
    runMemoRemoveTagFromMemo(host, 1, '无')
    expect(showModalMock).not.toHaveBeenCalled()
  })

  it('shows modal and persists empty tags when last real tag removed', async () => {
    const host = hostWithCards([{ id: 1, content: 'x', tags: ['work'] }])
    showModalMock.mockImplementation(({ success }: any) => success({ confirm: true }))
    runMemoRemoveTagFromMemo(host, 1, 'work')
    await flushPromises()

    expect(workspaceStore.updateMemo).toHaveBeenCalledWith(1, {
      content: 'x',
      tags: [],
    })
  })

  it('does not update when modal cancelled', () => {
    const host = hostWithCards([{ id: 1, content: 'x', tags: ['work'] }])
    showModalMock.mockImplementation(({ success }: any) => success({ confirm: false }))
    runMemoRemoveTagFromMemo(host, 1, 'work')
    expect(workspaceStore.updateMemo).not.toHaveBeenCalled()
  })
})

describe('runMemoAddTagFromList', () => {
  it('opens insert picker with stable tags placeholder when card empty', () => {
    const host = hostWithCards([{ id: 1, content: 'x', tags: [] }])
    ;(openMemoComposeTagPicker as any).mockImplementation(() => {})

    runMemoAddTagFromList(host, 1)

    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'insert',
        targetTag: '',
        selectedTags: [TAG_NONE_LITERAL],
      }),
      expect.any(Function),
      undefined,
    )
  })

  it('updates memo after insert result', async () => {
    const host = hostWithCards([{ id: 1, content: 'x', tags: ['a'] }])
    ;(openMemoComposeTagPicker as any).mockImplementation((_opts: unknown, cb: any) => {
      cb({ selectedTags: ['a', 'new'] })
    })

    runMemoAddTagFromList(host, 1)
    await flushPromises()

    expect(workspaceStore.updateMemo).toHaveBeenCalledWith(1, {
      content: 'x',
      tags: ['a', 'new'],
    })
  })
})

describe('copyMemoContentForCard', () => {
  it('does nothing when the card is missing', () => {
    copyMemoContentForCard([], 999)
    expect(setClipboardDataMock).not.toHaveBeenCalled()
  })

  it('copies only the raw card content to the clipboard', () => {
    const cards = hostWithCards([{ id: 1, content: '# Title\nBody line', tags: ['work'] }]).data.memoCards

    copyMemoContentForCard(cards, 1)

    expect(setClipboardDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: '# Title\nBody line',
        fail: expect.any(Function),
      }),
    )
    expect(setClipboardDataMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.stringContaining('work') }),
    )
  })

  it('shows a failure toast when the clipboard API fails', () => {
    setClipboardDataMock.mockImplementation((options: { fail?: () => void }) => options.fail?.())
    const cards = hostWithCards([{ id: 1, content: 'Body line', tags: ['work'] }]).data.memoCards

    copyMemoContentForCard(cards, 1)

    expect(showToastMock).toHaveBeenCalledWith({ title: '复制失败', icon: 'none' })
  })
})

function makeEventHost(role: ViewerRole): MemoCardEventHost {
  const host = hostWithCards([{ id: 1, content: 'x', tags: ['work'] }]) as unknown as MemoCardEventHost
  host._permissionsFor = vi.fn(() => resolvePermissions(role))
  host._strategy = {
    onCardDoubleTap: vi.fn(),
    onCardQuote: vi.fn(),
    onCardReferenceTap: vi.fn(),
  }
  host._cardActionContext = vi.fn(() => ({
    memoCards: host.data.memoCards,
    host,
    refreshList: vi.fn(),
  }))
  return host
}

describe('permission-guarded memo card dispatchers', () => {
  it('dispatchMemoEdit no-ops when canEdit is false and does not require strategy write methods', () => {
    const host = makeEventHost('friend')

    dispatchMemoEdit(host, 1)

    expect(openMemoCompose).not.toHaveBeenCalled()
    expect(host._lastCardTapMemoId).toBeNull()
  })

  it('dispatchMemoEdit opens edit compose when canEdit is true', () => {
    const host = makeEventHost('self')

    dispatchMemoEdit(host, 1)

    expect(openMemoCompose).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        memoId: 1,
      }),
      undefined,
      undefined,
    )
  })

  it('dispatchMemoDelete no-ops when canDelete is false', () => {
    const host = makeEventHost('friend')

    dispatchMemoDelete(host, 1)

    expect(showModalMock).not.toHaveBeenCalled()
  })

  it('dispatchMemoDelete opens delete modal when canDelete is true', () => {
    const host = makeEventHost('self')
    showModalMock.mockImplementation(() => {})

    dispatchMemoDelete(host, 1)

    expect(showModalMock).toHaveBeenCalledTimes(1)
  })

  it('dispatchMemoModifyTag AddTag and RemoveTag no-op when tag permissions are false', () => {
    const host = makeEventHost('friend')

    dispatchMemoModifyTag(host, 1, 'work')
    dispatchMemoAddTag(host, 1)
    dispatchMemoRemoveTag(host, 1, 'work')

    expect(openMemoComposeTagPicker).not.toHaveBeenCalled()
    expect(showModalMock).not.toHaveBeenCalled()
  })

  it('dispatchMemoModifyTag AddTag and RemoveTag call shared helpers when permissions are true', () => {
    const host = makeEventHost('self')
    ;(openMemoComposeTagPicker as any).mockImplementation(() => {})
    showModalMock.mockImplementation(() => {})

    dispatchMemoModifyTag(host, 1, 'work')
    host._modifyingMemoId = null
    dispatchMemoAddTag(host, 1)
    host._modifyingMemoId = null
    dispatchMemoRemoveTag(host, 1, 'work')

    expect(openMemoComposeTagPicker).toHaveBeenCalledTimes(2)
    expect(showModalMock).toHaveBeenCalledTimes(1)
  })

  it('dispatchMemoModifyTag forwards routeType overrides to the tag picker helper', () => {
    const host = makeEventHost('self')
    ;(openMemoComposeTagPicker as any).mockImplementation(() => {})

    dispatchMemoModifyTag(host, 1, 'work', { routeType: 'cupertino' })

    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'update',
        targetTag: 'work',
      }),
      expect.any(Function),
      { routeType: 'cupertino' },
    )
  })

  it('dispatchMemoAddTag forwards routeType overrides to the tag picker helper', () => {
    const host = makeEventHost('self')
    ;(openMemoComposeTagPicker as any).mockImplementation(() => {})

    dispatchMemoAddTag(host, 1, { routeType: 'cupertino' })

    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'insert',
        targetTag: '',
      }),
      expect.any(Function),
      { routeType: 'cupertino' },
    )
  })

  it('dispatchMemoQuote and reference tap guard strategy calls by permissions', () => {
    const denied = makeEventHost('denied')
    const friend = makeEventHost('friend')

    dispatchMemoQuote(denied, 1)
    dispatchMemoReferenceTap(denied, 1)
    dispatchMemoQuote(friend, 1)
    dispatchMemoReferenceTap(friend, 1)

    expect(denied._strategy.onCardQuote).not.toHaveBeenCalled()
    expect(denied._strategy.onCardReferenceTap).not.toHaveBeenCalled()
    expect(friend._strategy.onCardQuote).toHaveBeenCalledWith(
      expect.objectContaining({ memoCards: friend.data.memoCards }),
      1,
    )
    expect(friend._strategy.onCardReferenceTap).toHaveBeenCalledWith(1)
  })

  it('dispatchMemoCardTap only calls double tap strategy when canView is true', () => {
    const denied = makeEventHost('denied')
    const friend = makeEventHost('friend')

    denied._lastCardTapMemoId = 1
    denied._lastCardTapAt = Date.now()
    friend._lastCardTapMemoId = 1
    friend._lastCardTapAt = Date.now()

    dispatchMemoCardTap(denied, 1)
    dispatchMemoCardTap(friend, 1)

    expect(denied._strategy.onCardDoubleTap).not.toHaveBeenCalled()
    expect(friend._strategy.onCardDoubleTap).toHaveBeenCalledWith(
      expect.objectContaining({ memoCards: friend.data.memoCards }),
      1,
    )
  })
})
