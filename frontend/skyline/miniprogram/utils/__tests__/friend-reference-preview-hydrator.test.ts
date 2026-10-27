import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FriendSummary } from '../../models/friend'
import type { Memo } from '../../models/memo'
import {
  buildFriendReferencePreviewRenderKey,
  CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
  FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS,
  type CachedFriendReferencePreview,
} from '../friend-reference-preview-cache'
import { ApiError } from '../request'

const getFriendSummaryMock = vi.fn()
const getFriendMemoMock = vi.fn()

vi.mock('../../services/friend', () => ({
  getFriendSummary: () => getFriendSummaryMock(),
  getFriendMemo: (username: string, id: number) => getFriendMemoMock(username, id),
}))

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const ts = '2026-05-22T00:00:00.000Z'
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

function makeFriendSummary(friends = [{
  username: 'bob',
  nickname: '小吴',
}]): FriendSummary {
  return {
    friends,
    pending_outgoing: [],
    pending_incoming_count: 0,
    unread_count: 0,
  }
}

function makeCachedEntry(
  ref: string,
  contentSummary: string,
  overrides: Partial<CachedFriendReferencePreview> = {},
): CachedFriendReferencePreview {
  const friendUsername = ref.split('/')[0] || 'bob'
  const ownerLabel = friendUsername === 'bob' ? '小吴' : friendUsername
  return {
    ref,
    friendUsername,
    ownerLabel,
    contentSummary,
    displayText: `${ownerLabel}: ${contentSummary}`,
    renderKey: buildFriendReferencePreviewRenderKey({
      friendUsername,
      ownerLabel,
      contentSummary,
    }),
    renderVersion: CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
    checkedAt: 1,
    lastUsedAt: 1,
    ...overrides,
  }
}

function unavailableError(statusCode: number) {
  return new ApiError('unavailable', statusCode, null)
}

describe('friend-reference-preview-hydrator', () => {
  const storage = new Map<string, unknown>()
  const getStorageSync = vi.fn((key: string) => storage.get(key))
  const setStorageSync = vi.fn((key: string, value: unknown) => {
    storage.set(key, value)
  })
  const removeStorageSync = vi.fn((key: string) => {
    storage.delete(key)
  })

  beforeEach(() => {
    storage.clear()
    getStorageSync.mockClear()
    setStorageSync.mockClear()
    removeStorageSync.mockClear()
    getFriendSummaryMock.mockReset()
    getFriendMemoMock.mockReset()
    ;(globalThis as any).wx = {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
    }
  })

  function seedCache(entries: CachedFriendReferencePreview[], viewerUsername = 'alice') {
    storage.set(`biji-skyline.friend-reference-preview.${viewerUsername}`, {
      version: 1,
      entries,
    })
  }

  function readStoredEntries(viewerUsername = 'alice'): CachedFriendReferencePreview[] {
    const snapshot = storage.get(`biji-skyline.friend-reference-preview.${viewerUsername}`) as
      | { entries?: CachedFriendReferencePreview[] }
      | undefined
    return snapshot?.entries ?? []
  }

  async function createHydrator(options: Record<string, unknown> = {}) {
    const mod = await import('../friend-reference-preview-hydrator')
    return mod.createFriendReferencePreviewHydrator({
      getViewerUsername: () => 'alice',
      now: () => 100 + FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS,
      ...options,
    } as never)
  }

  it('resolves cached previews before hydrate runs', async () => {
    seedCache([makeCachedEntry('bob/7', 'cached memo')])

    const hydrator = await createHydrator()

    expect(hydrator.resolve('bob/7')).toEqual({
      id: 'bob/7',
      displayText: '小吴: cached memo',
    })
    expect(getFriendMemoMock).not.toHaveBeenCalled()
  })

  it('updates checkedAt without notifying when fresh renderKey is unchanged', async () => {
    seedCache([makeCachedEntry('bob/7', 'same memo', { checkedAt: 1, lastUsedAt: 1 })])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    getFriendMemoMock.mockResolvedValue(makeMemo(7, { content: 'same memo' }))
    const onPreviewsUpdated = vi.fn()
    const now = 200 + FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS
    const hydrator = await createHydrator({
      now: () => now,
      onPreviewsUpdated,
    })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'] })])

    expect(onPreviewsUpdated).not.toHaveBeenCalled()
    expect(readStoredEntries()[0]).toMatchObject({
      ref: 'bob/7',
      checkedAt: now,
      lastUsedAt: now,
      displayText: '小吴: same memo',
    })
  })

  it('notifies once when multiple fresh previews change', async () => {
    seedCache([
      makeCachedEntry('bob/7', 'old seven'),
      makeCachedEntry('bob/8', 'old eight'),
    ])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    getFriendMemoMock.mockImplementation((_username: string, id: number) =>
      Promise.resolve(makeMemo(id, { content: id === 7 ? 'new seven' : 'new eight' })),
    )
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'], referencedBy: ['bob/8'] })])

    expect(onPreviewsUpdated).toHaveBeenCalledTimes(1)
    expect(hydrator.resolve('bob/7')?.displayText).toBe('小吴: new seven')
    expect(hydrator.resolve('bob/8')?.displayText).toBe('小吴: new eight')
    expect(getFriendMemoMock).toHaveBeenCalledTimes(2)
  })

  it('dedupes concurrent hydrate requests for the same ref', async () => {
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    let resolveMemo: (memo: Memo) => void = () => undefined
    getFriendMemoMock.mockImplementation(() => new Promise<Memo>((resolve) => {
      resolveMemo = resolve
    }))
    const hydrator = await createHydrator()
    const root = makeMemo(1, { refs: ['bob/7'] })

    const first = hydrator.hydrate([root])
    const second = hydrator.hydrate([root])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getFriendMemoMock).toHaveBeenCalledTimes(1)
    resolveMemo(makeMemo(7, { content: 'fresh memo' }))
    await Promise.all([first, second])

    expect(getFriendMemoMock).toHaveBeenCalledTimes(1)
  })

  it('keeps cached previews when friend summary cannot be fetched', async () => {
    seedCache([makeCachedEntry('bob/7', 'cached memo')])
    getFriendSummaryMock.mockRejectedValue(new Error('network'))
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'] })])

    expect(hydrator.resolve('bob/7')?.displayText).toBe('小吴: cached memo')
    expect(getFriendMemoMock).not.toHaveBeenCalled()
    expect(onPreviewsUpdated).not.toHaveBeenCalled()
    expect(removeStorageSync).not.toHaveBeenCalled()
  })

  it('clears cached previews and notifies when the current viewer has no friend', async () => {
    seedCache([makeCachedEntry('bob/7', 'cached memo')])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary([]))
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'] })])

    expect(hydrator.resolve('bob/7')).toBeUndefined()
    expect(removeStorageSync).toHaveBeenCalledWith('biji-skyline.friend-reference-preview.alice')
    expect(onPreviewsUpdated).toHaveBeenCalledTimes(1)
  })

  it('preserves cached previews for every username present in the friend list', async () => {
    seedCache([
      makeCachedEntry('bob/7', 'bob memo'),
      makeCachedEntry('carol/8', 'carol memo', {
        friendUsername: 'carol',
        ownerLabel: 'Carol',
        displayText: 'Carol: carol memo',
        renderKey: buildFriendReferencePreviewRenderKey({
          friendUsername: 'carol',
          ownerLabel: 'Carol',
          contentSummary: 'carol memo',
        }),
      }),
    ])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary([
      { username: 'bob', nickname: '小吴' },
      { username: 'carol', nickname: 'Carol' },
    ]))
    getFriendMemoMock.mockImplementation((_username: string, id: number) =>
      Promise.resolve(makeMemo(id, { content: id === 7 ? 'bob memo' : 'carol memo' })),
    )
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'], referencedBy: ['carol/8'] })])

    expect(hydrator.resolve('bob/7')?.displayText).toBe('小吴: bob memo')
    expect(hydrator.resolve('carol/8')?.displayText).toBe('Carol: carol memo')
    expect(readStoredEntries().map((entry) => entry.ref).sort()).toEqual(['bob/7', 'carol/8'])
    expect(getFriendMemoMock).toHaveBeenCalledTimes(2)
    expect(onPreviewsUpdated).not.toHaveBeenCalled()
  })

  it('hydrates friend refs by explicit username even when the friend list order differs', async () => {
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary([
      { username: 'carol', nickname: 'Carol' },
      { username: 'bob', nickname: '小吴' },
    ]))
    getFriendMemoMock.mockImplementation((username: string, id: number) =>
      Promise.resolve(makeMemo(id, {
        content: username === 'bob' ? 'bob memo' : 'carol memo',
      })),
    )
    const hydrator = await createHydrator()

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'], referencedBy: ['carol/8'] })])

    expect(hydrator.resolve('bob/7')?.displayText).toBe('小吴: bob memo')
    expect(hydrator.resolve('carol/8')?.displayText).toBe('Carol: carol memo')
    expect(getFriendMemoMock).toHaveBeenCalledTimes(2)
    expect(getFriendMemoMock.mock.calls).toEqual(
      expect.arrayContaining([
        ['bob', 7],
        ['carol', 8],
      ]),
    )
  })

  it('removes cached previews whose username is absent from the friend list', async () => {
    seedCache([
      makeCachedEntry('bob/7', 'bob memo'),
      makeCachedEntry('carol/8', 'carol memo', {
        friendUsername: 'carol',
        ownerLabel: 'carol',
        displayText: 'carol: carol memo',
        renderKey: buildFriendReferencePreviewRenderKey({
          friendUsername: 'carol',
          ownerLabel: 'carol',
          contentSummary: 'carol memo',
        }),
      }),
    ])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary([{ username: 'bob', nickname: '小吴' }]))
    getFriendMemoMock.mockResolvedValue(makeMemo(7, { content: 'bob memo' }))
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'], referencedBy: ['carol/8'] })])

    expect(hydrator.resolve('bob/7')?.displayText).toBe('小吴: bob memo')
    expect(hydrator.resolve('carol/8')).toBeUndefined()
    expect(readStoredEntries().map((entry) => entry.ref)).toEqual(['bob/7'])
    expect(getFriendMemoMock).toHaveBeenCalledTimes(1)
    expect(onPreviewsUpdated).toHaveBeenCalledTimes(1)
  })

  it('removes cached previews for unavailable friend memos', async () => {
    seedCache([makeCachedEntry('bob/7', 'cached memo')])
    getFriendSummaryMock.mockResolvedValue(makeFriendSummary())
    getFriendMemoMock.mockRejectedValue(unavailableError(404))
    const onPreviewsUpdated = vi.fn()
    const hydrator = await createHydrator({ onPreviewsUpdated })

    await hydrator.hydrate([makeMemo(1, { refs: ['bob/7'] })])

    expect(hydrator.resolve('bob/7')).toBeUndefined()
    expect(readStoredEntries()).toEqual([])
    expect(onPreviewsUpdated).toHaveBeenCalledTimes(1)
  })
})
