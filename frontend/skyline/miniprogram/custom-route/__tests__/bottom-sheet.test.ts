import { beforeEach, describe, expect, it, vi } from 'vitest'

function installWorkletStub() {
  const identity = (t: number) => t
  vi.stubGlobal('wx', {
    worklet: {
      derived: (fn: () => number) => ({
        get value() {
          return fn()
        },
      }),
      Easing: {
        cubicBezier: () => identity,
        in: () => identity,
        out: () => identity,
        ease: identity,
      },
    },
  })
}

describe('bottom-sheet route builder', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    installWorkletStub()
  })

  it('keeps the previous route from joining bottom sheet transitions', async () => {
    const { default: BottomSheet } = await import('../bottom-sheet')

    const config = BottomSheet({
      primaryAnimation: { value: 1 },
      primaryAnimationStatus: { value: 3 },
      userGestureInProgress: { value: false },
    })

    expect(config).toEqual(expect.objectContaining({
      opaque: false,
      barrierDismissible: true,
      fullscreenDrag: true,
      canTransitionFrom: false,
    }))
  })
})
