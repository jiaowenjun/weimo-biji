export interface NavigationBarWindowInfoLike {
  windowWidth: number
  statusBarHeight?: number
}

export interface NavigationBarMenuButtonRectLike {
  top: number
  left: number
  height: number
}

export interface StandardNavigationBarLayout {
  safeTop: number
  innerHeight: number
  overlayHeight: number
  leftWidth: number
  innerPaddingRight: number
}

export interface CompactNavigationBarLayout {
  safeTop: number
  innerHeight: number
  overlayHeight: number
}

const NORMAL_BREATHING_PX = 8
const COMPACT_SAFE_TOP_PX = 4
const COMPACT_VERTICAL_BREATHING_PX = 16

export function computeStandardNavigationBarLayout(
  windowInfo: NavigationBarWindowInfoLike,
  rect: NavigationBarMenuButtonRectLike,
): StandardNavigationBarLayout {
  const safeTop = rect.top - NORMAL_BREATHING_PX
  const innerHeight = rect.top + rect.height + NORMAL_BREATHING_PX
  const rightInset = windowInfo.windowWidth - rect.left

  return {
    safeTop,
    innerHeight,
    overlayHeight: innerHeight,
    leftWidth: rightInset,
    innerPaddingRight: rightInset,
  }
}

export function computeCompactNavigationBarLayout(
  rect: Pick<NavigationBarMenuButtonRectLike, 'height'>,
): CompactNavigationBarLayout {
  const innerHeight = rect.height + COMPACT_VERTICAL_BREATHING_PX

  return {
    safeTop: COMPACT_SAFE_TOP_PX,
    innerHeight,
    overlayHeight: innerHeight,
  }
}
