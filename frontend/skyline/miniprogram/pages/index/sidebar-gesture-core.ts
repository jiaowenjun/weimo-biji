const SIDEBAR_PROGRESS_BLOCK_EPS = 0.001
const SIDEBAR_GESTURE_X_THRESHOLD = 8
const SIDEBAR_OPEN_PROGRESS_THRESHOLD = 0.5
const SIDEBAR_OPEN_VELOCITY_THRESHOLD = 800

export interface SidebarGestureAcceptanceInput {
  enabled: boolean
  progress: number
  translationX: number
  translationY: number
}

export interface SidebarGestureTargetInput {
  progress: number
  velocityX: number
}

export type SidebarTarget = 0 | 1

export function shouldAcceptSidebarGesture(
  input: SidebarGestureAcceptanceInput,
): boolean {
  'worklet'
  if (!input.enabled) {
    return false
  }
  if (input.progress > SIDEBAR_PROGRESS_BLOCK_EPS) {
    return false
  }
  return (
    input.translationX > SIDEBAR_GESTURE_X_THRESHOLD &&
    Math.abs(input.translationX) > Math.abs(input.translationY)
  )
}

export function resolveSidebarTarget(input: SidebarGestureTargetInput): SidebarTarget {
  'worklet'
  return input.progress > SIDEBAR_OPEN_PROGRESS_THRESHOLD ||
    input.velocityX > SIDEBAR_OPEN_VELOCITY_THRESHOLD
    ? 1
    : 0
}
