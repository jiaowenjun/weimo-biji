import { describe, expect, it } from 'vitest'
import {
  computeRelationPanelLayoutMetrics,
  computeRelationGestureFillHeightPx,
  resolveRelationSwipeTarget,
  shouldAcceptRelationSwipeGesture,
} from '../relation-swipe-gesture'

describe('relation-swipe-gesture', () => {
  describe('computeRelationPanelLayoutMetrics', () => {
    it('uses full window width for panel stride after panel bleed', () => {
      const windowWidth = 390
      const metrics = computeRelationPanelLayoutMetrics(windowWidth)
      const gapPx = windowWidth / 750 * 52

      expect(metrics.panelWidthPx).toBe(windowWidth)
      expect(metrics.gapPx).toBe(gapPx)
      expect(metrics.stridePx).toBe(windowWidth + gapPx)
    })

    it('computes gesture fill height from panels bottom to toolbar top', () => {
      expect(computeRelationGestureFillHeightPx(420, 560)).toBe(140)
      expect(computeRelationGestureFillHeightPx(560, 420)).toBe(0)
      expect(computeRelationGestureFillHeightPx(Number.NaN, 560)).toBe(0)
    })
  })

  describe('shouldAcceptRelationSwipeGesture', () => {
    it('rejects disabled gestures', () => {
      expect(shouldAcceptRelationSwipeGesture({
        enabled: false,
        selectedRelationTab: 'reference',
        translationX: -24,
        translationY: 2,
      })).toBe(false)
    })

    it('rejects mostly vertical drags', () => {
      expect(shouldAcceptRelationSwipeGesture({
        enabled: true,
        selectedRelationTab: 'reference',
        translationX: -24,
        translationY: 36,
      })).toBe(false)
    })

    it('accepts left swipe from reference tab only', () => {
      expect(shouldAcceptRelationSwipeGesture({
        enabled: true,
        selectedRelationTab: 'reference',
        translationX: -24,
        translationY: 4,
      })).toBe(true)
      expect(shouldAcceptRelationSwipeGesture({
        enabled: true,
        selectedRelationTab: 'reference',
        translationX: 24,
        translationY: 4,
      })).toBe(false)
    })

    it('accepts right swipe from referencedBy tab only', () => {
      expect(shouldAcceptRelationSwipeGesture({
        enabled: true,
        selectedRelationTab: 'referencedBy',
        translationX: 24,
        translationY: 4,
      })).toBe(true)
      expect(shouldAcceptRelationSwipeGesture({
        enabled: true,
        selectedRelationTab: 'referencedBy',
        translationX: -24,
        translationY: 4,
      })).toBe(false)
    })
  })

  describe('resolveRelationSwipeTarget', () => {
    it('resolves referencedBy when progress crosses threshold', () => {
      expect(resolveRelationSwipeTarget({ progress: 0.6, velocityX: 0 })).toBe(1)
    })

    it('resolves reference when progress stays below threshold', () => {
      expect(resolveRelationSwipeTarget({ progress: 0.4, velocityX: 0 })).toBe(0)
    })

    it('resolves by fling velocity', () => {
      expect(resolveRelationSwipeTarget({ progress: 0.2, velocityX: -900 })).toBe(1)
      expect(resolveRelationSwipeTarget({ progress: 0.8, velocityX: 900 })).toBe(0)
    })

    it('keeps strict boundary behavior at exact thresholds', () => {
      expect(resolveRelationSwipeTarget({ progress: 0.5, velocityX: 800 })).toBe(0)
      expect(resolveRelationSwipeTarget({ progress: 0.5, velocityX: -800 })).toBe(0)
    })
  })
})
