import type { RelationTabKey } from '../../utils/memo-reference-relation-tab'

/** 与 tokens.wxss 中 --memo-layout-gutter / --spacing-md 保持一致 */
export const MEMO_LIST_GUTTER_RPX = 26

/** 2 × 26rpx，与 tokens.wxss 中 --memo-reference-relation-panel-gap 保持一致 */
export const RELATION_PANEL_GAP_RPX = 52

export function rpxToPx(rpx: number, windowWidth: number): number {
  return windowWidth / 750 * rpx
}

/** panel bleed 后视口对齐屏幕全宽 */
export function computeRelationPanelLayoutMetrics(windowWidth: number) {
  const panelWidthPx = windowWidth
  const gapPx = rpxToPx(RELATION_PANEL_GAP_RPX, windowWidth)
  return {
    panelWidthPx,
    gapPx,
    stridePx: panelWidthPx + gapPx,
  }
}

/** panels 下沿到 toolbar 上沿的 px 间距，用于扩大横向滑动手势热区 */
export function computeRelationGestureFillHeightPx(panelsBottom: number, toolbarTop: number): number {
  if (!Number.isFinite(panelsBottom) || !Number.isFinite(toolbarTop)) return 0
  return Math.max(0, Math.round(toolbarTop - panelsBottom))
}

export const RELATION_SWIPE_X_THRESHOLD = 8
export const RELATION_SWIPE_TARGET_THRESHOLD = 0.5
export const RELATION_SWIPE_VELOCITY_THRESHOLD = 800
export const RELATION_SWIPE_NO_OP_PROGRESS_EPS = 0.01

export type RelationSwipeTarget = 0 | 1

export interface RelationSwipeAcceptanceInput {
  enabled: boolean
  selectedRelationTab: RelationTabKey
  translationX: number
  translationY: number
}

export interface RelationSwipeTargetInput {
  progress: number
  velocityX: number
}

export function shouldAcceptRelationSwipeGesture(input: RelationSwipeAcceptanceInput): boolean {
  'worklet'
  if (!input.enabled) return false
  if (Math.abs(input.translationX) <= Math.abs(input.translationY)) return false

  if (input.selectedRelationTab === 'reference') {
    return input.translationX < -RELATION_SWIPE_X_THRESHOLD
  }
  return input.translationX > RELATION_SWIPE_X_THRESHOLD
}

export function resolveRelationSwipeTarget(input: RelationSwipeTargetInput): RelationSwipeTarget {
  'worklet'
  if (input.velocityX < -RELATION_SWIPE_VELOCITY_THRESHOLD) return 1
  if (input.velocityX > RELATION_SWIPE_VELOCITY_THRESHOLD) return 0
  return input.progress > RELATION_SWIPE_TARGET_THRESHOLD ? 1 : 0
}
