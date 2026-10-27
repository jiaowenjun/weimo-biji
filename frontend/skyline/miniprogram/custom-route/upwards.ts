import { Colors, CurveAnimation, genSecondaryAnimationHandler } from './util'

const { Easing } = wx.worklet

interface CustomRouteContext {
  primaryAnimation: SkylineSharedValue<number>
  primaryAnimationStatus: SkylineSharedValue<number>
  userGestureInProgress: SkylineSharedValue<boolean>
  secondaryAnimation: SkylineSharedValue<number>
  secondaryAnimationStatus: SkylineSharedValue<number>
}

const Upwards = (customRouteContext: CustomRouteContext) => {
  const { primaryAnimation, primaryAnimationStatus, userGestureInProgress } = customRouteContext

  const transitionCurve = Easing.cubicBezier(0.2, 0.0, 0.0, 1.0)

  const _curvePrimaryAnimation = CurveAnimation({
    animation: primaryAnimation,
    animationStatus: primaryAnimationStatus,
    curve: transitionCurve,
    reverseCurve: Easing.out(transitionCurve),
  })

  const handlePrimaryAnimation = () => {
    'worklet'
    let t = primaryAnimation.value
    if (!userGestureInProgress.value) {
      t = _curvePrimaryAnimation.value
    }

    return {
      overflow: 'hidden',
      transform: `translateY(${(1 - t) * 100}%)`,
    }
  }

  const handlePreviousPageAnimation = () => {
    'worklet'
    return {}
  }

  const handleSecondaryAnimation = genSecondaryAnimationHandler(customRouteContext)

  return {
    barrierColor: Colors.black26,
    transitionDuration: 400,
    reverseTransitionDuration: 400,
    handlePrimaryAnimation,
    handlePreviousPageAnimation,
    handleSecondaryAnimation,
  }
}

export default Upwards
