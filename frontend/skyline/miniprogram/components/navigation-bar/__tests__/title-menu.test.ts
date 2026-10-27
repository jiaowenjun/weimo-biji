import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxmlPath = path.join(__dirname, '..', 'navigation-bar.wxml')
const wxssPath = path.join(__dirname, '..', 'navigation-bar.wxss')

type ComponentOptions = {
  data?: Record<string, unknown>
  methods?: Record<string, (...args: any[]) => void>
}

async function loadComponentOptions() {
  let captured: ComponentOptions | undefined

  vi.stubGlobal('Component', (options: ComponentOptions) => {
    captured = options
  })

  await import('../navigation-bar')

  if (!captured) {
    throw new Error('Component options were not captured')
  }

  return captured
}

function createInstance(options: ComponentOptions, data: Record<string, unknown> = {}) {
  const instance: Record<string, any> = {
    data: {
      ...(options.data ?? {}),
      ...data,
    },
    setData(patch: Record<string, unknown>) {
      this.data = { ...this.data, ...patch }
    },
    triggerEvent: vi.fn(),
  }

  Object.assign(instance, options.methods ?? {})
  return instance
}

function createRectQuery(rect: Record<string, unknown>) {
  const query: Record<string, any> = {
    in: vi.fn(() => query),
    select: vi.fn(() => query),
    boundingClientRect: vi.fn(() => query),
    exec: vi.fn((cb: (res: any[]) => void) => cb([rect])),
  }
  return query
}

describe('navigation-bar title menu', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('does nothing when titleMenuItems is empty', async () => {
    vi.doMock('../../../utils/haptic', () => ({
      hapticTap: vi.fn(),
    }))

    const options = await loadComponentOptions()
    const instance = createInstance(options, {
      titleMenuItems: [],
      titleMenuActive: false,
      titleMenuAnchorRect: null,
    })
    const query = createRectQuery({
      top: 20, right: 220, bottom: 44, left: 140, width: 80, height: 24,
    })
    instance.createSelectorQuery = vi.fn(() => query)

    instance.handleTitleTap()

    expect(instance.createSelectorQuery).not.toHaveBeenCalled()
    expect(instance.data.titleMenuActive).toBe(false)
  })

  it('measures title rect and opens the menu when items exist', async () => {
    const hapticTap = vi.fn()
    vi.doMock('../../../utils/haptic', () => ({
      hapticTap,
    }))

    const options = await loadComponentOptions()
    const rect = {
      top: 20, right: 220, bottom: 44, left: 140, width: 80, height: 24,
    }
    const instance = createInstance(options, {
      titleMenuItems: [{ id: 'refresh', label: '刷新' }],
      titleMenuActive: false,
      titleMenuAnchorRect: null,
    })
    const query = createRectQuery(rect)
    instance.createSelectorQuery = vi.fn(() => query)

    instance.handleTitleTap()

    expect(instance.createSelectorQuery).toHaveBeenCalledTimes(1)
    expect(hapticTap).toHaveBeenCalledWith('light')
    expect(instance.data.titleMenuActive).toBe(true)
    expect(instance.data.titleMenuAnchorRect).toEqual(rect)
  })

  it('closes the menu and emits titlemenuselect on item select', async () => {
    vi.doMock('../../../utils/haptic', () => ({
      hapticTap: vi.fn(),
    }))

    const options = await loadComponentOptions()
    const instance = createInstance(options, {
      titleMenuItems: [{ id: 'refresh', label: '刷新' }],
      titleMenuActive: true,
      titleMenuAnchorRect: {
        top: 20, right: 220, bottom: 44, left: 140, width: 80, height: 24,
      },
    })

    instance.handleTitleMenuSelect({
      detail: {
        id: 'refresh',
        item: { id: 'refresh', label: '刷新' },
      },
    })

    expect(instance.data.titleMenuActive).toBe(false)
    expect(instance.data.titleMenuAnchorRect).toBeNull()
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'titlemenuselect',
      {
        id: 'refresh',
        item: { id: 'refresh', label: '刷新' },
      },
      {},
    )
  })
})

describe('navigation-bar title menu presentation', () => {
  it('renders chevron-down for clickable titles and uses the refined chevron spacing and size', () => {
    const wxml = readFileSync(wxmlPath, 'utf8')
    const wxss = readFileSync(wxssPath, 'utf8')

    expect(wxml).toMatch(/iconfont--chevron-down/)
    expect(wxml).toMatch(/wx:if="\{\{titleMenuItems.length\}\}"/)
    expect(wxss).toMatch(
      /\.weui-navigation-bar__title-chevron\s*\{[\s\S]*?margin-left:\s*4rpx\s*;[\s\S]*?font-size:\s*var\(--font-size-base\)\s*;[\s\S]*?color:\s*var\(--color-text-placeholder\)\s*;/,
    )
  })
})
