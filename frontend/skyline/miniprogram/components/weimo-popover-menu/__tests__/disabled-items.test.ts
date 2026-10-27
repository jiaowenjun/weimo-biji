import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('weimo-popover-menu disabled items', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does not emit select when a disabled menu item is tapped', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      items: [
        { id: 'edit', label: '编辑', disabled: true },
        { id: 'quote', label: '批注' },
      ],
    }) as any
    Object.assign(instance, options.methods)
    instance.triggerEvent = vi.fn()

    instance.handleItemTap({ currentTarget: { dataset: { id: 'edit' } } })
    expect(instance.triggerEvent).not.toHaveBeenCalled()

    instance.handleItemTap({ currentTarget: { dataset: { id: 'quote' } } })
    expect(instance.triggerEvent).toHaveBeenCalledWith('select', {
      id: 'quote',
      item: { id: 'quote', label: '批注' },
    })
  })

  it('does not emit select when a section header row is tapped', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      items: [
        {
          id: 'section',
          label: '排序方式',
          icon: 'arrow-up-down-1',
          sectionHeader: true,
        },
        { id: 'a', label: '可选' },
      ],
    }) as any
    Object.assign(instance, options.methods)
    instance.triggerEvent = vi.fn()

    instance.handleItemTap({ currentTarget: { dataset: { id: 'section' } } })
    expect(instance.triggerEvent).not.toHaveBeenCalled()
  })

  it('does not emit select when a collapse lead row is tapped (toggles group only)', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      items: [
        {
          id: 'sort',
          label: '排序方式',
          sectionHeader: true,
          collapseGroupId: 'memoSort',
        },
        {
          id: 'opt',
          label: '子项',
          dividerBefore: false,
          collapseMemberOf: 'memoSort',
        },
      ],
    }) as any
    Object.assign(instance, options.methods)
    instance.triggerEvent = vi.fn()
    instance.data.visible = false
    instance.data.triggerRect = null

    instance.handleItemTap({ currentTarget: { dataset: { id: 'sort' } } })
    expect(instance.triggerEvent).not.toHaveBeenCalled()
  })

  it('renders disabled state without hover feedback', () => {
    const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
    const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')

    expect(wxml).toContain("{{item._showDivider}}")
    expect(wxml).toContain("{{item.disabled ? 'weimo-popover-menu__item--disabled' : ''}}")
    expect(wxml).toContain(
      '{{item.sectionHeader ? \'weimo-popover-menu__item--section-header\' : \'\'}}',
    )
    expect(wxml).toContain(
      "{{item.disabled ? 'none' : (item.sectionHeader && !item.collapseGroupId ? 'none' : 'weimo-popover-menu__item--hover')}}",
    )
    expect(wxml).toContain('{{item.iconExtraClass}}')
    expect(wxss).toContain('.weimo-popover-menu--anchor-start.weimo-popover-menu--up')
    expect(wxss).toContain('.weimo-popover-menu__item-icon--rot-ccw-45')
    expect(wxss).toContain('.weimo-popover-menu__item--disabled')
    expect(wxss).toContain('.weimo-popover-menu__item-text--disabled')
    expect(wxss).toContain('.weimo-popover-menu__item--section-header')
  })
})
