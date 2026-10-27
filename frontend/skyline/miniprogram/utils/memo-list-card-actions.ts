import {
  buildMemoReferenceDisplayText,
  buildMemoReferenceFallbackText,
  type MemoCardItem,
} from './memo-list-presentation'
import type { MemoPermissions } from './memo-permissions'
export const MEMO_CARD_DOUBLE_TAP_THRESHOLD = 380
export const MEMO_DELETE_EXIT_MS = 260

export interface CardActionsHost {
  data: { memoCards: MemoCardItem[] }
  _lastCardTapMemoId: number | null
  _lastCardTapAt: number
  _deletingMemoId: number | null
  _modifyingMemoId: number | null
  onMemoDeleted?: (memoId: number) => void
  onMemoTagsUpdated?: (memoId: number, tags: string[]) => void
}

export interface LoadMoreGuardState {
  initialized: boolean
  initialLoadFailed: boolean
  refreshing: boolean
  loadingMore: boolean
  loadMoreFailed: boolean
  hasMore: boolean
  nextCursor: string | null
}

export function detectMemoCardDoubleTap(
  host: CardActionsHost,
  memoId: number,
  now: number,
): boolean {
  const isDoubleTap =
    host._lastCardTapMemoId === memoId &&
    now - host._lastCardTapAt <= MEMO_CARD_DOUBLE_TAP_THRESHOLD

  if (isDoubleTap) {
    host._lastCardTapMemoId = null
    host._lastCardTapAt = 0
    return true
  }

  host._lastCardTapMemoId = memoId
  host._lastCardTapAt = now
  return false
}

export function resetMemoCardTap(host: CardActionsHost): void {
  host._lastCardTapMemoId = null
  host._lastCardTapAt = 0
}

export function shouldSkipLoadMore(state: LoadMoreGuardState): boolean {
  return (
    !state.initialized ||
    state.initialLoadFailed ||
    state.refreshing ||
    state.loadingMore ||
    state.loadMoreFailed ||
    !state.hasMore ||
    !state.nextCursor
  )
}

import {
  openMemoCompose,
  openMemoComposeTagPicker,
  openMemoShareImage,
} from './navigation'
import { workspaceStore } from '../store/store-bindings/workspace-store.instance'
import { pruneMemoTagNoneWhenMixed, isTagNoneMemoPlaceholder, TAG_NONE_LITERAL } from './tag-none'
import { toErrorMessage } from './request'
import { getDangerColor } from './theme'

function normalizeMemoTagsForPersist(tags: readonly string[]): string[] {
  return pruneMemoTagNoneWhenMixed([...tags])
}

function memoTagsPersistEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((t) => setA.has(t))
}

export function openEditComposeForCard(
  cards: MemoCardItem[],
  memoId: number,
  onSaved?: Parameters<typeof openMemoCompose>[1],
  navOptions?: { routeType?: string },
): void {
  const card = cards.find((c) => c.id === memoId)
  if (!card) return
  const initialReferencePreview =
    card.referencePreview?.displayText ??
    (card.referenceId != null ? buildMemoReferenceFallbackText(card.referenceId) : null)
  const payload: MemoComposeInitPayload = {
    mode: 'edit',
    memoId: card.id,
    initialContent: card.content,
    initialTags: [...card.tags],
    initialRefs: card.referenceId != null ? [card.referenceId] : [],
    initialReferencePreview,
  }
  if (onSaved) {
    openMemoCompose(payload, onSaved, navOptions)
    return
  }
  openMemoCompose(payload, undefined, navOptions)
}

export function openQuoteComposeForCard(
  cards: MemoCardItem[],
  memoId: number,
  options?: { routeType?: string; onSaved?: Parameters<typeof openMemoCompose>[1] } | Parameters<typeof openMemoCompose>[1],
): void {
  const card = cards.find((c) => c.id === memoId)
  if (!card) return
  const normalizedOptions = typeof options === 'function' ? { onSaved: options } : options
  const initialReferencePreview =
    buildMemoReferenceDisplayText(card.createdAtText, card.content) ||
    buildMemoReferenceFallbackText(String(card.id))
  openMemoCompose({
    mode: 'create',
    initialContent: '',
    initialTags: [...card.tags],
    initialRefs: [String(card.id)],
    initialReferencePreview,
  }, normalizedOptions?.onSaved, normalizedOptions?.routeType ? { routeType: normalizedOptions.routeType } : undefined)
}

export function confirmDeleteMemo(host: CardActionsHost, memoId: number): void {
  if (host._deletingMemoId != null) return

  wx.showModal({
    title: '删除笔记',
    content: '确定删除这条笔记吗？删除后不可恢复。',
    confirmText: '删除',
    confirmColor: getDangerColor(),
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return

      host._deletingMemoId = memoId
      workspaceStore
        .deleteMemoWithExitAnimation(memoId, MEMO_DELETE_EXIT_MS)
        .then(() => {
          host.onMemoDeleted?.(memoId)
        })
        .catch((error) => {
          wx.showToast({ title: toErrorMessage(error, '删除笔记失败'), icon: 'none' })
        })
        .finally(() => {
          host._deletingMemoId = null
        })
    },
  })
}

export function runMemoModifyTag(
  host: CardActionsHost,
  memoId: number,
  targetTag: string,
  options?: { allowMultiTag?: boolean; routeType?: string },
): void {
  if (host._modifyingMemoId != null) return

  const card = host.data.memoCards.find((c) => c.id === memoId)
  if (!card) return

  const allowMulti = options?.allowMultiTag === true
  if (allowMulti) {
    if (!card.tags.includes(targetTag) || isTagNoneMemoPlaceholder(targetTag)) return
  } else if (card.tags.length !== 1 || card.tags[0] !== targetTag) {
    return
  }

  host._modifyingMemoId = memoId

  const selectedTagsForPicker = allowMulti
    ? (card.tags.length > 0 ? [...card.tags] : [TAG_NONE_LITERAL])
    : [targetTag]

  openMemoComposeTagPicker(
    {
      mode: 'update',
      targetTag,
      selectedTags: selectedTagsForPicker,
      initialDraft: targetTag,
    },
    (result) => {
      const rawNext = Array.isArray(result?.selectedTags) ? [...result.selectedTags] : []
      const nextTags = normalizeMemoTagsForPersist(rawNext)
      const cardNorm = normalizeMemoTagsForPersist(card.tags)
      if (memoTagsPersistEqual(nextTags, cardNorm)) {
        host._modifyingMemoId = null
        return
      }

      workspaceStore
        .updateMemo(memoId, { content: card.content, tags: nextTags })
        .then(() => {
          host.onMemoTagsUpdated?.(memoId, nextTags)
          wx.showToast({ title: '标签已更新', icon: 'success' })
        })
        .catch((error) => {
          wx.showToast({ title: toErrorMessage(error, '更新标签失败'), icon: 'none' })
        })
        .finally(() => {
          host._modifyingMemoId = null
        })
    },
    options?.routeType ? { routeType: options.routeType } : undefined,
  )
}

export function runMemoRemoveTagFromMemo(
  host: CardActionsHost,
  memoId: number,
  tag: string,
): void {
  if (host._modifyingMemoId != null || host._deletingMemoId != null) return

  const card = host.data.memoCards.find((c) => c.id === memoId)
  if (!card) return
  if (!card.tags.includes(tag) || isTagNoneMemoPlaceholder(tag)) return

  wx.showModal({
    title: '移除标签',
    content: `确定从这条笔记移除标签 #${tag} 吗？`,
    confirmText: '移除',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return

      host._modifyingMemoId = memoId
      const filtered = card.tags.filter((t) => t !== tag)
      const nextTags = normalizeMemoTagsForPersist(filtered)
      const cardNorm = normalizeMemoTagsForPersist(card.tags)
      if (memoTagsPersistEqual(nextTags, cardNorm)) {
        host._modifyingMemoId = null
        return
      }

      workspaceStore
        .updateMemo(memoId, { content: card.content, tags: nextTags })
        .then(() => {
          host.onMemoTagsUpdated?.(memoId, nextTags)
          wx.showToast({ title: '已移除标签', icon: 'success' })
        })
        .catch((error) => {
          wx.showToast({ title: toErrorMessage(error, '移除标签失败'), icon: 'none' })
        })
        .finally(() => {
          host._modifyingMemoId = null
        })
    },
  })
}

export function runMemoAddTagFromList(host: CardActionsHost, memoId: number, navOptions?: { routeType?: string }): void {
  if (host._modifyingMemoId != null) return

  const card = host.data.memoCards.find((c) => c.id === memoId)
  if (!card) return

  host._modifyingMemoId = memoId

  const selectedTags = card.tags.length > 0 ? [...card.tags] : [TAG_NONE_LITERAL]

  openMemoComposeTagPicker(
    {
      mode: 'insert',
      targetTag: '',
      selectedTags,
      initialDraft: '',
    },
    (result) => {
      const rawNext = Array.isArray(result?.selectedTags) ? [...result.selectedTags] : []
      const nextTags = normalizeMemoTagsForPersist(rawNext)
      const cardNorm = normalizeMemoTagsForPersist(card.tags)
      if (memoTagsPersistEqual(nextTags, cardNorm)) {
        host._modifyingMemoId = null
        return
      }

      workspaceStore
        .updateMemo(memoId, { content: card.content, tags: nextTags })
        .then(() => {
          host.onMemoTagsUpdated?.(memoId, nextTags)
          wx.showToast({ title: '标签已更新', icon: 'success' })
        })
        .catch((error) => {
          wx.showToast({ title: toErrorMessage(error, '更新标签失败'), icon: 'none' })
        })
        .finally(() => {
          host._modifyingMemoId = null
        })
    },
    navOptions,
  )
}

export function openMemoShareForCard(
  cards: MemoCardItem[],
  memoId: number,
  navOptions?: { routeType?: string },
): void {
  const card = cards.find((c) => c.id === memoId)
  if (!card) return
  openMemoShareImage({ card }, navOptions)
}

export function copyMemoContentForCard(cards: MemoCardItem[], memoId: number): void {
  const card = cards.find((c) => c.id === memoId)
  if (!card) return
  wx.setClipboardData({
    data: card.content,
    fail: () => {
      wx.showToast({ title: '复制失败', icon: 'none' })
    },
  })
}

export interface MemoCardEventHost extends CardActionsHost {
  _strategy: {
    onCardDoubleTap(ctx: { memoCards: MemoCardItem[]; host: CardActionsHost; refreshList: () => Promise<void> }, memoId: number): void
    onCardQuote(ctx: { memoCards: MemoCardItem[]; host: CardActionsHost; refreshList: () => Promise<void> }, memoId: number): void
    onCardReferenceTap(memoId: number): void
  }
  _permissionsFor(memoId: number): MemoPermissions
  _cardActionContext(): { memoCards: MemoCardItem[]; host: CardActionsHost; refreshList: () => Promise<void> }
}

export function dispatchMemoCardTap(host: MemoCardEventHost, memoId: number): void {
  if (!detectMemoCardDoubleTap(host, memoId, Date.now())) return
  if (!host._permissionsFor(memoId).canView) return
  host._strategy.onCardDoubleTap(host._cardActionContext(), memoId)
}

export function dispatchMemoEdit(host: MemoCardEventHost, memoId: number): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canEdit) return
  openEditComposeForCard(host.data.memoCards, memoId)
}

export function dispatchMemoQuote(host: MemoCardEventHost, memoId: number): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canQuote) return
  host._strategy.onCardQuote(host._cardActionContext(), memoId)
}

export function dispatchMemoReferenceTap(host: MemoCardEventHost, memoId: number): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canSeeDetailEntry) return
  host._strategy.onCardReferenceTap(memoId)
}

export function dispatchMemoDelete(host: MemoCardEventHost, memoId: number): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canDelete) return
  confirmDeleteMemo(host, memoId)
}

export function dispatchMemoModifyTag(
  host: MemoCardEventHost,
  memoId: number,
  tag: string,
  options?: { allowMultiTag?: boolean; routeType?: string },
): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canModifyTag) return
  runMemoModifyTag(host, memoId, tag, options)
}

export function dispatchMemoRemoveTag(host: MemoCardEventHost, memoId: number, tag: string): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canRemoveTag) return
  runMemoRemoveTagFromMemo(host, memoId, tag)
}

export function dispatchMemoAddTag(
  host: MemoCardEventHost,
  memoId: number,
  navOptions?: { routeType?: string },
): void {
  resetMemoCardTap(host)
  if (!host._permissionsFor(memoId).canAddTag) return
  runMemoAddTagFromList(host, memoId, navOptions)
}
