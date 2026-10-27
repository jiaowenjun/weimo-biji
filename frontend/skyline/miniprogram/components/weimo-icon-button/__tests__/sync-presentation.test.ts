import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

describe('weimo-icon-button syncPresentation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('declares iconColor and recomputes iconStyle with size and color', async () => {
    const options = await captureComponentOptions(() => import('../index'))

    expect(options.properties.iconColor).toEqual({
      type: String,
      value: '',
    })
    expect(Object.keys(options.observers ?? {})).toContain(
      'variant, tone, size, iconSize, iconColor, feedbackStyle, hoverable, disabled, loading, pressed',
    )

    const instance = createComponentInstance(options, {
      variant: 'ghost',
      tone: 'neutral',
      size: 'sm',
      iconSize: '28rpx',
      iconColor: 'var(--color-text-placeholder)',
      feedbackStyle: 'brand-soft',
      hoverable: false,
      disabled: false,
      loading: false,
      pressed: true,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.iconStyle).toBe('font-size: 28rpx; color: var(--color-text-placeholder);')
  })

  it('omits color from iconStyle when iconColor is blank', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      iconSize: '28rpx',
      iconColor: '   ',
      hoverable: true,
      disabled: false,
      loading: false,
      pressed: false,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.iconStyle).toBe('font-size: 28rpx;')
  })

  it('adds shared floating surface classes to the glass variant root class', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      variant: 'glass',
      tone: 'brand',
      size: 'lg',
      iconSize: '',
      iconColor: '',
      feedbackStyle: 'default',
      hoverable: true,
      disabled: false,
      loading: false,
      pressed: false,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.rootClass).toContain('ds-surface-floating')
    expect(instance.data.rootClass).toContain('ds-surface-frosted')
  })

  it('supports a nav-glass feedback style for frosted navigation buttons', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      variant: 'glass',
      tone: 'neutral',
      size: 'md',
      iconSize: '',
      iconColor: '',
      feedbackStyle: 'nav-glass',
      hoverable: true,
      disabled: false,
      loading: false,
      pressed: true,
    })

    options.methods?.syncPresentation?.call(instance)

    expect(instance.data.rootClass).toContain('weimo-icon-button--feedback-nav-glass')

    const wxss = readFileSync(path.join(__dirname, '../index.wxss'), 'utf8')
    expect(wxss).toContain('.weimo-icon-button--variant-glass.weimo-icon-button--feedback-nav-glass.weimo-icon-button--hover')
    expect(wxss).toContain('.weimo-icon-button--variant-glass.weimo-icon-button--feedback-nav-glass.weimo-icon-button--pressed')
    expect(wxss).toContain('.weimo-icon-button--variant-glass.weimo-icon-button--feedback-nav-glass {')
    expect(wxss).toContain('transition: opacity 180ms ease, transform 80ms ease;')
    expect(wxss).toContain('box-shadow: inset 0 0 0 999rpx var(--color-pressable-hover), var(--shadow-float-elevated);')
    expect(wxss).toContain('transform: scale(0.94);')
    expect(wxss).not.toContain(
      '.weimo-icon-button--variant-glass.weimo-icon-button--feedback-nav-glass.weimo-icon-button--hover {\n  background-color: var(--color-pressable-hover);',
    )
  })
})
