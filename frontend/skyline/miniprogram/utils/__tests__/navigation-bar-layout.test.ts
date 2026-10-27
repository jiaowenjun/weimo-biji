import { describe, expect, it } from 'vitest'
import {
  computeCompactNavigationBarLayout,
  computeStandardNavigationBarLayout,
} from '../navigation-bar-layout'

describe('computeStandardNavigationBarLayout', () => {
  it('uses the regular-page breathing-space formula that navigation-bar currently relies on', () => {
    const layout = computeStandardNavigationBarLayout(
      { windowWidth: 390, statusBarHeight: 47 },
      { top: 59, left: 312, height: 32 },
    )

    expect(layout.safeTop).toBe(51)
    expect(layout.innerHeight).toBe(99)
    expect(layout.overlayHeight).toBe(99)
  })

  it('keeps left slot width and right inset symmetric to the capsule', () => {
    const layout = computeStandardNavigationBarLayout(
      { windowWidth: 430, statusBarHeight: 47 },
      { top: 59, left: 344, height: 32 },
    )

    expect(layout.leftWidth).toBe(86)
    expect(layout.innerPaddingRight).toBe(86)
  })
})

describe('computeCompactNavigationBarLayout', () => {
  it('matches the compact navigation-bar height formula used by modal compact pages', () => {
    const layout = computeCompactNavigationBarLayout({ height: 32 })

    expect(layout.safeTop).toBe(4)
    expect(layout.innerHeight).toBe(48)
    expect(layout.overlayHeight).toBe(48)
  })
})
