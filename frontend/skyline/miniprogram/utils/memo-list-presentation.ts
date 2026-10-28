import type { Memo, MemoRefId } from '../models/memo'
import { TAG_NONE_LITERAL } from './tag-none'
import { ownMemoIdFromRef } from './memo-ref-id'
import type { MemoListEntry } from '../store/memo-cache-types'
import {
  buildArrayFieldPatch,
  buildMemoCardsPatch,
  findSingleDeleteIndex,
} from '../store/store-bindings/memo-cards-patch'
import { workspaceStore } from '../store/store-bindings/workspace-store.instance'
import { renderWdfToNodes, wdfDocumentToPlainText, type RichTextNode, type WdfDocument } from './wdf'
import {
  applyMemoParagraphSpacingForHighlight,
  highlightMemoNodes,
} from './memo-highlight'
import { formatMemoTimestamp } from './memo-mapper'
import { buildEnteringCardMap, computeEnteringCardIds } from './entering-cards'

const MEMO_CARD_ENTERING_CLEANUP_MS = 300
export const REFERENCE_SUMMARY_MAX_LENGTH = 28

export const RICH_TEXT_THRESHOLD = 100

/** 卡片标签行：`[]` 与编辑页占位一致，展示为 `#无` */
export function tagsForMemoCardDisplay(tags: readonly string[]): string[] {
  if (!tags || tags.length === 0) return [TAG_NONE_LITERAL]
  return [...tags]
}

export interface MemoReferencePreview {
  id: MemoRefId
  displayText: string
}


export interface MemoCardItem {
  id: number
  createdAtText: string
  content: WdfDocument
  contentNodes: RichTextNode[]
  tags: string[]
  referenceId: MemoRefId | null
  referencePreview: MemoReferencePreview | null
  referencedByPreviews: MemoReferencePreview[]
  exiting: boolean
  renderRichText: boolean
}

export interface MemoRenderTombstoneItem {
  id: number
  tombstone: true
}

export type MemoRenderListItem = MemoCardItem | MemoRenderTombstoneItem

export interface MemoListProjection {
  memoCards: MemoCardItem[]
  memoNextCursor: string | null
  memoHasMore: boolean
  memoListInitialized: boolean
  memoListRefreshing: boolean
  memoListLoadingMore: boolean
  memoListInitialLoadFailed: boolean
  memoListLoadMoreFailed: boolean
}

const EMPTY_PROJECTION: MemoListProjection = {
  memoCards: [],
  memoNextCursor: null,
  memoHasMore: false,
  memoListInitialized: false,
  memoListRefreshing: false,
  memoListLoadingMore: false,
  memoListInitialLoadFailed: false,
  memoListLoadMoreFailed: false,
}

type CardCacheValue = {
  memo: Memo
  exiting: boolean
  richText: boolean
  referencePreviewKey: string
  card: MemoCardItem
}

export interface MemoListOnChangeHost {
  setData(patch: Record<string, unknown>): void
  updateEmptyState(): void
  _renderTransitionHoldActive?: boolean
  _filterTransitionPrevIds: Set<number> | null
  _filterTransitionActive: boolean
  _enteringCleanupTimer: number | null
}

interface MemoListPresentationOptions {
  getExitingMemoIds?: () => Set<number>
  getCachedMemoById?: (id: number) => Memo | undefined
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
  enteringCleanupMs?: number
  highlightKeyword?: string
}

interface BuildMemoCardItemOptions {
  exiting?: boolean
  richText?: boolean
  resolveMemoById?: (id: number) => Memo | undefined
}

function arraysShallowEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function isMemoRenderTombstone(item: MemoRenderListItem | undefined): item is MemoRenderTombstoneItem {
  return !!item && 'tombstone' in item && item.tombstone === true
}

function buildMemoRenderTombstone(id: number): MemoRenderTombstoneItem {
  return { id, tombstone: true }
}

function reconcileMemoRenderCards(
  currentRenderCards: MemoRenderListItem[] | null,
  nextMemoCards: MemoCardItem[],
): MemoRenderListItem[] {
  if (nextMemoCards.length === 0) return []
  if (!currentRenderCards || currentRenderCards.length === 0) {
    return nextMemoCards
  }

  let tombstoneCount = 0
  for (const item of currentRenderCards) {
    if (isMemoRenderTombstone(item)) tombstoneCount += 1
  }
  if (tombstoneCount === 0) {
    return nextMemoCards
  }

  const nextRenderCards: MemoRenderListItem[] = []
  const targetLength = nextMemoCards.length + tombstoneCount
  let memoIdx = 0

  for (let slot = 0; slot < targetLength; slot++) {
    const prevItem = currentRenderCards[slot]
    if (isMemoRenderTombstone(prevItem)) {
      nextRenderCards.push(prevItem)
      continue
    }
    const nextCard = nextMemoCards[memoIdx]
    if (!nextCard) break
    nextRenderCards.push(nextCard)
    memoIdx += 1
  }

  return arraysShallowEqual(currentRenderCards, nextRenderCards)
    ? currentRenderCards
    : nextRenderCards
}

function applySingleDeleteRenderTombstone(
  currentRenderCards: MemoRenderListItem[] | null,
  lastMemoCards: MemoCardItem[] | null,
  nextMemoCards: MemoCardItem[],
): MemoRenderListItem[] | null {
  if (!currentRenderCards || !lastMemoCards) return null
  const deleteIndex = findSingleDeleteIndex(lastMemoCards, nextMemoCards)
  if (deleteIndex === null) return null

  const deletedCard = lastMemoCards[deleteIndex]
  if (!deletedCard) return null

  const renderDeleteIndex = currentRenderCards.findIndex(
    (item) => !isMemoRenderTombstone(item) && item.id === deletedCard.id,
  )
  if (renderDeleteIndex < 0) return null

  const nextRenderCards = currentRenderCards.slice()
  nextRenderCards[renderDeleteIndex] = buildMemoRenderTombstone(deletedCard.id)
  return nextRenderCards
}

function isEntryUnavailableForRender(entry: MemoListEntry | undefined): boolean {
  return (
    !entry ||
    entry.status === 'idle' ||
    (entry.status === 'loading' && entry.pages.length === 0)
  )
}

export function summarizeMemoContent(content: WdfDocument): string {
  const oneLine = wdfDocumentToPlainText(content).replace(/\s+/g, ' ').trim()
  if (oneLine.length <= REFERENCE_SUMMARY_MAX_LENGTH) return oneLine
  return `${oneLine.slice(0, REFERENCE_SUMMARY_MAX_LENGTH)}...`
}

export function buildMemoReferenceFallbackText(id: MemoRefId): string {
  return `笔记${id}`
}

function toReferenceDateText(dateText: string): string {
  return dateText.trim().split(/\s+/)[0] ?? ''
}

export function buildMemoReferenceDisplayText(dateText: string, content: WdfDocument): string {
  const dateOnlyText = toReferenceDateText(dateText)
  const summary = summarizeMemoContent(content)
  if (!dateOnlyText && !summary) return ''
  if (!dateOnlyText) return summary
  if (!summary) return dateOnlyText
  return `${dateOnlyText}：${summary}`
}

function buildReferencePreview(
  id: MemoRefId,
  memo: Memo | undefined,
): MemoReferencePreview {
  const fallbackText = buildMemoReferenceFallbackText(id)
  if (!memo) return { id, displayText: fallbackText }

  const dateText = formatMemoTimestamp(memo.createdAt)
  const displayText = buildMemoReferenceDisplayText(dateText, memo.content)
  return { id, displayText: displayText || fallbackText }
}

function buildReferencePreviewKey(
  referencePreview: MemoReferencePreview | null,
  referencedByPreviews: MemoReferencePreview[],
): string {
  return JSON.stringify({
    referencePreview,
    referencedByPreviews,
  })
}

export function buildMemoCardItem(
  memo: Memo,
  options: BuildMemoCardItemOptions = {},
): MemoCardItem {
  const resolveMemoById = options.resolveMemoById ?? (() => undefined)
  const richText = options.richText ?? true
  const referenceId = memo.refs[0] ?? null
  const referenceOwnId = referenceId ? ownMemoIdFromRef(referenceId) : null
  const referencePreview =
    referenceId === null
      ? null
      : buildReferencePreview(
        referenceId,
        referenceOwnId === null ? undefined : resolveMemoById(referenceOwnId),
      )
  const referencedByPreviews = memo.referencedBy.map((id) => {
    const ownId = ownMemoIdFromRef(id)
    return buildReferencePreview(
      id,
      ownId === null ? undefined : resolveMemoById(ownId),
    )
  })

  const contentNodes = richText ? renderWdfToNodes(memo.content) : []

  return {
    id: memo.id,
    createdAtText: formatMemoTimestamp(memo.createdAt),
    content: memo.content,
    contentNodes,
    tags: tagsForMemoCardDisplay(memo.tags),
    referenceId,
    referencePreview,
    referencedByPreviews,
    exiting: options.exiting ?? false,
    renderRichText: richText,
  }
}

export function createListProjector(
  options: Pick<
    MemoListPresentationOptions,
    'getCachedMemoById' | 'getExitingMemoIds' | 'highlightKeyword'
  > = {},
): (entry: MemoListEntry | undefined) => MemoListProjection {
  const getExitingMemoIds =
    options.getExitingMemoIds ?? (() => workspaceStore.getState().exitingMemoIds)
  const getCachedMemoById =
    options.getCachedMemoById ??
    ((id: number) => workspaceStore.getState().memos.detail.get(id)?.memo)
  const cache = new Map<number, CardCacheValue>()
  let lastCards: MemoCardItem[] | null = null

  function projectCard(
    memo: Memo,
    exiting: boolean,
    richText: boolean,
    resolveMemoById: (id: number) => Memo | undefined,
  ): MemoCardItem {
    const referenceId = memo.refs[0] ?? null
    const referenceOwnId = referenceId ? ownMemoIdFromRef(referenceId) : null
    const referencePreview =
      referenceId === null
        ? null
        : buildReferencePreview(
          referenceId,
          referenceOwnId === null ? undefined : resolveMemoById(referenceOwnId),
        )
    const referencedByPreviews = memo.referencedBy.map((id) => {
      const ownId = ownMemoIdFromRef(id)
      return buildReferencePreview(
        id,
        ownId === null ? undefined : resolveMemoById(ownId),
      )
    })
    const referencePreviewKey = buildReferencePreviewKey(referencePreview, referencedByPreviews)
    const cached = cache.get(memo.id)
    if (
      cached &&
      cached.memo === memo &&
      cached.exiting === exiting &&
      cached.richText === richText &&
      cached.referencePreviewKey === referencePreviewKey
    ) {
      return cached.card
    }
    const card = buildMemoCardItem(memo, {
      exiting,
      richText,
      resolveMemoById,
    })
    if (options.highlightKeyword && card.contentNodes.length > 0) {
      card.contentNodes = applyMemoParagraphSpacingForHighlight(
        highlightMemoNodes(card.contentNodes, options.highlightKeyword),
      )
    }
    cache.set(memo.id, { memo, exiting, richText, referencePreviewKey, card })
    return card
  }

  return function project(entry: MemoListEntry | undefined): MemoListProjection {
    if (!entry) {
      cache.clear()
      lastCards = null
      return EMPTY_PROJECTION
    }

    const exitingIds = getExitingMemoIds()
    const items = entry.pages.flatMap((page) => page.items)
    const pageMemosById = new Map(items.map((memo) => [memo.id, memo]))
    const resolveMemoById = (id: number) => pageMemosById.get(id) ?? getCachedMemoById(id)
    const visibleIds = new Set<number>()
    // 搜索高亮依赖 rich-text 段落块结构；超过阈值退回 plain text 会丢失高亮与段落间距。
    const useThreshold = !options.highlightKeyword && items.length > RICH_TEXT_THRESHOLD
    const memoCards = items.map((memo, index) => {
      visibleIds.add(memo.id)
      const richText = !useThreshold || index < RICH_TEXT_THRESHOLD
      return projectCard(memo, exitingIds.has(memo.id), richText, resolveMemoById)
    })

    for (const id of cache.keys()) {
      if (!visibleIds.has(id)) cache.delete(id)
    }

    const stableCards =
      lastCards && arraysShallowEqual(lastCards, memoCards) ? lastCards : memoCards
    lastCards = stableCards

    const last = entry.pages[entry.pages.length - 1]
    return {
      memoCards: stableCards,
      memoNextCursor: last?.nextCursor ?? null,
      memoHasMore: last?.hasMore ?? false,
      memoListInitialized:
        (entry.status !== 'idle' && entry.status !== 'loading') || items.length > 0,
      memoListRefreshing: entry.status === 'loading',
      memoListLoadingMore: entry.isLoadingMore,
      memoListInitialLoadFailed: entry.status === 'error' && items.length === 0,
      memoListLoadMoreFailed: !!entry.loadMoreError,
    }
  }
}

/**
 * 把 store entry → projection → setData 的整段 binding 回调包成 closure：
 * - 持有 createListProjector cache（item 引用稳定化，Task 2）
 * - 持有 lastProjection（字段级 diff，Task 3）
 * - 用 buildMemoCardsPatch 把 memoCards 差异编译成"字段路径 append"或"整数组替换"
 *   （Task 5：避免 list-view 整数组替换 layout pass，从源头消除 loadMore 抖动）
 * - 标签过渡期：entry 无数据则跳过 setData（保留旧卡片），entry 有数据时 diff
 *   计算 enteringCardMap 触发新卡片入场动画
 */
export function makeMemoListOnChange(
  host: MemoListOnChangeHost,
  options: MemoListPresentationOptions = {},
): (entry: MemoListEntry | undefined) => void {
  const project = createListProjector(options)
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout
  const enteringCleanupMs = options.enteringCleanupMs ?? MEMO_CARD_ENTERING_CLEANUP_MS
  let lastProjection: MemoListProjection | null = null
  let lastRenderCards: MemoRenderListItem[] | null = null

  return (entry) => {
    const renderHoldActive = host._renderTransitionHoldActive === true
    const filterTransitionActive = host._filterTransitionActive === true

    if (renderHoldActive || filterTransitionActive) {
      if (isEntryUnavailableForRender(entry)) return
      if (renderHoldActive) {
        host._renderTransitionHoldActive = false
      }
      if (filterTransitionActive) {
        host._filterTransitionActive = false
      }
    }

    const next = project(entry)
    const deleteTombstonedRenderCards = applySingleDeleteRenderTombstone(
      lastRenderCards,
      lastProjection?.memoCards ?? null,
      next.memoCards,
    )
    const nextRenderCards = reconcileMemoRenderCards(
      deleteTombstonedRenderCards ?? lastRenderCards,
      next.memoCards,
    )
    const patch: Record<string, unknown> = {
      ...buildMemoCardsPatch(lastProjection?.memoCards ?? null, next.memoCards),
      ...buildArrayFieldPatch('memoRenderCards', lastRenderCards, nextRenderCards),
    }

    if (!lastProjection || lastProjection.memoNextCursor !== next.memoNextCursor) {
      patch.memoNextCursor = next.memoNextCursor
    }
    if (!lastProjection || lastProjection.memoHasMore !== next.memoHasMore) {
      patch.memoHasMore = next.memoHasMore
    }
    if (!lastProjection || lastProjection.memoListInitialized !== next.memoListInitialized) {
      patch.memoListInitialized = next.memoListInitialized
    }
    if (!lastProjection || lastProjection.memoListRefreshing !== next.memoListRefreshing) {
      patch.memoListRefreshing = next.memoListRefreshing
    }
    if (!lastProjection || lastProjection.memoListLoadingMore !== next.memoListLoadingMore) {
      patch.memoListLoadingMore = next.memoListLoadingMore
    }
    if (
      !lastProjection ||
      lastProjection.memoListInitialLoadFailed !== next.memoListInitialLoadFailed
    ) {
      patch.memoListInitialLoadFailed = next.memoListInitialLoadFailed
    }
    if (!lastProjection || lastProjection.memoListLoadMoreFailed !== next.memoListLoadMoreFailed) {
      patch.memoListLoadMoreFailed = next.memoListLoadMoreFailed
    }

    const prevIds = host._filterTransitionPrevIds
    if (prevIds && next.memoCards.length > 0) {
      host._filterTransitionPrevIds = null
      const enteringIds = computeEnteringCardIds(prevIds, next.memoCards)
      const enteringMap = buildEnteringCardMap(enteringIds)
      if (enteringMap) {
        patch.enteringCardMap = enteringMap
        if (host._enteringCleanupTimer != null) {
          clearTimeoutImpl(host._enteringCleanupTimer as unknown as ReturnType<typeof setTimeout>)
        }
        host._enteringCleanupTimer = setTimeoutImpl(() => {
          host.setData({ enteringCardMap: null })
          host._enteringCleanupTimer = null
        }, enteringCleanupMs) as unknown as number
      }
    } else if (prevIds) {
      host._filterTransitionPrevIds = null
    }

    lastProjection = next
    lastRenderCards = nextRenderCards
    host.setData(patch)
    host.updateEmptyState()
  }
}
