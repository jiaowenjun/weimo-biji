import { describe, expect, it, vi } from 'vitest'
import {
  clearTouchLiftTimer,
  createTouchLiftSession,
  shouldCancelTouchLift,
  TOUCH_LIFT_CANCEL_DISTANCE,
  TOUCH_LIFT_DELAY_MS,
} from '../haptic'

describe('touch-lift helper', () => {
  it('exports the shared lift timing constants', () => {
    expect(TOUCH_LIFT_DELAY_MS).toBe(100)
    expect(TOUCH_LIFT_CANCEL_DISTANCE).toBe(5)
  })

  it('captures the touch start point without keeping component context', () => {
    expect(createTouchLiftSession({ clientX: 12, clientY: 34 })).toEqual({
      startX: 12,
      startY: 34,
    })
  })

  it('cancels when either axis moves beyond the threshold', () => {
    const session = createTouchLiftSession({ clientX: 10, clientY: 20 })

    expect(shouldCancelTouchLift(session, { clientX: 15, clientY: 20 })).toBe(false)
    expect(shouldCancelTouchLift(session, { clientX: 16, clientY: 20 })).toBe(true)
    expect(shouldCancelTouchLift(session, { clientX: 10, clientY: 26 })).toBe(true)
  })

  it('supports a custom cancel threshold for future callers', () => {
    const session = createTouchLiftSession({ clientX: 10, clientY: 20 })

    expect(shouldCancelTouchLift(session, { clientX: 18, clientY: 20 }, 8)).toBe(false)
    expect(shouldCancelTouchLift(session, { clientX: 19, clientY: 20 }, 8)).toBe(true)
  })

  it('clears an active timer and returns null for storage reset', () => {
    const clearTimer = vi.fn()

    expect(clearTouchLiftTimer(7, clearTimer)).toBeNull()
    expect(clearTimer).toHaveBeenCalledWith(7)
  })

  it('does not clear when timer is already empty', () => {
    const clearTimer = vi.fn()

    expect(clearTouchLiftTimer(null, clearTimer)).toBeNull()
    expect(clearTimer).not.toHaveBeenCalled()
  })
})
