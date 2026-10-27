import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

type ChipTestInst = ReturnType<typeof createComponentInstance> & {
  triggerEvent: ReturnType<typeof vi.fn>
}

function createChipTestInstance(
  options: Awaited<ReturnType<typeof captureComponentOptions>>,
  data: Record<string, unknown>,
): ChipTestInst {
  const inst = createComponentInstance(options, data) as ChipTestInst
  inst.triggerEvent = vi.fn()
  Object.assign(inst, options.methods ?? {})
  return inst
}

describe('weimo-chip haptic', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('onTap calls hapticTap light when haptic is true and not disabled', async () => {
    const hapticTap = vi.fn()
    vi.doMock('../../../utils/haptic', () => ({ hapticTap }))

    const options = await captureComponentOptions(() => import('../index'))
    const inst = createChipTestInstance(options, {
      disabled: false,
      haptic: true,
      value: 'tag',
      prefix: '#',
      icon: '',
      actionValue: '',
      selected: false,
    })

    inst.onTap()

    expect(hapticTap).toHaveBeenCalledTimes(1)
    expect(hapticTap).toHaveBeenCalledWith('light')
    expect(inst.triggerEvent).toHaveBeenCalledWith('tap', expect.any(Object))
  })

  it('onTap skips haptic when haptic is false', async () => {
    const hapticTap = vi.fn()
    vi.doMock('../../../utils/haptic', () => ({ hapticTap }))

    const options = await captureComponentOptions(() => import('../index'))
    const inst = createChipTestInstance(options, {
      disabled: false,
      haptic: false,
      value: 'tag',
      prefix: '#',
      icon: '',
      actionValue: '',
      selected: false,
    })

    inst.onTap()

    expect(hapticTap).not.toHaveBeenCalled()
    expect(inst.triggerEvent).toHaveBeenCalled()
  })

  it('onClose calls hapticTap light when haptic is true', async () => {
    const hapticTap = vi.fn()
    vi.doMock('../../../utils/haptic', () => ({ hapticTap }))

    const options = await captureComponentOptions(() => import('../index'))
    const inst = createChipTestInstance(options, {
      disabled: false,
      haptic: true,
      value: 'tag',
      prefix: '',
      icon: '',
      actionValue: '',
      selected: false,
    })

    inst.onClose()

    expect(hapticTap).toHaveBeenCalledWith('light')
    expect(inst.triggerEvent).toHaveBeenCalledWith('close', expect.any(Object))
    expect(inst.triggerEvent).toHaveBeenCalledWith('clear', expect.any(Object))
  })
})
