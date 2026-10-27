const { derived, Easing } = wx.worklet

export const AnimationStatus = {
  dismissed: 0,
  forward: 1,
  reverse: 2,
  completed: 3,
}

export const Colors = {
  black12: 'rgba(0, 0, 0, 0.12)',
  black26: 'rgba(0, 0, 0, 0.26)',
  black38: 'rgba(0, 0, 0, 0.38)',
  black45: 'rgba(0, 0, 0, 0.45)',
  black54: 'rgba(0, 0, 0, 0.54)',
  black87: 'rgba(0, 0, 0, 0.87)',
}

export const Curves = {
  linearToEaseOut: Easing.cubicBezier(0.35, 0.91, 0.33, 0.97),
  easeInToLinear: Easing.cubicBezier(0.67, 0.03, 0.65, 0.09),
  fastOutSlowIn: Easing.cubicBezier(0.4, 0.0, 0.2, 1.0),
  decelerateEasing: Easing.cubicBezier(0.0, 0.0, 0.2, 1.0),
  easeOutCubic: Easing.cubicBezier(0.215, 0.61, 0.355, 1.0),
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  ease: Easing.ease,
}

export function clamp(v: number, lower: number, upper: number): number {
  'worklet'
  if (v < lower) return lower
  if (v > upper) return upper
  return v
}

export function lerp(begin: number, end: number, t: number): number {
  'worklet'
  return begin + (end - begin) * t
}

export function CurveAnimation({
  animation,
  animationStatus,
  curve,
  reverseCurve,
}: {
  animation: SkylineSharedValue<number>
  animationStatus: SkylineSharedValue<number>
  curve: (t: number) => number
  reverseCurve?: (t: number) => number
}) {
  return derived(() => {
    'worklet'
    const useForwardCurve = !reverseCurve || animationStatus.value !== AnimationStatus.reverse
    const activeCurve = useForwardCurve ? curve : reverseCurve
    const t = animation.value
    if (!activeCurve) return t
    if (t === 0 || t === 1) return t
    return activeCurve(t)
  })
}

export function genSecondaryAnimationHandler(customRouteContext: {
  secondaryAnimation: SkylineSharedValue<number>
  secondaryAnimationStatus: SkylineSharedValue<number>
  userGestureInProgress: SkylineSharedValue<boolean>
}) {
  const { secondaryAnimation, secondaryAnimationStatus, userGestureInProgress } = customRouteContext

  const _curveSecondaryAnimation = CurveAnimation({
    animation: secondaryAnimation,
    animationStatus: secondaryAnimationStatus,
    curve: Curves.linearToEaseOut,
    reverseCurve: Curves.easeInToLinear,
  })

  const handleSecondaryAnimation = () => {
    'worklet'
    let t = secondaryAnimation.value
    if (!userGestureInProgress.value) {
      t = _curveSecondaryAnimation.value
    }
    return {
      transform: `translateX(${(-1 / 3) * t * 100}%)`,
    }
  }

  return handleSecondaryAnimation
}
