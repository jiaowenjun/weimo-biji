import { describe, expect, it } from 'vitest'
import {
  resolveSidebarTarget,
  shouldAcceptSidebarGesture,
} from '../sidebar-gesture-core'

describe('sidebar-gesture-core', () => {
  describe('shouldAcceptSidebarGesture', () => {
    it('rejects mostly vertical drags', () => {
      expect(
        shouldAcceptSidebarGesture({
          enabled: true,
          progress: 0,
          translationX: 24,
          translationY: 36,
        }),
      ).toBe(false)
    })

    it('rejects when the page gesture gate is disabled', () => {
      expect(
        shouldAcceptSidebarGesture({
          enabled: false,
          progress: 0,
          translationX: 24,
          translationY: 8,
        }),
      ).toBe(false)
    })

    it('rejects when sidebar progress already indicates open or opening', () => {
      expect(
        shouldAcceptSidebarGesture({
          enabled: true,
          progress: 0.01,
          translationX: 24,
          translationY: 8,
        }),
      ).toBe(false)
    })

    it('accepts a rightward predominantly horizontal drag when idle', () => {
      expect(
        shouldAcceptSidebarGesture({
          enabled: true,
          progress: 0,
          translationX: 24,
          translationY: 8,
        }),
      ).toBe(true)
    })
  })

  describe('resolveSidebarTarget', () => {
    it('resolves open when progress has crossed the open threshold', () => {
      expect(
        resolveSidebarTarget({
          progress: 0.6,
          velocityX: 0,
        }),
      ).toBe(1)
    })

    it('resolves open when velocity crosses the fling threshold', () => {
      expect(
        resolveSidebarTarget({
          progress: 0.2,
          velocityX: 900,
        }),
      ).toBe(1)
    })

    it('resolves close when neither progress nor velocity crosses the threshold', () => {
      expect(
        resolveSidebarTarget({
          progress: 0.2,
          velocityX: 200,
        }),
      ).toBe(0)
    })

    it('keeps the strict boundary behavior at the exact thresholds', () => {
      expect(
        resolveSidebarTarget({
          progress: 0.5,
          velocityX: 800,
        }),
      ).toBe(0)
    })
  })
})
