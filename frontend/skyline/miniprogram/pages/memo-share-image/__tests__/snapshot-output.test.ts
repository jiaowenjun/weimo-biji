import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY } from '../memo-share-image-prefs'

async function capturePageOptions() {
  let captured: any
  vi.stubGlobal('wx', {
    env: { USER_DATA_PATH: '/tmp/weimo' },
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    getFileSystemManager: vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn((opts) => opts.success()),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    })),
    createSelectorQuery: vi.fn(),
    showToast: vi.fn(),
    showShareImageMenu: vi.fn(),
    loadFontFace: vi.fn((opts) => opts.success?.()),
    downloadFile: vi.fn(() => ({ onProgressUpdate: vi.fn(), abort: vi.fn() })),
  })

  vi.stubGlobal('Page', (options: any) => {
    captured = options
  })

  await import('../index')
  return captured
}

function createPageInstance(options: any) {
  return {
    ...options,
    data: { ...options.data },
    setData(patch: Record<string, unknown>, callback?: () => void) {
      this.data = { ...this.data, ...patch }
      callback?.()
    },
  }
}

function createCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ownerUsername: '',
    createdAtText: '2026-05-02 18:31',
    content: 'content',
    contentNodes: [],
    tags: ['tag'],
    referenceId: null,
    referencePreview: null,
    referencedByPreviews: [],
    exiting: false,
    renderRichText: false,
    ...overrides,
  }
}

function mockSnapshotNode(takeSnapshot: ReturnType<typeof vi.fn>) {
  return {
    select: vi.fn(() => ({
      node: vi.fn(() => ({
        exec: vi.fn((callback: (res: unknown[]) => void) => callback([{ node: { takeSnapshot } }])),
      })),
    })),
  }
}

function createRectQuery(rect: Record<string, unknown>) {
  const query: Record<string, any> = {
    select: vi.fn(() => query),
    boundingClientRect: vi.fn(() => query),
    exec: vi.fn((cb: (res: any[]) => void) => cb([rect])),
  }
  return query
}

function assignFontTimerFields(page: any) {
  Object.assign(page, {
    _downloadTask: null,
    _fontProgress: null,
  })
}

describe('memo-share-image snapshot output', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses tempFilePath when snapshot returns a file path', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    page.resolveSnapshotFilePath({ tempFilePath: 'wxfile://poster.png' }, onSuccess, onFail)

    expect(onSuccess).toHaveBeenCalledWith('wxfile://poster.png')
    expect(onFail).not.toHaveBeenCalled()
  })

  it('writes arraybuffer snapshot data to a local png file', async () => {
    const writeFile = vi.fn((opts) => opts.success())
    const options = await capturePageOptions()
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({ writeFile }))
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const page = createPageInstance(options)
    const onSuccess = vi.fn()
    const onFail = vi.fn()
    const data = new ArrayBuffer(8)

    page.resolveSnapshotFilePath({ data }, onSuccess, onFail)

    expect(writeFile).toHaveBeenCalledWith({
      filePath: '/tmp/weimo/memo_share_123.png',
      data,
      encoding: 'binary',
      success: expect.any(Function),
      fail: expect.any(Function),
    })
    expect(onSuccess).toHaveBeenCalledWith('/tmp/weimo/memo_share_123.png')
    expect(onFail).not.toHaveBeenCalled()
  })

  it('requests arraybuffer output from snapshot in the capture callback chain', async () => {
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    const page = createPageInstance(options)

    page.runSnapshotCapture({
      onSuccess: vi.fn(),
      onFail: vi.fn(),
    })

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      type: 'arraybuffer',
      format: 'png',
    }))
  })

  it('starts with default font and combined visibility menu', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)

    page.syncPopoverMenus()

    expect(page.data.shareFontId).toBe('default')
    expect(page.data.shareOptions).toEqual({
      showTags: true,
      showNickname: true,
      showDate: true,
      showBrand: true,
    })
    expect(page.data.visibilityMenuItems).toEqual([
      expect.objectContaining({ id: 'toggle-tags', label: '显示标签', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-nickname', label: '显示昵称', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-brand', label: '显示 weimo 标志', icon: 'check' }),
      expect.objectContaining({
        id: 'toggle-lunar-date',
        label: '使用农历日期',
        icon: undefined,
        dividerBefore: true,
      }),
      expect.objectContaining({
        id: 'toggle-large-text',
        label: '使用大字号',
        icon: undefined,
        dividerBefore: false,
      }),
      expect.objectContaining({
        id: 'toggle-print-font',
        label: '京华老宋体',
        icon: undefined,
        dividerBefore: false,
        description: '首次使用需下载字体',
      }),
    ])
  })

  it('triggers light haptic and opens the visibility menu from the nav adjustment button', async () => {
    const hapticTap = vi.fn()
    vi.doMock('../../../utils/haptic', () => ({ hapticTap }))

    const options = await capturePageOptions()
    const page = createPageInstance(options)
    const rect = {
      top: 24, right: 320, bottom: 56, left: 264, width: 56, height: 32,
    }
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => createRectQuery(rect))

    page.handleVisibilityMenuTap()

    expect(hapticTap).toHaveBeenCalledWith('light')
    expect(page.data.visibilityMenuActive).toBe(true)
    expect(page.data.visibilityMenuAnchorRect).toEqual(rect)
    expect(page.data.visibilityMenuItems.length).toBeGreaterThan(0)
  })

  it('shows print font download hint until font is ready', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    page.syncPopoverMenus()
    let printItem = page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-print-font')
    expect(printItem?.description).toBe('首次使用需下载字体')

    page.data = { ...page.data, printFontStatus: 'ready' }
    page.syncPopoverMenus()
    printItem = page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-print-font')
    expect(printItem?.description).toBeUndefined()

    page.data = { ...page.data, printFontStatus: 'downloading' }
    page.syncPopoverMenus()
    printItem = page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-print-font')
    expect(printItem?.description).toBe('首次使用需下载字体')

    page.data = { ...page.data, printFontStatus: 'error' }
    page.syncPopoverMenus()
    printItem = page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-print-font')
    expect(printItem?.description).toBe('首次使用需下载字体')
  })

  it('switches from print font to default font without pre-generating preview', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), shareFontId: 'print', printFontStatus: 'ready', printFontProgress: 100 }

    page.applyShareMenuAction('toggle-print-font')

    expect(page.data.shareFontId).toBe('default')
    expect(page.data.shareOptions).toEqual({
      showTags: true,
      showNickname: true,
      showDate: true,
      showBrand: true,
    })
    expect(page.data.visibilityMenuItems).toEqual([
      expect.objectContaining({ id: 'toggle-tags', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-nickname', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-brand', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-lunar-date', icon: undefined, dividerBefore: true }),
      expect.objectContaining({ id: 'toggle-large-text', icon: undefined, dividerBefore: false }),
      expect.objectContaining({ id: 'toggle-print-font', icon: undefined, dividerBefore: false }),
    ])
  })

  it('toggles visibility options and unchecks when element hidden', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    page.data = { ...page.data, card: createCard() }

    page.applyShareMenuAction('toggle-tags')

    expect(page.data.shareOptions.showTags).toBe(false)
    expect(page.data.visibilityMenuItems).toEqual([
      expect.objectContaining({ id: 'toggle-tags', icon: undefined }),
      expect.objectContaining({ id: 'toggle-nickname', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-brand', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-lunar-date', icon: undefined, dividerBefore: true }),
      expect.objectContaining({ id: 'toggle-large-text', icon: undefined, dividerBefore: false }),
      expect.objectContaining({
        id: 'toggle-print-font',
        icon: undefined,
        dividerBefore: false,
        description: '首次使用需下载字体',
      }),
    ])
  })

  it('enters ready state without scheduling preview snapshot on init', async () => {
    const sessionApi = await import('../../../utils/session')
    vi.spyOn(sessionApi, 'hasSession').mockReturnValue(true)
    vi.spyOn(sessionApi, 'getSession').mockReturnValue({
      accessToken: 'a',
      refreshToken: 'r',
      user: { username: 'wenjun', nickname: 'wenjun' },
    })

    const options = await capturePageOptions()
    const page = createPageInstance(options)
    const eventHandler = vi.fn()
    page.getOpenerEventChannel = vi.fn(() => ({
      on: eventHandler,
    }))

    page.bindInitChannel()
    eventHandler.mock.calls[0][1]({ card: createCard({ createdAtText: '2026-05-02 18:31' }) })

    expect(page.data.sharePaperDateText).toBe('2026/05/02')
    expect(page.data.shareNickname).toBe('wenjun')
    expect(page.data.status).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)
    expect(page.data.previewPath).toBe('')
  })

  it('uses 游客 as share nickname without session when card has no ownerUsername', async () => {
    const sessionApi = await import('../../../utils/session')
    vi.spyOn(sessionApi, 'hasSession').mockReturnValue(false)
    vi.spyOn(sessionApi, 'getSession').mockReturnValue({
      accessToken: null,
      refreshToken: null,
      user: null,
    })

    const options = await capturePageOptions()
    const page = createPageInstance(options)
    const eventHandler = vi.fn()
    page.getOpenerEventChannel = vi.fn(() => ({
      on: eventHandler,
    }))

    page.bindInitChannel()
    eventHandler.mock.calls[0][1]({ card: createCard({ ownerUsername: '' }) })

    expect(page.data.shareNickname).toBe('游客')
  })

  it('toggles the nickname option and persists the new pref', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    const setStorageSync = (globalThis as any).wx.setStorageSync as ReturnType<typeof vi.fn>
    setStorageSync.mockClear()
    page.data = {
      ...page.data,
      card: createCard(),
      shareOptions: {
        showTags: true,
        showNickname: true,
        showDate: true,
        showBrand: true,
      },
    }
    page.applyShareMenuAction('toggle-nickname')

    expect(page.data.shareOptions.showNickname).toBe(false)
    expect(setStorageSync).toHaveBeenCalledWith(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY, {
      shareFontId: 'default',
      showTags: true,
      showNickname: false,
      showBrand: true,
      shareLargeText: false,
      shareLunarDate: false,
    })
  })

  it('generates snapshot and opens share menu when sending', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    const showShareImageMenu = vi.fn((opts: { complete?: () => void }) => {
      opts.complete?.()
    })
    ;(globalThis as any).wx.showShareImageMenu = showShareImageMenu

    const page = createPageInstance(options)
    Object.assign(page, {
      _shareMenuOpen: false,
      _shareCaptureBusy: false,
    })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false }

    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      type: 'arraybuffer',
      format: 'png',
    }))
    expect(showShareImageMenu).toHaveBeenCalledWith(expect.objectContaining({
      path: 'wxfile://poster.png',
      needShowEntrance: true,
      entrancePath: 'pages/memo-reference-detail/index?entry=share&memoId=1',
    }))
    expect(page.data.status).toBe('ready')

    vi.useRealTimers()
  })

  it('does not show an error toast when user cancels the share image menu', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const showToast = vi.fn()
    ;(globalThis as any).wx.showToast = showToast
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    ;(globalThis as any).wx.showShareImageMenu = vi.fn((opts) => {
      opts.fail({ errMsg: 'showShareImageMenu:fail cancel' })
      opts.complete?.()
    })
    const page = createPageInstance(options)
    Object.assign(page, {
      _shareMenuOpen: false,
      _shareCaptureBusy: false,
    })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false }

    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(showToast).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('ignores duplicate share taps while the share image menu is open', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    const showShareImageMenu = vi.fn()
    ;(globalThis as any).wx.showShareImageMenu = showShareImageMenu

    const page = createPageInstance(options)
    Object.assign(page, {
      _shareMenuOpen: false,
      _shareCaptureBusy: false,
    })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false }

    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)
    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(takeSnapshot).toHaveBeenCalledTimes(1)
    expect(showShareImageMenu).toHaveBeenCalledTimes(1)

    showShareImageMenu.mock.calls[0][0].complete()
    vi.advanceTimersByTime(200)
    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(takeSnapshot).toHaveBeenCalledTimes(2)
    expect(showShareImageMenu).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('ignores a second tap while snapshot for share is in progress', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn()
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    const page = createPageInstance(options)
    Object.assign(page, {
      _shareMenuOpen: false,
      _shareCaptureBusy: false,
    })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false }

    page.handleShareToFriendTap()
    page.handleShareToFriendTap()

    vi.advanceTimersByTime(200)

    expect(takeSnapshot).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('enables print font and shows check on menu item', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')

    expect(page.data.shareFontId).toBe('print')
    expect(page.data.shareOptions).toEqual({
      showTags: true,
      showNickname: true,
      showDate: true,
      showBrand: true,
    })
    expect(page.data.visibilityMenuItems).toEqual([
      expect.objectContaining({ id: 'toggle-tags', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-nickname', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-brand', icon: 'check' }),
      expect.objectContaining({ id: 'toggle-lunar-date', icon: undefined, dividerBefore: true }),
      expect.objectContaining({ id: 'toggle-large-text', icon: undefined, dividerBefore: false }),
      expect.objectContaining({ id: 'toggle-print-font', icon: 'check', dividerBefore: false }),
    ])
  })

  it('triggers font download when switching to print template with cache miss', async () => {
    const options = await capturePageOptions()
    const accessFail = vi.fn((opts) => opts.fail())
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort: vi.fn() }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: accessFail,
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')

    expect(page.data.shareFontId).toBe('print')
    expect(page.data.actionDisabled).toBe(true)
    expect(accessFail).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tmp/weimo/JingHuaLaoSong.ttf',
    }))
    expect(downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://weimo.ink/fonts/%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v3.0.ttf',
      filePath: '/tmp/weimo/JingHuaLaoSong.ttf',
      timeout: 120000,
    }))
    expect(page.data.printFontStatus).toBe('downloading')
  })

  it('loads font from cache when file exists locally', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const accessSuccess = vi.fn((opts) => opts.success())
    const loadFontFace = vi.fn((opts) => opts.complete?.())
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: accessSuccess,
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.loadFontFace = loadFontFace
    const downloadFile = vi.fn()
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    vi.advanceTimersByTime(2000)

    expect(downloadFile).not.toHaveBeenCalled()
    expect(loadFontFace).toHaveBeenCalledWith(expect.objectContaining({
      family: 'JingHuaLaoSong',
      source: 'url("/tmp/weimo/JingHuaLaoSong.ttf")',
    }))
    expect(page.data.printFontProgress).toBe(100)
    expect(page.data.printFontStatus).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)

    vi.useRealTimers()
  })

  it('starts progress animation when switching to print template with cache miss', async () => {
    const options = await capturePageOptions()
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort: vi.fn() }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')

    expect(page.data.printFontStatus).toBe('downloading')
    expect(page.data.actionDisabled).toBe(true)
  })

  it('times out and shows error after 120 seconds', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const abort = vi.fn()
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    vi.advanceTimersByTime(121000)

    expect(page.data.printFontStatus).toBe('error')
    expect(page.data.actionDisabled).toBe(true)
    expect(abort).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('sets ready state on download success', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    let downloadSuccess: ((res: any) => void) | null = null
    const downloadFile = vi.fn((opts) => {
      downloadSuccess = opts.success
      return { onProgressUpdate: vi.fn(), abort: vi.fn() }
    })
    const loadFontFace = vi.fn((opts) => opts.complete?.())
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile
    ;(globalThis as any).wx.loadFontFace = loadFontFace

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    downloadSuccess!({ statusCode: 200, tempFilePath: '', filePath: '/tmp/weimo/JingHuaLaoSong.ttf' })
    vi.advanceTimersByTime(2000)

    expect(page.data.printFontProgress).toBe(100)
    expect(page.data.printFontStatus).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)

    vi.useRealTimers()
  })

  it('clears all timers when switching away from print template', async () => {
    const options = await capturePageOptions()
    const abort = vi.fn()
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    expect(page.data.printFontStatus).toBe('downloading')

    page.applyShareMenuAction('toggle-print-font')
    expect(abort).toHaveBeenCalled()
    expect(page.data.printFontStatus).toBe('idle')
  })

  it('sets ready state quickly on cache hit', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const loadFontFace = vi.fn((opts) => opts.complete?.())
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.success()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.loadFontFace = loadFontFace
    ;(globalThis as any).wx.downloadFile = vi.fn()

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    vi.advanceTimersByTime(2000)

    expect(page.data.printFontProgress).toBe(100)
    expect(page.data.printFontStatus).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)

    vi.useRealTimers()
  })

  it('caches font and registers it after successful download', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    let downloadSuccess: ((res: { statusCode: number; tempFilePath: string; filePath: string }) => void) | null = null
    const downloadFile = vi.fn((opts) => {
      downloadSuccess = opts.success
      return { onProgressUpdate: vi.fn(), abort: vi.fn() }
    })
    const loadFontFace = vi.fn((opts) => opts.complete?.())
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile
    ;(globalThis as any).wx.loadFontFace = loadFontFace

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    downloadSuccess!({ statusCode: 200, tempFilePath: '', filePath: '/tmp/weimo/JingHuaLaoSong.ttf' })
    vi.advanceTimersByTime(2000)

    expect(loadFontFace).toHaveBeenCalledWith(expect.objectContaining({
      family: 'JingHuaLaoSong',
      source: 'url("/tmp/weimo/JingHuaLaoSong.ttf")',
    }))
    expect(page.data.printFontProgress).toBe(100)
    expect(page.data.printFontStatus).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)

    vi.useRealTimers()
  })

  it('sets error state when download fails', async () => {
    const options = await capturePageOptions()
    let downloadFail: (() => void) | null = null
    const downloadFile = vi.fn((opts) => {
      downloadFail = opts.fail
      return { onProgressUpdate: vi.fn(), abort: vi.fn() }
    })
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    downloadFail!()

    expect(page.data.printFontStatus).toBe('error')
    expect(page.data.actionDisabled).toBe(true)
  })

  it('sets ready state via complete callback even if loadFontFace reports failure', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const loadFontFace = vi.fn((opts) => opts.complete?.())
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.success()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.loadFontFace = loadFontFace

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    vi.advanceTimersByTime(2000)

    expect(page.data.printFontProgress).toBe(100)
    expect(page.data.printFontStatus).toBe('ready')
    expect(page.data.actionDisabled).toBe(false)

    vi.useRealTimers()
  })

  it('retry resets state and re-triggers font preparation', async () => {
    const options = await capturePageOptions()
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort: vi.fn() }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn((opts) => opts.success()),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), shareFontId: 'print', printFontStatus: 'error', printFontProgress: 0 }

    page.handlePrintFontRetry()

    expect(page.data.printFontStatus).toBe('downloading')
    expect(downloadFile).toHaveBeenCalled()
  })

  it('aborts download when switching away from print template', async () => {
    const options = await capturePageOptions()
    const abort = vi.fn()
    const downloadFile = vi.fn(() => ({ onProgressUpdate: vi.fn(), abort }))
    ;(globalThis as any).wx.getFileSystemManager = vi.fn(() => ({
      access: vi.fn((opts) => opts.fail()),
      copyFile: vi.fn(),
      unlink: vi.fn(),
      writeFile: vi.fn((opts) => opts.success()),
    }))
    ;(globalThis as any).wx.downloadFile = downloadFile

    const page = createPageInstance(options)
    assignFontTimerFields(page)
    page.data = { ...page.data, card: createCard(), printFontStatus: 'idle', printFontProgress: 0 }

    page.applyShareMenuAction('toggle-print-font')
    expect(page.data.printFontStatus).toBe('downloading')

    page.applyShareMenuAction('toggle-print-font')
    expect(abort).toHaveBeenCalled()
    expect(page.data.printFontStatus).toBe('idle')
    expect(page.data.actionDisabled).toBe(false)
  })

  it('blocks share tap when print font is not ready', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))

    const page = createPageInstance(options)
    Object.assign(page, { _shareMenuOpen: false, _shareCaptureBusy: false, _downloadTask: null })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false, shareFontId: 'print', printFontStatus: 'downloading', printFontProgress: 50 }

    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(takeSnapshot).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('allows share when print font status is ready', async () => {
    vi.useFakeTimers()
    const options = await capturePageOptions()
    const takeSnapshot = vi.fn((opts) => opts.success({ tempFilePath: 'wxfile://poster.png' }))
    ;(globalThis as any).wx.createSelectorQuery = vi.fn(() => mockSnapshotNode(takeSnapshot))
    ;(globalThis as any).wx.showShareImageMenu = vi.fn((opts) => opts.complete?.())

    const page = createPageInstance(options)
    Object.assign(page, { _shareMenuOpen: false, _shareCaptureBusy: false, _downloadTask: null })
    page.data = { ...page.data, card: createCard(), status: 'ready', actionDisabled: false, shareFontId: 'print', printFontStatus: 'ready', printFontProgress: 100 }

    page.handleShareToFriendTap()
    vi.advanceTimersByTime(200)

    expect(takeSnapshot).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('restores shareFontId and visibility from storage on init', async () => {
    vi.resetModules()
    vi.unstubAllGlobals()
    const prefs = {
      shareFontId: 'default' as const,
      showTags: false,
      showNickname: true,
      showBrand: false,
      shareLargeText: true,
      shareLunarDate: true,
    }
    const getStorageSync = vi.fn((key: string) =>
      key === MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY ? prefs : undefined,
    )
    vi.stubGlobal('wx', {
      env: { USER_DATA_PATH: '/tmp/weimo' },
      getStorageSync,
      setStorageSync: vi.fn(),
      getFileSystemManager: vi.fn(() => ({
        access: vi.fn((opts) => opts.fail()),
        copyFile: vi.fn((opts) => opts.success()),
        unlink: vi.fn(),
        writeFile: vi.fn((opts) => opts.success()),
      })),
      createSelectorQuery: vi.fn(),
      showToast: vi.fn(),
      showShareImageMenu: vi.fn(),
      loadFontFace: vi.fn((opts) => opts.success?.()),
      downloadFile: vi.fn(() => ({ onProgressUpdate: vi.fn(), abort: vi.fn() })),
    })
    let captured: any
    vi.stubGlobal('Page', (options: any) => {
      captured = options
    })
    await import('../index')
    const page = createPageInstance(captured)
    const eventHandler = vi.fn()
    page.getOpenerEventChannel = vi.fn(() => ({ on: eventHandler }))
    page.bindInitChannel()
    eventHandler.mock.calls[0][1]({ card: createCard() })

    expect(page.data.shareFontId).toBe('default')
    expect(page.data.shareOptions).toEqual({
      showTags: false,
      showNickname: true,
      showDate: true,
      showBrand: false,
    })
    expect(page.data.shareLargeText).toBe(true)
    expect(page.data.shareLunarDate).toBe(true)
    expect(page.data.sharePaperDateText).toBe('丙午年三月十六')
  })

  it('persists visibility toggles to storage', async () => {
    const options = await capturePageOptions()
    const setStorageSync = (globalThis as any).wx.setStorageSync as ReturnType<typeof vi.fn>
    setStorageSync.mockClear()

    const page = createPageInstance(options)
    page.data = { ...page.data, card: createCard() }

    page.applyShareMenuAction('toggle-tags')

    expect(setStorageSync).toHaveBeenCalledWith(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY, {
      shareFontId: 'default',
      showTags: false,
      showNickname: true,
      showBrand: true,
      shareLargeText: false,
      shareLunarDate: false,
    })
  })

  it('toggles large text and persists shareLargeText', async () => {
    const options = await capturePageOptions()
    const setStorageSync = (globalThis as any).wx.setStorageSync as ReturnType<typeof vi.fn>
    setStorageSync.mockClear()
    const page = createPageInstance(options)
    page.data = { ...page.data, card: createCard() }

    page.applyShareMenuAction('toggle-large-text')

    expect(page.data.shareLargeText).toBe(true)
    expect(setStorageSync).toHaveBeenCalledWith(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY, {
      shareFontId: 'default',
      showTags: true,
      showNickname: true,
      showBrand: true,
      shareLargeText: true,
      shareLunarDate: false,
    })
    expect(page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-large-text')).toEqual(
      expect.objectContaining({ icon: 'check' }),
    )
  })

  it('toggles lunar date format and persists shareLunarDate', async () => {
    const options = await capturePageOptions()
    const setStorageSync = (globalThis as any).wx.setStorageSync as ReturnType<typeof vi.fn>
    setStorageSync.mockClear()
    const page = createPageInstance(options)
    page.data = { ...page.data, card: createCard({ createdAtText: '2026-05-07 12:00' }) }

    page.applyShareMenuAction('toggle-lunar-date')

    expect(page.data.shareLunarDate).toBe(true)
    expect(page.data.sharePaperDateText).toBe('丙午年三月廿一')
    expect(setStorageSync).toHaveBeenCalledWith(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY, {
      shareFontId: 'default',
      showTags: true,
      showNickname: true,
      showBrand: true,
      shareLargeText: false,
      shareLunarDate: true,
    })
    expect(page.data.visibilityMenuItems.find((i: { id: string }) => i.id === 'toggle-lunar-date')).toEqual(
      expect.objectContaining({ icon: 'check' }),
    )
  })

  it('keeps tag and brand visibility after toggles when default font stays selected', async () => {
    const options = await capturePageOptions()
    const page = createPageInstance(options)
    page.data = { ...page.data, card: createCard() }

    page.applyShareMenuAction('toggle-tags')
    page.applyShareMenuAction('toggle-brand')

    expect(page.data.shareOptions).toEqual({
      showTags: false,
      showNickname: true,
      showDate: true,
      showBrand: false,
    })
  })
})
