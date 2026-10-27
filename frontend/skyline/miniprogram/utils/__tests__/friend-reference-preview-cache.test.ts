import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFriendReferencePreviewCache,
  CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
  FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS,
  type CachedFriendReferencePreview,
} from '../friend-reference-preview-cache'

function makeEntry(
  ref: string,
  overrides: Partial<CachedFriendReferencePreview> = {},
): CachedFriendReferencePreview {
  const friendUsername = ref.split('/')[0] || 'bob'
  const ownerLabel = friendUsername === 'bob' ? '小吴' : friendUsername
  const contentSummary = `summary ${ref}`
  return {
    ref,
    friendUsername,
    ownerLabel,
    contentSummary,
    displayText: `${ownerLabel}: ${contentSummary}`,
    renderKey: `${friendUsername}|${ownerLabel}|${contentSummary}`,
    renderVersion: CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
    checkedAt: 1000,
    lastUsedAt: 1000,
    ...overrides,
  }
}

describe('friend-reference-preview-cache', () => {
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
    ;(globalThis as any).wx = {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
    }
  })

  it('loads valid entries from the viewer-scoped storage key', () => {
    const entry = makeEntry('bob/7')
    storage.set('biji-skyline.friend-reference-preview.alice', {
      version: 1,
      entries: [entry],
    })

    const cache = createFriendReferencePreviewCache('alice')

    expect(getStorageSync).toHaveBeenCalledWith('biji-skyline.friend-reference-preview.alice')
    expect(cache.get('bob/7')).toEqual(entry)
  })

  it('does not load entries from an old render version', () => {
    storage.set('biji-skyline.friend-reference-preview.alice', {
      version: 1,
      entries: [makeEntry('bob/7', { renderVersion: 0 })],
    })

    const cache = createFriendReferencePreviewCache('alice')

    expect(cache.get('bob/7')).toBeNull()
  })

  it('marks entries as used and revalidates only after the interval', () => {
    const entry = makeEntry('bob/7', { checkedAt: 2000, lastUsedAt: 2000 })
    storage.set('biji-skyline.friend-reference-preview.alice', {
      version: 1,
      entries: [entry],
    })
    const cache = createFriendReferencePreviewCache('alice')

    cache.markUsed('bob/7', 3000)

    expect(cache.get('bob/7')?.lastUsedAt).toBe(3000)
    expect(cache.needsRevalidate('bob/7', 2000 + FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS)).toBe(false)
    expect(cache.needsRevalidate('bob/7', 2001 + FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS)).toBe(true)
  })

  it('flushes a snapshot of current memory and trims by lastUsedAt', () => {
    const cache = createFriendReferencePreviewCache('alice', { maxEntries: 2 })

    cache.upsert(makeEntry('bob/1', { lastUsedAt: 10 }))
    cache.upsert(makeEntry('bob/2', { lastUsedAt: 30 }))
    cache.upsert(makeEntry('bob/3', { lastUsedAt: 20 }))
    cache.remove('bob/1')
    cache.flush()

    expect(setStorageSync).toHaveBeenCalledTimes(1)
    expect(setStorageSync).toHaveBeenCalledWith(
      'biji-skyline.friend-reference-preview.alice',
      {
        version: 1,
        entries: [
          makeEntry('bob/2', { lastUsedAt: 30 }),
          makeEntry('bob/3', { lastUsedAt: 20 }),
        ],
      },
    )
  })

  it('clears memory and storage immediately', () => {
    const cache = createFriendReferencePreviewCache('alice')
    cache.upsert(makeEntry('bob/7'))
    cache.flush()

    cache.clear()

    expect(cache.get('bob/7')).toBeNull()
    expect(removeStorageSync).toHaveBeenCalledWith('biji-skyline.friend-reference-preview.alice')
  })

  it('uses a no-op cache when viewer username is missing', () => {
    const cache = createFriendReferencePreviewCache('')

    cache.upsert(makeEntry('bob/7'))
    cache.flush()
    cache.clear()

    expect(cache.get('bob/7')).toBeNull()
    expect(getStorageSync).not.toHaveBeenCalled()
    expect(setStorageSync).not.toHaveBeenCalled()
    expect(removeStorageSync).not.toHaveBeenCalled()
  })
})
