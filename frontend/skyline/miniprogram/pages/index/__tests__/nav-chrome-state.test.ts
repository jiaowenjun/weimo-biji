import { describe, expect, it } from 'vitest'
import {
  deriveIndexNavChromeState,
  INDEX_NAV_CHROME_DELTA_THRESHOLD,
  INDEX_NAV_CHROME_ENTER_SCROLL_TOP,
  INDEX_NAV_CHROME_TOP_EPS,
} from '../nav-chrome-state'

describe('deriveIndexNavChromeState', () => {
  it('uses the tuned threshold set for a more responsive home-page chrome', () => {
    expect(INDEX_NAV_CHROME_TOP_EPS).toBe(8)
    expect(INDEX_NAV_CHROME_ENTER_SCROLL_TOP).toBe(16)
    expect(INDEX_NAV_CHROME_DELTA_THRESHOLD).toBe(2)
  })

  it('forces opaque when returning to the top band', () => {
    expect(
      deriveIndexNavChromeState({
        scrollTop: INDEX_NAV_CHROME_TOP_EPS,
        previousScrollTop: 24,
        isTransparent: true,
      }),
    ).toBe(false)
  })

  it('turns transparent after a smaller but still meaningful downward scroll past the enter threshold', () => {
    expect(
      deriveIndexNavChromeState({
        scrollTop: INDEX_NAV_CHROME_ENTER_SCROLL_TOP + 1,
        previousScrollTop:
          INDEX_NAV_CHROME_ENTER_SCROLL_TOP - INDEX_NAV_CHROME_DELTA_THRESHOLD - 1,
        isTransparent: false,
      }),
    ).toBe(true)
  })

  it('turns opaque again on meaningful upward scroll', () => {
    expect(
      deriveIndexNavChromeState({
        scrollTop: 40,
        previousScrollTop: 43,
        isTransparent: true,
      }),
    ).toBe(false)
  })

  it('does not flap on tiny deltas inside the list body', () => {
    expect(
      deriveIndexNavChromeState({
        scrollTop: 30,
        previousScrollTop: 29,
        isTransparent: false,
      }),
    ).toBe(false)

    expect(
      deriveIndexNavChromeState({
        scrollTop: 30,
        previousScrollTop: 31,
        isTransparent: true,
      }),
    ).toBe(true)
  })
})
