import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

describe('weimo-chip syncPresentation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('emits variant-glass class when variant=glass', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      variant: 'glass',
      tone: 'brand',
      size: 'sm',
      closable: false,
      selected: false,
      disabled: false,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.rootClass).toContain('weimo-chip--variant-glass')
    expect(instance.data.rootClass).toContain('weimo-chip--tone-brand')
    expect(instance.data.rootClass).toContain('weimo-chip--size-sm')
    expect(instance.data.rootClass).toContain('ds-surface-floating')
    expect(instance.data.rootClass).toContain('ds-surface-frosted')
  })

  it('falls back to soft when variant is unknown', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      variant: 'mystery',
      tone: 'brand',
      size: 'xs',
      closable: false,
      selected: false,
      disabled: false,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.rootClass).toContain('weimo-chip--variant-soft')
    expect(instance.data.rootClass).not.toContain('weimo-chip--variant-mystery')
  })

  it('keeps variant-glass alongside tone-neutral', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      variant: 'glass',
      tone: 'neutral',
      size: 'sm',
      closable: false,
      selected: false,
      disabled: false,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.rootClass).toContain('weimo-chip--variant-glass')
    expect(instance.data.rootClass).toContain('weimo-chip--tone-neutral')
  })
})
