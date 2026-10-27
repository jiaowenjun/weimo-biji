import { isRecord } from './guards'
import { readWxStorage, removeWxStorage, writeWxStorage } from './wx-storage'

export const CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION = 1
export const FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS = 24 * 60 * 60 * 1000
export const FRIEND_REFERENCE_PREVIEW_MAX_ENTRIES = 100

const STORAGE_KEY_PREFIX = 'biji-skyline.friend-reference-preview.'

export interface CachedFriendReferencePreview {
  ref: string
  friendUsername: string
  ownerLabel: string
  contentSummary: string
  displayText: string
  renderKey: string
  renderVersion: number
  checkedAt: number
  lastUsedAt: number
}

export interface FriendReferencePreviewCache {
  get(ref: string): CachedFriendReferencePreview | null
  markUsed(ref: string, now?: number): void
  needsRevalidate(ref: string, now?: number): boolean
  upsert(entry: CachedFriendReferencePreview): void
  remove(ref: string): void
  flush(): void
  clear(): void
}

interface FriendReferencePreviewCacheOptions {
  now?: () => number
  maxEntries?: number
  revalidateMs?: number
}

interface PersistedFriendReferencePreviewCache {
  version: 1
  entries: CachedFriendReferencePreview[]
}

function isCachedEntry(value: unknown): value is CachedFriendReferencePreview {
  if (!isRecord(value)) return false
  return (
    typeof value.ref === 'string' &&
    typeof value.friendUsername === 'string' &&
    typeof value.ownerLabel === 'string' &&
    typeof value.contentSummary === 'string' &&
    typeof value.displayText === 'string' &&
    typeof value.renderKey === 'string' &&
    value.renderVersion === CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION &&
    typeof value.checkedAt === 'number' &&
    typeof value.lastUsedAt === 'number'
  )
}

function cloneEntry(entry: CachedFriendReferencePreview): CachedFriendReferencePreview {
  return { ...entry }
}

function toStorageKey(viewerUsername: string): string {
  return `${STORAGE_KEY_PREFIX}${viewerUsername}`
}

export function buildFriendReferencePreviewRenderKey(input: {
  friendUsername: string
  ownerLabel: string
  contentSummary: string
}): string {
  return JSON.stringify([
    input.friendUsername,
    input.ownerLabel,
    input.contentSummary,
  ])
}

function loadEntries(storageKey: string): Map<string, CachedFriendReferencePreview> {
  const entries = new Map<string, CachedFriendReferencePreview>()
  const snapshot = readWxStorage(storageKey)
  if (!isRecord(snapshot) || snapshot.version !== 1 || !Array.isArray(snapshot.entries)) {
    return entries
  }
  snapshot.entries.forEach((entry) => {
    if (isCachedEntry(entry)) entries.set(entry.ref, cloneEntry(entry))
  })
  return entries
}

function createNoopCache(): FriendReferencePreviewCache {
  return {
    get: () => null,
    markUsed: () => undefined,
    needsRevalidate: () => true,
    upsert: () => undefined,
    remove: () => undefined,
    flush: () => undefined,
    clear: () => undefined,
  }
}

export function createFriendReferencePreviewCache(
  viewerUsername: string,
  options: FriendReferencePreviewCacheOptions = {},
): FriendReferencePreviewCache {
  const normalizedViewer = viewerUsername.trim()
  if (!normalizedViewer) return createNoopCache()

  const storageKey = toStorageKey(normalizedViewer)
  const nowImpl = options.now ?? (() => Date.now())
  const maxEntries = options.maxEntries ?? FRIEND_REFERENCE_PREVIEW_MAX_ENTRIES
  const revalidateMs = options.revalidateMs ?? FRIEND_REFERENCE_PREVIEW_REVALIDATE_MS
  let entries = loadEntries(storageKey)

  return {
    get(ref) {
      const entry = entries.get(ref)
      return entry ? cloneEntry(entry) : null
    },

    markUsed(ref, now = nowImpl()) {
      const entry = entries.get(ref)
      if (!entry) return
      entries.set(ref, { ...entry, lastUsedAt: now })
    },

    needsRevalidate(ref, now = nowImpl()) {
      const entry = entries.get(ref)
      if (!entry) return true
      return now - entry.checkedAt > revalidateMs
    },

    upsert(entry) {
      entries.set(entry.ref, cloneEntry(entry))
    },

    remove(ref) {
      entries.delete(ref)
    },

    flush() {
      if (entries.size > maxEntries) {
        const trimmed = Array.from(entries.values())
          .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
          .slice(0, maxEntries)
        entries = new Map(trimmed.map((entry) => [entry.ref, entry]))
      }
      const snapshot: PersistedFriendReferencePreviewCache = {
        version: 1,
        entries: Array.from(entries.values()).map(cloneEntry),
      }
      writeWxStorage(storageKey, snapshot)
    },

    clear() {
      entries.clear()
      removeWxStorage(storageKey)
    },
  }
}
