import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
  type TestComponentOptions,
} from '../../../test-utils/component-harness'

const MENU_OBSERVER = 'tags, viewerRole, menuReadonly, showReferenceBar, referencePreview, referencedByPreviews'

function syncPermissionsAndMenu(options: TestComponentOptions, instance: any) {
  options.observers?.viewerRole?.call(instance, instance.data.viewerRole)
  options.observers?.[MENU_OBSERVER]?.call(instance)
}

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

describe('memo-card menu readonly state', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('builds disabled menu items when menuReadonly is enabled, except share and copy stay tappable', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      tags: [],
      viewerRole: 'self',
      menuReadonly: true,
    }) as any
    Object.assign(instance, options.methods)

    syncPermissionsAndMenu(options, instance)

    expect(instance.data.menuItems.map((item: { id: string }) => item.id)).toEqual([
      'edit',
      'quote',
      'share',
      'copy',
      'delete',
    ])
    expect(
      instance.data.menuItems
        .filter((item: { id: string }) => item.id !== 'share' && item.id !== 'copy')
        .every((item: { disabled?: boolean }) => item.disabled === true),
    ).toBe(true)
    expect(instance.data.menuItems.find((item: { id: string }) => item.id === 'share')?.disabled).toBe(
      undefined,
    )
    expect(instance.data.menuItems.find((item: { id: string }) => item.id === 'copy')?.disabled).toBe(
      undefined,
    )

    instance.data.tags = ['工作']
    syncPermissionsAndMenu(options, instance)

    expect(instance.data.menuItems.map((item: { id: string }) => item.id)).toEqual([
      'edit',
      'quote',
      'share',
      'copy',
      'delete',
    ])
    expect(
      instance.data.menuItems
        .filter((item: { id: string }) => item.id !== 'share' && item.id !== 'copy')
        .every((item: { disabled?: boolean }) => item.disabled === true),
    ).toBe(true)
  })

  it('ignores disabled menu select events defensively', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 7,
      viewerRole: 'self',
      menuActive: true,
    }) as any
    Object.assign(instance, options.methods)
    syncPermissionsAndMenu(options, instance)
    instance.triggerEvent = vi.fn()

    instance.handleMenuSelect({
      detail: {
        id: 'delete',
        item: { id: 'delete', label: '删除', disabled: true },
      },
    })

    expect(instance.data.menuActive).toBe(true)
    expect(instance.triggerEvent).not.toHaveBeenCalled()
  })

  it('denied viewerRole ignores all card menu actions', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 7,
      viewerRole: 'denied',
      showReferenceBar: true,
      referencePreview: { id: '1', displayText: 'x' },
      menuActive: true,
    }) as any
    Object.assign(instance, options.methods)
    syncPermissionsAndMenu(options, instance)
    instance.triggerEvent = vi.fn()

    expect(instance.data.menuItems).toEqual([])

    for (const id of ['edit', 'quote', 'memo-detail', 'delete', 'share', 'copy']) {
      instance.handleMenuSelect({ detail: { id } })
    }

    expect(instance.triggerEvent).not.toHaveBeenCalled()
    expect(instance.data.menuActive).toBe(true)
  })

  it('keeps tag popover content latched while closing so the exit animation does not flash card menu items', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const tagMenuItems = [
      { id: 'tag-edit', label: '编辑标签', icon: 'edit' },
      { id: 'tag-add', label: '新增标签', icon: 'add', dividerBefore: false },
      { id: 'tag-remove', label: '删除标签', icon: 'delete', danger: true, dividerBefore: true },
    ]
    const instance = createComponentInstance(options, {
      tags: ['工作'],
      viewerRole: 'self',
      menuActive: true,
      popoverMode: 'tag',
      popoverMenuPlacementPriority: 'up-first',
      popoverMenuHorizontalAlign: 'start',
      popoverScaleAnchor: 'start',
      tagPopoverTarget: '工作',
      menuPopoverHeader: '工作',
      menuItems: tagMenuItems,
    }) as any
    Object.assign(instance, options.methods)

    instance.closeMenu()

    expect(instance.data.menuActive).toBe(false)
    expect(instance.data.popoverMode).toBe('tag')
    expect(instance.data.popoverMenuPlacementPriority).toBe('up-first')
    expect(instance.data.popoverMenuHorizontalAlign).toBe('start')
    expect(instance.data.popoverScaleAnchor).toBe('start')
    expect(instance.data.tagPopoverTarget).toBe('工作')
    expect(instance.data.menuPopoverHeader).toBe('工作')
    expect(instance.data.menuItems.map((item: { id: string }) => item.id)).toEqual([
      'tag-edit',
      'tag-add',
      'tag-remove',
    ])
  })

  it('keeps normal card menu close behavior intact', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      tags: ['工作'],
      viewerRole: 'self',
      menuActive: true,
      popoverMode: 'card',
      popoverScaleAnchor: 'end',
      tagPopoverTarget: '',
      menuPopoverHeader: '',
    }) as any
    Object.assign(instance, options.methods)
    syncPermissionsAndMenu(options, instance)

    instance.closeMenu()

    expect(instance.data.menuActive).toBe(false)
    expect(instance.data.popoverMode).toBe('card')
    expect(instance.data.popoverScaleAnchor).toBe('end')
    expect(instance.data.tagPopoverTarget).toBe('')
    expect(instance.data.menuPopoverHeader).toBe('')
    expect(instance.data.menuItems.map((item: { id: string }) => item.id)).toEqual([
      'edit',
      'quote',
      'share',
      'copy',
      'delete',
    ])
  })

  it('does not start card lift for a touch marked as the three-dot control', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      menuGestureGate: true,
    }) as any
    Object.assign(instance, options.methods)
    instance._cancelLift = vi.fn()

    instance.handleLiftTouchStart({
      mark: { memoCardControl: 'more' },
      touches: [{ clientX: 12, clientY: 20 }],
    })

    expect(instance._cancelLift).toHaveBeenCalledOnce()
    expect(instance._liftSession).toBeUndefined()
    expect(instance._liftTimer).toBeUndefined()
    expect(instance._menuGestureGateTimer).toBeUndefined()
  })

  it('does not start card lift for a touch marked as a tag capsule', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      menuGestureGate: true,
    }) as any
    Object.assign(instance, options.methods)
    instance._cancelLift = vi.fn()

    instance.handleLiftTouchStart({
      mark: { memoCardControl: 'tag' },
      touches: [{ clientX: 12, clientY: 20 }],
    })

    expect(instance._cancelLift).toHaveBeenCalledOnce()
    expect(instance._liftSession).toBeUndefined()
    expect(instance._liftTimer).toBeUndefined()
    expect(instance._menuGestureGateTimer).toBeUndefined()
  })

  it('opens the three-dot menu without lifting the whole card', async () => {
    const hapticTap = vi.fn()
    mockHapticTap(hapticTap)
    const options = await captureComponentOptions(() => import('../index'))
    const rect = { top: 20, right: 340, bottom: 56, left: 304, width: 36, height: 36 }
    const query = createRectQuery(rect)
    const instance = createComponentInstance(options, {
      tags: ['工作'],
      viewerRole: 'self',
      lifted: false,
      menuActive: false,
    }) as any
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })
    syncPermissionsAndMenu(options, instance)

    instance.handleMoreButtonTap()

    expect(instance.data.menuActive).toBe(true)
    expect(instance.data.menuAnchorRect).toEqual(rect)
    expect(instance.data.lifted).toBe(false)
    expect(hapticTap).toHaveBeenCalledWith('light')
  })

  it('external menu mode emits a card menu request without activating an embedded popover', async () => {
    const hapticTap = vi.fn()
    mockHapticTap(hapticTap)
    const options = await captureComponentOptions(() => import('../index'))
    const rect = { top: 20, right: 340, bottom: 56, left: 304, width: 36, height: 36 }
    const query = createRectQuery(rect)
    const instance = createComponentInstance(options, {
      memoId: 17,
      tags: ['工作'],
      viewerRole: 'self',
      externalMenu: true,
      lifted: false,
      menuActive: false,
    }) as any
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })
    syncPermissionsAndMenu(options, instance)
    instance.triggerEvent = vi.fn()

    instance.handleMoreButtonTap()

    expect(instance.data.menuActive).toBe(false)
    expect(instance.data.lifted).toBe(false)
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'menuopen',
      expect.objectContaining({
        memoId: 17,
        mode: 'card',
        triggerRect: rect,
        placementPriority: 'down-first',
        horizontalAlign: 'end',
        scaleAnchor: 'end',
        header: '',
      }),
    )
    const detail = (instance.triggerEvent as any).mock.calls[0][1]
    expect(detail.items.map((item: { id: string }) => item.id)).toEqual([
      'edit',
      'quote',
      'share',
      'copy',
      'delete',
    ])
    expect(detail.estimatedHeight).toBeGreaterThan(0)
    expect(hapticTap).toHaveBeenCalledWith('light')
  })

  it('external menu mode emits a tag menu request and latches the lifted tag until closed', async () => {
    const hapticTap = vi.fn()
    mockHapticTap(hapticTap)
    const options = await captureComponentOptions(() => import('../index'))
    const rect = { top: 120, right: 160, bottom: 152, left: 96, width: 64, height: 32 }
    const query = createRectQuery(rect)
    const instance = createComponentInstance(options, {
      memoId: 18,
      tags: ['工作'],
      viewerRole: 'self',
      externalMenu: true,
      externalMenuActive: false,
      liftedTagIdx: -1,
    }) as any
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })
    syncPermissionsAndMenu(options, instance)
    instance.triggerEvent = vi.fn()

    instance.handleTagLongPress({
      currentTarget: { dataset: { tag: '工作', tagIdx: 0 } },
    })

    expect(instance.data.menuActive).toBe(false)
    expect(instance.data.liftedTagIdx).toBe(0)
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'menuopen',
      expect.objectContaining({
        memoId: 18,
        mode: 'tag',
        tag: '工作',
        triggerRect: rect,
        placementPriority: 'up-first',
        horizontalAlign: 'start',
        scaleAnchor: 'start',
        header: '工作',
      }),
    )
    const detail = (instance.triggerEvent as any).mock.calls[0][1]
    expect(detail.items.map((item: { id: string }) => item.id)).toEqual([
      'tag-edit',
      'tag-add',
      'tag-remove',
    ])

    options.observers?.externalMenuActive?.call(instance, false)

    expect(instance.data.liftedTagIdx).toBe(-1)
    expect(hapticTap).toHaveBeenCalledWith('light')
  })

  it('keeps card long-press menu opening lifted', async () => {
    mockHapticTap(vi.fn())
    const options = await captureComponentOptions(() => import('../index'))
    const query = createRectQuery({
      top: 20,
      right: 340,
      bottom: 56,
      left: 304,
      width: 36,
      height: 36,
    })
    const instance = createComponentInstance(options, {
      tags: ['工作'],
      viewerRole: 'self',
      lifted: false,
      menuActive: false,
    }) as any
    Object.assign(instance, options.methods, {
      createSelectorQuery: vi.fn(() => query),
    })
    syncPermissionsAndMenu(options, instance)

    instance.handleMoreTap()

    expect(instance.data.menuActive).toBe(true)
    expect(instance.data.lifted).toBe(true)
  })
})
