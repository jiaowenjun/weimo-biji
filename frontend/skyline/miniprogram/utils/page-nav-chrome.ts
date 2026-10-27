import {
  computeStandardNavigationBarLayout,
  type NavigationBarMenuButtonRectLike,
  type NavigationBarWindowInfoLike,
} from './navigation-bar-layout'

export const PAGE_NAV_CHROME_TOP_EPS = 8
export const PAGE_NAV_CHROME_ENTER_SCROLL_TOP = 16
export const PAGE_NAV_CHROME_DELTA_THRESHOLD = 2

export interface PageNavChromeStateInput {
  scrollTop: number
  previousScrollTop: number
  isTransparent: boolean
}

export interface PageNavChromeMetrics {
  overlayHeight: number
  statusMaskHeight: number
}

export function derivePageNavChromeTransparent(
  input: PageNavChromeStateInput,
): boolean {
  const { scrollTop, previousScrollTop, isTransparent } = input

  if (scrollTop <= PAGE_NAV_CHROME_TOP_EPS) {
    return false
  }

  const delta = scrollTop - previousScrollTop

  if (
    scrollTop > PAGE_NAV_CHROME_ENTER_SCROLL_TOP &&
    delta > PAGE_NAV_CHROME_DELTA_THRESHOLD
  ) {
    return true
  }

  if (delta < -PAGE_NAV_CHROME_DELTA_THRESHOLD) {
    return false
  }

  return isTransparent
}

export function resolvePageNavChromeMetrics(
  windowInfo: NavigationBarWindowInfoLike,
  rect: NavigationBarMenuButtonRectLike,
): PageNavChromeMetrics {
  const layout = computeStandardNavigationBarLayout(windowInfo, rect)

  return {
    overlayHeight: layout.overlayHeight,
    statusMaskHeight: windowInfo.statusBarHeight ?? rect.top,
  }
}
