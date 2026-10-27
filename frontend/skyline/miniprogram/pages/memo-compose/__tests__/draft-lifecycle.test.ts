import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMemoMock = vi.fn()
const updateMemoMock = vi.fn()
const hapticTapMock = vi.fn()
const showToastMock = vi.fn()
const navigateBackMock = vi.fn()

vi.mock('../../../store/store-bindings/workspace-store.instance', () => ({
  workspaceStore: {
    createMemo: (...args: unknown[]) => createMemoMock(...args),
    updateMemo: (...args: unknown[]) => updateMemoMock(...args),
  },
}))

vi.mock('../../../utils/haptic', () => ({
  hapticTap: (...args: unknown[]) => hapticTapMock(...args),
}))

type MemoComposePageConfig = {
  data: Record<string, unknown>
  onLoad: (query: Record<string, string | undefined>) => void
  onHide?: () => void
  onUnload: () => void
  updateCanSave: () => void
  handleSave: () => Promise<void>
  cancelPendingToolbarRecompute: () => void
  recomputeToolbarState: () => void
}

function seedSession(storage: Map<string, unknown>, username = 'alice') {
  storage.set('biji-skyline.session', {
    accessToken: 'token',
    refreshToken: 'refresh',
    user: {
      username,
      nickname: 'Alice',
      login_name: username,
      has_login_password: true,
    },
  })
}

function buildContextKey(input: { initialRefs: string[]; initialTags: string[] }) {
  return input.initialRefs.length > 0
    ? JSON.stringify({ refs: input.initialRefs })
    : JSON.stringify({ initialTags: input.initialTags })
}

function makeEventChannel() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    emit: vi.fn(),
    on: vi.fn((name: string, handler: (payload: unknown) => void) => {
      handlers.set(name, handler)
    }),
    trigger(name: string, payload: unknown) {
      const handler = handlers.get(name)
      if (!handler) throw new Error(`missing handler for ${name}`)
      handler(payload)
    },
  }
}

async function loadPageConfig(): Promise<MemoComposePageConfig> {
  let captured: MemoComposePageConfig | undefined
  vi.stubGlobal('Page', (options: MemoComposePageConfig) => {
    captured = options
  })

  await import('../index')

  if (!captured) throw new Error('memo-compose page config was not captured')
  return captured
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as T
  }
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as T
  }
  return value
}

function makeInstance(
  pageConfig: MemoComposePageConfig & Record<string, unknown>,
  eventChannel = makeEventChannel(),
) {
  const instance: Record<string, unknown> = {
    data: cloneValue(pageConfig.data),
    setData: vi.fn((patch: Record<string, unknown>, callback?: () => void) => {
      instance.data = {
        ...(instance.data as Record<string, unknown>),
        ...patch,
      }
      callback?.()
    }),
    getOpenerEventChannel: vi.fn(() => eventChannel as unknown as WechatMiniprogram.EventChannel),
    eventChannel,
  }

  Object.entries(pageConfig).forEach(([key, value]) => {
    if (key === 'data') return
    if (typeof value === 'function') {
      instance[key] = (...args: unknown[]) => (value as (...inner: unknown[]) => unknown).apply(instance, args)
      return
    }
    instance[key] = cloneValue(value)
  })

  return instance as MemoComposePageConfig & Record<string, any> & {
    eventChannel: ReturnType<typeof makeEventChannel>
  }
}

describe('memo-compose draft lifecycle', () => {
  const storage = new Map<string, unknown>()
  const getStorageSync = vi.fn((key: string) => storage.get(key))
  const setStorageSync = vi.fn((key: string, value: unknown) => {
    storage.set(key, value)
  })
  const removeStorageSync = vi.fn((key: string) => {
    storage.delete(key)
  })

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    storage.clear()
    seedSession(storage)
    createMemoMock.mockResolvedValue(undefined)
    updateMemoMock.mockResolvedValue(undefined)
    vi.stubGlobal('wx', {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
      getMenuButtonBoundingClientRect: () => ({
        top: 14,
        left: 320,
        height: 32,
        width: 88,
        right: 408,
        bottom: 46,
      }),
      getWindowInfo: () => ({
        screenHeight: 800,
        safeArea: { bottom: 760 },
        statusBarHeight: 20,
      }),
      showToast: showToastMock,
      navigateBack: navigateBackMock,
    })
  })

  it('restores the matching create draft after opener init while keeping payload refs and preview text', async () => {
    storage.set('biji-skyline.memo-compose.create-draft.alice', {
      version: 1,
      entries: [
        {
          contextKey: buildContextKey({ initialRefs: ['7'], initialTags: ['旧标签'] }),
          content: 'quoted draft',
          selectedTags: ['无', '恢复标签'],
          referencePreviewText: 'draft preview',
          updatedAt: 100,
        },
        {
          contextKey: buildContextKey({ initialRefs: [], initialTags: ['工作'] }),
          content: 'plain draft',
          selectedTags: ['工作'],
          referencePreviewText: '',
          updatedAt: 200,
        },
      ],
    })

    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig as MemoComposePageConfig & Record<string, unknown>)

    instance.onLoad({ mode: 'create', quote: '1' })
    instance.eventChannel.trigger('memo-compose-init', {
      mode: 'create',
      initialContent: '',
      initialTags: ['旧标签'],
      initialRefs: ['7'],
      initialReferencePreview: 'payload preview',
    })

    expect(instance.data.content).toBe('quoted draft')
    expect(instance.data.selectedTags).toEqual(['无', '恢复标签'])
    expect(instance.data.tagChipsForEditor).toEqual(['恢复标签'])
    expect(instance.data.refs).toEqual(['7'])
    expect(instance.data.referenceId).toBe('7')
    expect(instance.data.referencePreviewText).toBe('payload preview')
    expect(instance.data.canSave).toBe(true)
  })

  it('clears only the current plain-create draft when the user leaves with empty content', async () => {
    storage.set('biji-skyline.memo-compose.create-draft.alice', {
      version: 1,
      entries: [
        {
          contextKey: buildContextKey({ initialRefs: [], initialTags: ['工作'] }),
          content: 'plain draft',
          selectedTags: ['工作'],
          referencePreviewText: '',
          updatedAt: 100,
        },
        {
          contextKey: buildContextKey({ initialRefs: ['7'], initialTags: [] }),
          content: 'quoted draft',
          selectedTags: ['引用'],
          referencePreviewText: 'quoted preview',
          updatedAt: 200,
        },
      ],
    })

    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig as MemoComposePageConfig & Record<string, unknown>)

    instance.onLoad({ mode: 'create' })
    instance.eventChannel.trigger('memo-compose-init', {
      mode: 'create',
      initialContent: '',
      initialTags: ['工作'],
      initialRefs: [],
      initialReferencePreview: '',
    })
    instance.setData({ content: '   ' })

    pageConfig.onHide?.call(instance)
    instance.onUnload()

    expect(storage.get('biji-skyline.memo-compose.create-draft.alice')).toEqual({
      version: 1,
      entries: [{
        contextKey: buildContextKey({ initialRefs: ['7'], initialTags: [] }),
        content: 'quoted draft',
        selectedTags: ['引用'],
        referencePreviewText: 'quoted preview',
        updatedAt: 200,
      }],
    })
  })

  it('clears the saved create draft and does not re-persist it during page hide after navigateBack', async () => {
    storage.set('biji-skyline.memo-compose.create-draft.alice', {
      version: 1,
      entries: [{
        contextKey: buildContextKey({ initialRefs: ['7'], initialTags: [] }),
        content: 'stale draft',
        selectedTags: ['旧标签'],
        referencePreviewText: 'quoted preview',
        updatedAt: 100,
      }],
    })

    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig as MemoComposePageConfig & Record<string, unknown>)

    instance.onLoad({ mode: 'create', quote: '1' })
    instance.eventChannel.trigger('memo-compose-init', {
      mode: 'create',
      initialContent: '',
      initialTags: [],
      initialRefs: ['7'],
      initialReferencePreview: 'payload preview',
    })
    instance.setData({
      content: '  final content  ',
      selectedTags: ['新标签'],
    })
    instance.updateCanSave()

    await instance.handleSave()
    pageConfig.onHide?.call(instance)

    expect(createMemoMock).toHaveBeenCalledWith({
      content: 'final content',
      tags: ['新标签'],
      refs: ['7'],
    })
    expect(storage.has('biji-skyline.memo-compose.create-draft.alice')).toBe(false)
    expect(navigateBackMock).toHaveBeenCalledWith({ delta: 1 })
  })
})
