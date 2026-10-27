import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

describe('memo-card list identity recycle reset', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function createAttachedInstance(props: Record<string, unknown> = {}) {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 1,
      externalMenu: true,
      externalMenuActive: false,
      entering: false,
      exiting: false,
      viewerRole: 'self',
      ...props,
    }) as any
    Object.assign(instance, options.methods)
    instance.createSelectorQuery = () => ({
      in: () => ({
        select: () => ({
          boundingClientRect: () => ({
            exec: vi.fn(),
          }),
        }),
      }),
    })
    instance.triggerEvent = vi.fn()
    options.lifetimes!.attached!.call(instance)
    return { options, instance }
  }

  it('memoId change after attach resets dirty local state from a recycled slot', async () => {
    vi.useFakeTimers()
    const { options, instance } = await createAttachedInstance()
    instance.setData({
      exitHostStyle: 'opacity:0',
      pressing: true,
      lifted: true,
      pressingTagIdx: 0,
      liftedTagIdx: 1,
      memoCardSurfaceStyle: 'opacity:0.2',
    })

    options.observers!.memoId!.call(instance, 2)

    expect(instance.data.exitHostSnapReset).toBe(true)
    expect(instance.data.exitHostStyle).toContain('translateX(0)')
    expect(instance.data.memoCardSurfaceStyle).toBe('')
    expect(instance.data.pressing).toBe(false)
    expect(instance.data.lifted).toBe(false)
    expect(instance.data.pressingTagIdx).toBe(-1)
    expect(instance.data.liftedTagIdx).toBe(-1)

    vi.runOnlyPendingTimers()

    expect(instance.data.exitHostSnapReset).toBe(true)
    expect(instance.data.exitHostStyle).toBe('')

    vi.runOnlyPendingTimers()

    expect(instance.data.exitHostSnapReset).toBe(false)
  })

  it('memoId change snap-clears exit translateX without leaving -100% residue', async () => {
    vi.useFakeTimers()
    const { options, instance } = await createAttachedInstance()
    instance.setData({
      exitHostStyle:
        'transform:translateX(-100%);opacity:0;max-height:0px;margin-bottom:0',
    })

    options.observers!.memoId!.call(instance, 2)

    expect(instance.data.exitHostSnapReset).toBe(true)
    expect(instance.data.exitHostStyle).toContain('translateX(0)')
    expect(instance.data.exitHostStyle).not.toContain('-100%')

    vi.runOnlyPendingTimers()

    expect(instance.data.exitHostSnapReset).toBe(true)
    expect(instance.data.exitHostStyle).toBe('')

    vi.runOnlyPendingTimers()

    expect(instance.data.exitHostSnapReset).toBe(false)
  })

  it('memoId no-op before attach does nothing', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 1,
      externalMenu: true,
      viewerRole: 'self',
    }) as any
    Object.assign(instance, options.methods)
    const setDataSpy = vi.spyOn(instance, 'setData')
    options.observers!.memoId!.call(instance, 99)
    expect(setDataSpy).not.toHaveBeenCalled()
  })

  it('memoId repeated value does not reset', async () => {
    const { options, instance } = await createAttachedInstance()
    const setDataSpy = vi.spyOn(instance, 'setData')
    instance.setData({ pressing: true })
    setDataSpy.mockClear()

    options.observers!.memoId!.call(instance, 1)

    expect(setDataSpy).not.toHaveBeenCalled()
    expect(instance.data.pressing).toBe(true)
  })

  it('memoId change with clean local state does not setData', async () => {
    const { options, instance } = await createAttachedInstance()
    const setDataSpy = vi.spyOn(instance, 'setData')
    setDataSpy.mockClear()

    options.observers!.memoId!.call(instance, 2)

    expect(setDataSpy).not.toHaveBeenCalled()
  })

  it('external menu latched emits menuchange when memoId changes', async () => {
    const { options, instance } = await createAttachedInstance({ externalMenuActive: true })

    instance.triggerEvent = vi.fn()
    options.observers!.memoId!.call(instance, 42)

    expect(instance.triggerEvent).toHaveBeenCalledWith('menuchange', { active: false })
  })

  it('entering false snaps surface style then clears after timer', async () => {
    vi.useFakeTimers()
    const { options, instance } = await createAttachedInstance()

    options.observers!.entering!.call(instance, false)

    expect(instance.data.memoCardSurfaceStyle).toContain('opacity:1')
    expect(instance.data.memoCardSurfaceStyle).toContain('translateY(0')

    vi.advanceTimersByTime(50)

    expect(instance.data.memoCardSurfaceStyle).toBe('')
  })
})
