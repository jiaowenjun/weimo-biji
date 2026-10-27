import { CurveAnimation, Curves } from './util'

interface CustomRouteContext {
  primaryAnimation: SkylineSharedValue<number>
  primaryAnimationStatus: SkylineSharedValue<number>
  userGestureInProgress: SkylineSharedValue<boolean>
}

const CupertinoModal = (customRouteContext: CustomRouteContext) => {
  const menuRect = wx.getMenuButtonBoundingClientRect()

  const { primaryAnimation, primaryAnimationStatus, userGestureInProgress } = customRouteContext

  const topRadius = 12
  const offsetToMenu = 2
  const prevPageBrightness = 0.9
  const prevPageVisibleOffset = 10
  const prevPageTop = menuRect.bottom + offsetToMenu
  const nextPageTop = prevPageTop + prevPageVisibleOffset
  const nextPageBoxShadow = '0px 0px 10px 5px rgba(0, 0, 0, 0.12)'

  const _curvePrimaryAnimation = CurveAnimation({
    animation: primaryAnimation,
    animationStatus: primaryAnimationStatus,
    curve: Curves.linearToEaseOut,
    reverseCurve: Curves.easeInToLinear,
  })

  const handlePrimaryAnimation = () => {
    'worklet'
    let t = primaryAnimation.value
    if (!userGestureInProgress.value) {
      t = _curvePrimaryAnimation.value
    }

    return {
      overflow: 'hidden',
      boxShadow: nextPageBoxShadow,
      borderRadius: `${topRadius}px ${topRadius}px 0px 0px`,
      marginTop: `${nextPageTop}px`,
      transform: `translateY(${(1 - t) * 100}%)`,
    }
  }

  const handlePreviousPageAnimation = () => {
    'worklet'
    let t = primaryAnimation.value
    if (!userGestureInProgress.value) {
      t = _curvePrimaryAnimation.value
    }

    const scale = 1 - t / 10
    const brightness = 1 + (prevPageBrightness - 1) * t

    return {
      overflow: 'hidden',
      filter: `brightness(${brightness})`,
      borderRadius: `${topRadius}px ${topRadius}px 0px 0px`,
      transformOrigin: 'top center',
      transform: `translateY(${prevPageTop * t}px) scale(${scale})`,
    }
  }

  return {
    opaque: false,
    transitionDuration: 400,
    reverseTransitionDuration: 400,
    handlePrimaryAnimation,
    handlePreviousPageAnimation,
  }
}

export default CupertinoModal
