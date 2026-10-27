export interface TriggerRect {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export interface FixedLayerRect {
  top: number
  left: number
  width: number
  height: number
}

export type PopoverPlacement = 'down' | 'up'
export type PopoverPlacementPriority = 'down-first' | 'up-first'
export type PopoverHorizontalAlign = 'end' | 'center' | 'start'

export interface ComputePopoverPlacementInput {
  rect: TriggerRect
  windowWidth: number
  windowHeight: number
  safeAreaTop?: number
  safeAreaBottom?: number
  gap: number
  estimatedHeight: number
  estimatedWidth?: number
  margin: number
  placementPriority?: PopoverPlacementPriority | string | null
  horizontalAlign?: PopoverHorizontalAlign | string | null
  fixedLayerRect?: FixedLayerRect | null
}

export interface ComputePopoverPlacementResult {
  placement: PopoverPlacement
  style: string
}

export const DEFAULT_POPOVER_PLACEMENT_PRIORITY: PopoverPlacementPriority = 'down-first'
const DEFAULT_POPOVER_HORIZONTAL_ALIGN: PopoverHorizontalAlign = 'end'
const DEFAULT_POPOVER_MIN_WIDTH_RPX = 220

function normalizePlacementPriority(
  placementPriority: ComputePopoverPlacementInput['placementPriority'],
): PopoverPlacementPriority {
  return placementPriority === 'up-first'
    ? 'up-first'
    : DEFAULT_POPOVER_PLACEMENT_PRIORITY
}

function normalizeHorizontalAlign(
  horizontalAlign: ComputePopoverPlacementInput['horizontalAlign'],
): PopoverHorizontalAlign {
  if (horizontalAlign === 'center') return 'center'
  if (horizontalAlign === 'start') return 'start'
  return DEFAULT_POPOVER_HORIZONTAL_ALIGN
}

function resolveEstimatedWidth(input: ComputePopoverPlacementInput): number {
  if (typeof input.estimatedWidth === 'number' && input.estimatedWidth > 0) {
    return input.estimatedWidth
  }
  return input.windowWidth * DEFAULT_POPOVER_MIN_WIDTH_RPX / 750
}

function computeHorizontalStyle(
  input: ComputePopoverPlacementInput,
  margin: number,
): string {
  const horizontalAlign = normalizeHorizontalAlign(input.horizontalAlign)
  if (horizontalAlign === 'end') {
    const right = Math.max(margin, input.windowWidth - input.rect.right)
    return `right: ${right}px;`
  }

  const estimatedWidth = resolveEstimatedWidth(input)

  if (horizontalAlign === 'start') {
    const maxLeft = Math.max(margin, input.windowWidth - margin - estimatedWidth)
    const left = clamp(input.rect.left, margin, maxLeft)
    return `left: ${left}px;`
  }

  const centeredLeft = input.rect.left + input.rect.width / 2 - estimatedWidth / 2
  const maxLeft = Math.max(margin, input.windowWidth - margin - estimatedWidth)
  const left = Math.min(Math.max(margin, centeredLeft), maxLeft)
  return `left: ${left}px;`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max)
}

function normalizeTriggerRectForFixedLayer(
  rect: TriggerRect,
  fixedLayerRect: FixedLayerRect,
): TriggerRect {
  return {
    top: rect.top - fixedLayerRect.top,
    right: rect.right - fixedLayerRect.left,
    bottom: rect.bottom - fixedLayerRect.top,
    left: rect.left - fixedLayerRect.left,
    width: rect.width,
    height: rect.height,
  }
}

function resolvePositioningGeometry(input: ComputePopoverPlacementInput) {
  const rawSafeAreaTop = typeof input.safeAreaTop === 'number' ? input.safeAreaTop : 0
  const rawSafeAreaBottom = typeof input.safeAreaBottom === 'number'
    ? input.safeAreaBottom
    : input.windowHeight
  const fixedLayerRect = input.fixedLayerRect

  if (
    !fixedLayerRect
    || typeof fixedLayerRect.top !== 'number'
    || typeof fixedLayerRect.left !== 'number'
    || typeof fixedLayerRect.width !== 'number'
    || typeof fixedLayerRect.height !== 'number'
    || fixedLayerRect.width <= 0
    || fixedLayerRect.height <= 0
  ) {
    return {
      rect: input.rect,
      windowWidth: input.windowWidth,
      windowHeight: input.windowHeight,
      safeAreaTop: rawSafeAreaTop,
      safeAreaBottom: rawSafeAreaBottom,
    }
  }

  const windowWidth = fixedLayerRect.width
  const windowHeight = fixedLayerRect.height
  return {
    rect: normalizeTriggerRectForFixedLayer(input.rect, fixedLayerRect),
    windowWidth,
    windowHeight,
    safeAreaTop: clamp(rawSafeAreaTop - fixedLayerRect.top, 0, windowHeight),
    safeAreaBottom: clamp(rawSafeAreaBottom - fixedLayerRect.top, 0, windowHeight),
  }
}

export function computePopoverPlacement(
  input: ComputePopoverPlacementInput,
): ComputePopoverPlacementResult {
  const geometry = resolvePositioningGeometry(input)
  const normalizedInput: ComputePopoverPlacementInput = {
    ...input,
    rect: geometry.rect,
    windowWidth: geometry.windowWidth,
    windowHeight: geometry.windowHeight,
    safeAreaTop: geometry.safeAreaTop,
    safeAreaBottom: geometry.safeAreaBottom,
  }
  const {
    rect,
    windowHeight,
    gap,
    estimatedHeight,
    margin,
  } = normalizedInput

  const safeAreaTop = geometry.safeAreaTop
  const safeAreaBottom = geometry.safeAreaBottom
  const placementPriority = normalizePlacementPriority(normalizedInput.placementPriority)
  const horizontalStyle = computeHorizontalStyle(normalizedInput, margin)
  const downTop = rect.bottom + gap
  const fitsBelow = downTop + estimatedHeight <= safeAreaBottom - margin

  const upTop = rect.top - gap - estimatedHeight
  const fitsAbove = upTop >= safeAreaTop + margin

  let placement: PopoverPlacement
  if (placementPriority === 'up-first') {
    placement = fitsAbove ? 'up' : 'down'
  } else {
    placement = fitsBelow ? 'down' : 'up'
  }

  if (placement === 'down') {
    return {
      placement,
      style: `top: ${downTop}px; ${horizontalStyle}`,
    }
  }

  const bottomOffset = Math.max(margin, windowHeight - rect.top + gap)
  return {
    placement,
    style: `bottom: ${bottomOffset}px; ${horizontalStyle}`,
  }
}
