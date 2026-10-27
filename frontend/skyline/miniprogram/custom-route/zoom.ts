import { AnimationStatus, genSecondaryAnimationHandler } from './util'

const { shared, derived, Easing } = wx.worklet

interface CustomRouteContext {
  primaryAnimation: SkylineSharedValue<number>
  primaryAnimationStatus: SkylineSharedValue<number>
  userGestureInProgress: SkylineSharedValue<boolean>
  secondaryAnimation: SkylineSharedValue<number>
  secondaryAnimationStatus: SkylineSharedValue<number>
}

function intervalCurve(begin: number, end: number) {
  return (t: number) => {
    'worklet'
    const clamped = t < begin ? 0 : t > end ? 1 : (t - begin) / (end - begin)
    return clamped
  }
}

function chainTween(begin: number, end: number, curve: (t: number) => number) {
  return (t: number) => {
    'worklet'
    if (t === 0.0) return begin
    if (t === 1.0) return end
    return begin + (end - begin) * curve(t)
  }
}

function tweenSequence(items: Array<{ tween: (t: number) => number; weight: number }>) {
  let totalWeight = 0
  for (const item of items) totalWeight += item.weight

  const intervals: Array<{ start: number; end: number }> = []
  let start = 0
  for (let i = 0; i < items.length; i++) {
    const end = i === items.length - 1 ? 1.0 : start + items[i].weight / totalWeight
    intervals.push({ start, end })
    start = end
  }

  return (t: number) => {
    'worklet'
    if (t === 0) {
      const last = items[items.length - 1]
      const iv = intervals[items.length - 1]
      return last.tween((t - iv.start) / (iv.end - iv.start))
    }
    for (let i = 0; i < items.length; i++) {
      const iv = intervals[i]
      if (t >= iv.start && t < iv.end) {
        return items[i].tween((t - iv.start) / (iv.end - iv.start))
      }
    }
    return items[items.length - 1].tween(1)
  }
}

const scaleCurveSequence = tweenSequence([
  { tween: chainTween(0.0, 0.4, Easing.cubicBezier(0.05, 0.0, 0.133333, 0.06)), weight: 0.166666 },
  { tween: chainTween(0.4, 1.0, Easing.cubicBezier(0.208333, 0.82, 0.25, 1.0)), weight: 1.0 - 0.166666 },
])

const fadeInTransition = chainTween(0.0, 1.0, intervalCurve(0.125, 0.250))
const scaleUpEnter = chainTween(0.85, 1.0, scaleCurveSequence)
const scaleDownEnter = chainTween(1.1, 1.0, scaleCurveSequence)
const fadeOutTransition = chainTween(1.0, 0.0, intervalCurve(0.0825, 0.2075))
const scaleUpExit = chainTween(1.0, 1.05, scaleCurveSequence)
const scaleDownExit = chainTween(1.0, 0.9, scaleCurveSequence)

function zoomEnterForward(t: number) {
  'worklet'
  return { opacity: fadeInTransition(t), transform: `scale(${scaleUpEnter(t)})` }
}

function zoomEnterReverse(t: number) {
  'worklet'
  return { opacity: 1.0, transform: `scale(${scaleDownEnter(t)})` }
}

function zoomExitForward(t: number) {
  'worklet'
  return { opacity: 1.0, transform: `scale(${scaleUpExit(t)})` }
}

function zoomExitReverse(t: number) {
  'worklet'
  return { opacity: fadeOutTransition(t), transform: `scale(${scaleDownExit(t)})` }
}

function generateAnimationHandler(
  animation: SkylineSharedValue<number>,
  animationStatus: SkylineSharedValue<number>,
  forwardFn: (t: number) => Record<string, string | number>,
  reverseFn: (t: number) => Record<string, string | number>,
) {
  const effectiveStatus = shared(animationStatus.value)

  return () => {
    'worklet'
    const current = animationStatus.value
    const last = effectiveStatus.value

    let effective = current
    if (current === AnimationStatus.forward && last === AnimationStatus.reverse) {
      effective = last
    } else if (current === AnimationStatus.reverse && last === AnimationStatus.forward) {
      effective = last
    }
    effectiveStatus.value = effective

    const t = animation.value
    if (effective === AnimationStatus.dismissed || effective === AnimationStatus.forward) {
      return forwardFn(t)
    }
    return reverseFn(1 - t)
  }
}

const Zoom = (customRouteContext: CustomRouteContext) => {
  const { primaryAnimation, primaryAnimationStatus } = customRouteContext

  const reverseAnimation = derived(() => {
    'worklet'
    return 1 - primaryAnimation.value
  })

  const reverseAnimationStatus = derived(() => {
    'worklet'
    const s = primaryAnimationStatus.value
    if (s === AnimationStatus.forward) return AnimationStatus.reverse
    if (s === AnimationStatus.reverse) return AnimationStatus.forward
    if (s === AnimationStatus.completed) return AnimationStatus.dismissed
    return AnimationStatus.completed
  })

  const handlePrimaryAnimation = generateAnimationHandler(
    primaryAnimation,
    primaryAnimationStatus,
    zoomEnterForward,
    zoomExitReverse,
  )

  const handlePreviousPageAnimation = generateAnimationHandler(
    reverseAnimation,
    reverseAnimationStatus,
    zoomEnterReverse,
    zoomExitForward,
  )

  const handleSecondaryAnimation = genSecondaryAnimationHandler(customRouteContext)

  return {
    transitionDuration: 400,
    reverseTransitionDuration: 400,
    handlePrimaryAnimation,
    handlePreviousPageAnimation,
    handleSecondaryAnimation,
  }
}

export default Zoom
