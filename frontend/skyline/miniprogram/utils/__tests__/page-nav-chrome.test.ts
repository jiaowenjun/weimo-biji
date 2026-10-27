import { describe, expect, it } from 'vitest'
import {
  PAGE_NAV_CHROME_DELTA_THRESHOLD,
  PAGE_NAV_CHROME_ENTER_SCROLL_TOP,
  PAGE_NAV_CHROME_TOP_EPS,
  derivePageNavChromeTransparent,
  resolvePageNavChromeMetrics,
} from '../page-nav-chrome'

describe('page-nav-chrome util', () => {
  it('exports the tuned shared threshold set', () => {
    expect(PAGE_NAV_CHROME_TOP_EPS).toBe(8)
    expect(PAGE_NAV_CHROME_ENTER_SCROLL_TOP).toBe(16)
    expect(PAGE_NAV_CHROME_DELTA_THRESHOLD).toBe(2)
  })

  it('forces opaque inside the top band', () => {
    expect(
      derivePageNavChromeTransparent({
        scrollTop: PAGE_NAV_CHROME_TOP_EPS,
        previousScrollTop: 24,
        isTransparent: true,
      }),
    ).toBe(false)
  })

  it('turns transparent after a meaningful downward scroll past the enter threshold', () => {
    expect(
      derivePageNavChromeTransparent({
        scrollTop: PAGE_NAV_CHROME_ENTER_SCROLL_TOP + 1,
        previousScrollTop:
          PAGE_NAV_CHROME_ENTER_SCROLL_TOP - PAGE_NAV_CHROME_DELTA_THRESHOLD - 1,
        isTransparent: false,
      }),
    ).toBe(true)
  })

  it('returns opaque on meaningful upward scroll', () => {
    expect(
      derivePageNavChromeTransparent({
        scrollTop: 40,
        previousScrollTop: 43,
        isTransparent: true,
      }),
    ).toBe(false)
  })

  it('reuses the standard navigation-bar layout and derives a status-mask height', () => {
    expect(
      resolvePageNavChromeMetrics(
        {
          windowWidth: 393,
          statusBarHeight: 54,
        },
        {
          top: 60,
          left: 320,
          height: 32,
        },
      ),
    ).toEqual({
      overlayHeight: 100,
      statusMaskHeight: 54,
    })
  })
})
