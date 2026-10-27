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
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')
const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')

function createRectQuery(rect: Record<string, unknown>) {
  const query: Record<string, any> = {
    in: vi.fn(() => query),
    select: vi.fn(() => query),
    boundingClientRect: vi.fn(() => query),
    exec: vi.fn((callback: (res: unknown[]) => void) => callback([rect])),
  }
  return query
}

function mockHapticTap(hapticTap: ReturnType<typeof vi.fn>) {
  vi.doMock('../../../utils/haptic', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../utils/haptic')>()),
    hapticTap,
  }))
}

describe('sidebar tag tree friend row contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does not render a friend profile as a tag tree row', () => {
    expect(wxml).not.toContain("item.kind === 'friend'")
    expect(wxml).not.toContain('tag-tree__friend-avatar')
    expect(wxml).not.toContain('friendAvatarUrl')
    expect(wxml).toContain('class="tag-tree__label"')
    expect(ts).not.toContain('buildFriendRow')
    expect(ts).not.toContain('__friend__')
    expect(ts).not.toContain("this.triggerEvent('friendselect'")
    expect(wxss).not.toContain('tag-tree__friend-avatar')
  })

  it('keeps visible rows limited to actual tag nodes', async () => {
    vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() })
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      nodes: [{ label: '工作', tag: '工作', item_count: 1, children: [] }],
      selectedTag: '',
      expandedTags: [],
    })
    Object.assign(instance, options.methods)

    options.methods?.rebuildVisibleRows?.call(instance)

    const rows = instance.data.visibleRows as Array<{ tag: string; label: string }>
    expect(rows.map((row) => row.tag)).toEqual(['工作'])
    expect(rows).not.toContainEqual(expect.objectContaining({ tag: expect.stringContaining('__friend__') }))
  })

  it('hides tag menus when tagMenuEnabled is false', () => {
    expect(wxml).toContain('wx:if="{{authenticated && tagMenuEnabled}}"')
  })

  it('opens tag menus through separate button and row long-press handlers', () => {
    expect(wxml).toContain('bind:longpress="handleRowMenuLongPress"')
    expect(wxml).toContain('mark:tagTreeControl="menu"')
    expect(wxml).toContain('bind:touchstart="handleMenuButtonTouchStart"')
    expect(wxml).not.toContain('catch:touchstart="handleMenuButtonTouchStart"')
    expect(wxml).toContain('catch:tap="handleMenuButtonTap"')
    expect(ts).toContain('handleMenuButtonTap(event: WechatMiniprogram.BaseEvent)')
    expect(ts).toContain('this._openTagMenu(event, { liftRow: false })')
    expect(ts).toContain('handleRowMenuLongPress(event: WechatMiniprogram.BaseEvent)')
    expect(ts).toContain('this._openTagMenu(event, { liftRow: true })')
  })

  it('does not import the standalone touch-lift module from the lazy-loaded component', () => {
    expect(ts).not.toContain("from '../../utils/touch-lift'")
  })

  it('does not start row lift for a touch marked as the three-dot control', async () => {
    vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() })
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options) as any
    Object.assign(instance, options.methods)
    instance._cancelLift = vi.fn()

    instance.handleRowTouchStart({
      mark: { tagTreeControl: 'menu' },
      touches: [{ clientX: 12, clientY: 20 }],
    })

    expect(instance._cancelLift).toHaveBeenCalledOnce()
    expect(instance._liftSession).toBeUndefined()
    expect(instance._liftTimer).toBeUndefined()
    expect(instance._menuGestureGateTimer).toBeUndefined()
  })

  it('does not open a long-press menu when tagMenuEnabled is false', async () => {
    const createSelectorQuery = vi.fn()
    vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() })
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      authenticated: true,
      tagMenuEnabled: false,
      menuItems: [{ id: 'edit', label: '重命名' }],
      visibleRows: [{ tag: 'work', label: 'work', depth: 0, hasChildren: false }],
    })
    Object.assign(instance, options.methods, { createSelectorQuery })

    options.methods?.handleRowMenuLongPress?.call(instance, {
      currentTarget: { dataset: { tag: 'work', index: 0 } },
    })

    expect(createSelectorQuery).not.toHaveBeenCalled()
    expect(instance.data.menuActive).toBe(false)
  })

  it('opens the three-dot menu without lifting the whole row', async () => {
    const hapticTap = vi.fn()
    mockHapticTap(hapticTap)
    vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() })
    const options = await captureComponentOptions(() => import('../index'))
    const rect = { top: 80, right: 300, bottom: 116, left: 264, width: 36, height: 36 }
    const query = createRectQuery(rect)
    const instance = createComponentInstance(options, {
      authenticated: true,
      tagMenuEnabled: true,
      menuItems: [{ id: 'edit', label: '重命名' }],
      visibleRows: [{ tag: 'work', label: '工作', depth: 0, hasChildren: false }],
      liftedIndex: -1,
      menuActive: false,
    })
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })

    options.methods?.handleMenuButtonTap?.call(instance, {
      currentTarget: { dataset: { tag: 'work', index: 0 } },
    })

    expect(instance.data.menuActive).toBe(true)
    expect(instance.data.menuTag).toBe('work')
    expect(instance.data.menuAnchorRect).toEqual({ ...rect, top: 72, bottom: 124 })
    expect(instance.data.liftedIndex).toBe(-1)
    expect(hapticTap).toHaveBeenCalledWith('light')
  })

  it('keeps row long-press menu opening lifted', async () => {
    mockHapticTap(vi.fn())
    vi.stubGlobal('wx', { nextTick: (callback: () => void) => callback() })
    const options = await captureComponentOptions(() => import('../index'))
    const query = createRectQuery({
      top: 80,
      right: 300,
      bottom: 116,
      left: 264,
      width: 36,
      height: 36,
    })
    const instance = createComponentInstance(options, {
      authenticated: true,
      tagMenuEnabled: true,
      menuItems: [{ id: 'edit', label: '重命名' }],
      visibleRows: [{ tag: 'work', label: '工作', depth: 0, hasChildren: false }],
      liftedIndex: -1,
      menuActive: false,
    })
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })

    options.methods?.handleRowMenuLongPress?.call(instance, {
      currentTarget: { dataset: { tag: 'work', index: 0 } },
    })

    expect(instance.data.menuActive).toBe(true)
    expect(instance.data.liftedIndex).toBe(0)
  })
})
