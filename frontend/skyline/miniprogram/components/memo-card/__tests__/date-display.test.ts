import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

const componentDir = path.join(__dirname, '..')
const wxml = fs.readFileSync(path.join(componentDir, 'index.wxml'), 'utf8')

describe('memo-card date bar', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('binds the header to a dedicated display field', () => {
    expect(wxml).toContain('{{createdAtDisplayText}}')
  })

  it('shows only the time for a memo created today', async () => {
    vi.setSystemTime(new Date(2026, 4, 21, 12, 0, 0))

    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      createdAtText: '2026-05-21 09:05',
    }) as any
    Object.assign(instance, options.methods)

    ;(options as any).lifetimes?.attached?.call(instance)
    options.observers?.createdAtText?.call(instance, instance.data.createdAtText)

    expect(instance.data.createdAtDisplayText).toBe('9:05')
  })

  it('shows month/day for a memo created earlier this year', async () => {
    vi.setSystemTime(new Date(2026, 4, 21, 12, 0, 0))

    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      createdAtText: '2026-05-20 09:05',
    }) as any
    Object.assign(instance, options.methods)

    ;(options as any).lifetimes?.attached?.call(instance)
    options.observers?.createdAtText?.call(instance, instance.data.createdAtText)

    expect(instance.data.createdAtDisplayText).toBe('5/20')
  })

  it('shows year/month/day for a memo created in a past year', async () => {
    vi.setSystemTime(new Date(2026, 4, 21, 12, 0, 0))

    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      createdAtText: '2025-01-03 09:05',
    }) as any
    Object.assign(instance, options.methods)

    ;(options as any).lifetimes?.attached?.call(instance)
    options.observers?.createdAtText?.call(instance, instance.data.createdAtText)

    expect(instance.data.createdAtDisplayText).toBe('2025/1/3')
  })
})
