import type { MemoQueryDraft } from '../../models/memo'
import {
  formatMemoQueryDateLabel,
  hasActiveMemoQuery,
  isSameMemoQueryDraft,
  normalizeMemoQueryDraft,
} from '../../utils/memo-query'

export interface SearchPageViewState {
  dateLabel: string
  hasActiveQuery: boolean
  canApply: boolean
  shouldSearch: boolean
}

export function shouldSearchFromDraft(draft: MemoQueryDraft): boolean {
  return Boolean(normalizeMemoQueryDraft(draft).keyword)
}

export interface SearchPageRenderTransitionArgs {
  currentDraft: MemoQueryDraft
  nextDraft: MemoQueryDraft
  memoListInitialized: boolean
}

export function shouldHoldSearchRenderTransition(
  args: SearchPageRenderTransitionArgs,
): boolean {
  if (!args.memoListInitialized) return false

  return (
    shouldSearchFromDraft(args.currentDraft) &&
    shouldSearchFromDraft(args.nextDraft)
  )
}

export function deriveSearchPageViewState(
  draft: MemoQueryDraft,
  initialDraft: MemoQueryDraft,
): SearchPageViewState {
  const normalizedDraft = normalizeMemoQueryDraft(draft)
  const normalizedInitial = normalizeMemoQueryDraft(initialDraft)

  return {
    dateLabel: formatMemoQueryDateLabel(normalizedDraft),
    hasActiveQuery: hasActiveMemoQuery(normalizedDraft),
    canApply: !isSameMemoQueryDraft(normalizedDraft, normalizedInitial),
    shouldSearch: shouldSearchFromDraft(normalizedDraft),
  }
}
