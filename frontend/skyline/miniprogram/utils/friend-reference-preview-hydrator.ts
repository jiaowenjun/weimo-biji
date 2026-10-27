import { friendByUsername, type FriendProfile } from '../models/friend'
import type { Memo, MemoRefId } from '../models/memo'
import { getFriendMemo, getFriendSummary } from '../services/friend'
import {
  buildFriendReferencePreviewRenderKey,
  createFriendReferencePreviewCache,
  CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
  type CachedFriendReferencePreview,
  type FriendReferencePreviewCache,
} from './friend-reference-preview-cache'
import {
  collectFriendMemoReferencedByRefs,
  collectFriendMemoReferenceRefs,
} from './memo-reference-detail'
import {
  buildMemoReferenceOwnerSummaryText,
  buildMemoReferenceFallbackText,
  summarizeMemoContent,
  type MemoReferencePreview,
} from './memo-list-presentation'
import { parseFriendMemoRef } from './memo-ref-id'
import { classifyApiError } from './request'

export interface FriendReferencePreviewHydrator {
  resolve(ref: MemoRefId): MemoReferencePreview | undefined
  hydrate(memos: Memo[]): Promise<void>
  clear(): void
}

export interface FriendReferencePreviewHydratorOptions {
  getViewerUsername?: () => string | null | undefined
  now?: () => number
  cache?: FriendReferencePreviewCache
  onPreviewsUpdated?: () => void
}

function previewFromCacheEntry(entry: CachedFriendReferencePreview): MemoReferencePreview {
  return {
    id: entry.ref,
    displayText: entry.displayText,
  }
}

function isUnavailableFriendMemoError(error: unknown): boolean {
  const kind = classifyApiError(error)
  return kind === 'forbidden' || kind === 'notFound'
}

function buildCachedEntryFromMemo(
  ref: MemoRefId,
  memo: Memo,
  friend: FriendProfile,
  now: number,
): CachedFriendReferencePreview | null {
  const parsed = parseFriendMemoRef(ref)
  if (!parsed) return null
  const ownerLabel = friend.username === parsed.username
    ? friend.nickname || friend.username
    : parsed.username
  const contentSummary = summarizeMemoContent(memo.content)
  const displayText = buildMemoReferenceOwnerSummaryText(
    ownerLabel,
    memo.content,
    buildMemoReferenceFallbackText(ref),
  )
  return {
    ref,
    friendUsername: parsed.username,
    ownerLabel,
    contentSummary,
    displayText,
    renderKey: buildFriendReferencePreviewRenderKey({
      friendUsername: parsed.username,
      ownerLabel,
      contentSummary,
    }),
    renderVersion: CURRENT_FRIEND_REFERENCE_PREVIEW_RENDER_VERSION,
    checkedAt: now,
    lastUsedAt: now,
  }
}

interface HydrateRefOutcome {
  structuralChange: boolean
  notify: boolean
}

export function createFriendReferencePreviewHydrator(
  options: FriendReferencePreviewHydratorOptions = {},
): FriendReferencePreviewHydrator {
  const memoryPreviews = new Map<MemoRefId, MemoReferencePreview>()
  const inFlight = new Set<MemoRefId>()
  const now = options.now ?? (() => Date.now())
  const previewCache =
    options.cache ??
    createFriendReferencePreviewCache(options.getViewerUsername?.() ?? '')

  async function hydrateRef(
    ref: MemoRefId,
    friends: FriendProfile[],
    prev: CachedFriendReferencePreview | null,
  ): Promise<HydrateRefOutcome> {
    const parsed = parseFriendMemoRef(ref)
    if (!parsed) return { structuralChange: false, notify: false }

    const friend = friendByUsername(friends, parsed.username)
    if (!friend) {
      const notify = memoryPreviews.delete(ref)
      previewCache.remove(ref)
      return { structuralChange: true, notify }
    }

    try {
      const memo = await getFriendMemo(friend.username, parsed.memoId)
      const next = buildCachedEntryFromMemo(ref, memo, friend, now())
      if (!next) return { structuralChange: false, notify: false }
      previewCache.upsert(next)
      if (!prev || prev.renderKey !== next.renderKey) {
        memoryPreviews.set(ref, previewFromCacheEntry(next))
        return { structuralChange: true, notify: true }
      }
      return { structuralChange: true, notify: false }
    } catch (error) {
      if (isUnavailableFriendMemoError(error)) {
        const notify = memoryPreviews.delete(ref)
        previewCache.remove(ref)
        return { structuralChange: true, notify }
      }
      return { structuralChange: false, notify: false }
    }
  }

  return {
    resolve(ref: MemoRefId) {
      const cached = memoryPreviews.get(ref)
      if (cached) return cached

      const persisted = previewCache.get(ref)
      if (!persisted) return undefined
      const preview = previewFromCacheEntry(persisted)
      memoryPreviews.set(ref, preview)
      previewCache.markUsed(ref, now())
      return preview
    },

    async hydrate(memos: Memo[]) {
      const batchNow = now()
      const refs = Array.from(
        new Set([
          ...collectFriendMemoReferenceRefs(memos),
          ...collectFriendMemoReferencedByRefs(memos),
        ]),
      )

      const persistedByRef = new Map<MemoRefId, CachedFriendReferencePreview | null>()
      const toHydrate: MemoRefId[] = []

      refs.forEach((ref) => {
        const persisted = previewCache.get(ref)
        persistedByRef.set(ref, persisted)
        if (persisted) {
          memoryPreviews.set(ref, previewFromCacheEntry(persisted))
          previewCache.markUsed(ref, batchNow)
        }
        if ((!persisted || previewCache.needsRevalidate(ref, batchNow)) && !inFlight.has(ref)) {
          toHydrate.push(ref)
          inFlight.add(ref)
        }
      })

      if (toHydrate.length === 0) return

      let friends: FriendProfile[] = []
      try {
        const summary = await getFriendSummary()
        friends = summary.friends
      } catch {
        toHydrate.forEach((ref) => inFlight.delete(ref))
        return
      }

      if (friends.length === 0) {
        const hadVisiblePreview = memoryPreviews.size > 0
        memoryPreviews.clear()
        previewCache.clear()
        toHydrate.forEach((ref) => inFlight.delete(ref))
        if (hadVisiblePreview) options.onPreviewsUpdated?.()
        return
      }

      let structuralChange = false
      let shouldNotify = false

      await Promise.all(
        toHydrate.map(async (ref) => {
          try {
            const outcome = await hydrateRef(ref, friends, persistedByRef.get(ref) ?? null)
            if (outcome.structuralChange) structuralChange = true
            if (outcome.notify) shouldNotify = true
          } finally {
            inFlight.delete(ref)
          }
        }),
      )

      if (structuralChange) previewCache.flush()
      if (shouldNotify) options.onPreviewsUpdated?.()
    },

    clear() {
      memoryPreviews.clear()
      inFlight.clear()
    },
  }
}
