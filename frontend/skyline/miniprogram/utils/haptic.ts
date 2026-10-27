/**
 * 触觉与触摸反馈工具。
 *
 * 基于 wx.vibrateShort（基础库 ≥ 2.13.0）封装，用于在 Skyline 增强交互场景下
 * 为按钮点击、关键操作提供触觉反馈，与 hover 视觉反馈协同呈现原生般的体感。
 *
 * 设计要点：
 *   - 静默失败：低基础库、不支持的设备或用户关闭系统震动时不抛错、不打扰主流程
 *   - fire-and-forget：调用方无需 await，不阻塞业务逻辑
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy'

export const TOUCH_LIFT_DELAY_MS = 100
export const TOUCH_LIFT_CANCEL_DISTANCE = 5

interface TouchLiftPoint {
  clientX: number
  clientY: number
}

export interface TouchLiftSession {
  startX: number
  startY: number
}

export function hapticTap(type: HapticIntensity = 'light'): void {
  try {
    wx.vibrateShort({ type, fail: () => {} })
  } catch {
    // 老基础库或不支持 vibrateShort 的环境，直接忽略
  }
}

export function createTouchLiftSession(touch: TouchLiftPoint): TouchLiftSession {
  return {
    startX: touch.clientX,
    startY: touch.clientY,
  }
}

export function shouldCancelTouchLift(
  session: TouchLiftSession,
  touch: TouchLiftPoint,
  cancelDistance = TOUCH_LIFT_CANCEL_DISTANCE,
): boolean {
  return (
    Math.abs(touch.clientX - session.startX) > cancelDistance ||
    Math.abs(touch.clientY - session.startY) > cancelDistance
  )
}

export function clearTouchLiftTimer(
  timer: number | null | undefined,
  clearTimer: (timer: number) => void = clearTimeout,
): null {
  if (timer != null) {
    clearTimer(timer)
  }
  return null
}
