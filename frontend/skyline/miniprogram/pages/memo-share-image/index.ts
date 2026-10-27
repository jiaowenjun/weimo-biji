import type { PopoverMenuItem } from '../../components/weimo-popover-menu/index'
import type { MemoCardItem } from '../../utils/memo-list-presentation'
import type { MemoShareImageInitPayload } from '../../utils/navigation'
import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'
import { hapticTap } from '../../utils/haptic'
import { getSession, hasSession } from '../../utils/session'
import { applyNavStatusBarStyle } from '../../utils/theme'
import { createPrintFontProgress } from './print-font-progress'
import type { PrintFontProgress } from './print-font-progress'
import { buildSharePaperDateText } from '../../utils/share-paper-lunar-date'
import { readMemoShareImagePrefs, writeMemoShareImagePrefs } from './memo-share-image-prefs'
import { buildShareEntrancePath } from '../../utils/routes'

type ShareStatus = 'waiting' | 'ready' | 'capturing' | 'error'
/** 分享图字体：`default` 为默认字体，`print` 为印刷字体（JingHuaLaoSong） */
type MemoShareFontId = 'default' | 'print'

interface MemoShareImageOptions {
  showTags: boolean
  showNickname: boolean
  showDate: boolean
  showBrand: boolean
}

type MemoSharePopoverActionId =
  | 'toggle-print-font'
  | 'toggle-tags'
  | 'toggle-brand'
  | 'toggle-lunar-date'
  | 'toggle-nickname'
  | 'toggle-large-text'

interface MemoShareImagePageData {
  card: MemoCardItem | null
  status: ShareStatus
  previewPath: string
  errorMessage: string
  /** 底栏在生成中/未就绪时禁用 */
  actionDisabled: boolean
  shareFontId: MemoShareFontId
  shareOptions: MemoShareImageOptions
  visibilityMenuActive: boolean
  visibilityMenuAnchorRect: WechatMiniprogram.BoundingClientRectCallbackResult | null
  visibilityMenuItems: PopoverMenuItem[]
  shareNickname: string
  /** 页脚日期：公历 YYYY/MM/DD 或农历（由 shareLunarDate 决定）。 */
  sharePaperDateText: string
  /** 页脚日期是否用农历 */
  shareLunarDate: boolean
  printFontStatus: 'idle' | 'downloading' | 'ready' | 'error'
  printFontProgress: number
  navOverlayHeight: number
  navStatusMaskHeight: number
  /** 分享图正文与页脚字级加大 */
  shareLargeText: boolean
}

interface SnapshotNode {
  takeSnapshot: (options: {
    type?: 'file' | 'arraybuffer'
    format?: string
    quality?: number
    success?: (res: SnapshotResult) => void
    fail?: (err: WechatMiniprogram.GeneralCallbackResult) => void
  }) => void
}

interface SnapshotResult {
  /** type=file 时官方返回该字段。 */
  tempFilePath?: string
  /** 部分基础库/工具仍可能返回二进制数据。 */
  data?: ArrayBuffer | string
}

interface ShareImageMenuOptionWithEntrance extends WechatMiniprogram.ShowShareImageMenuOption {
  /** 分享图片消息附带的小程序入口，基础库 3.2.0+ 支持。 */
  needShowEntrance?: boolean
  entrancePath?: string
}

interface MemoShareImagePageCustom {
  _eventChannel: WechatMiniprogram.EventChannel | null
  _shareMenuOpen: boolean
  _shareCaptureBusy: boolean
  _downloadTask: WechatMiniprogram.DownloadTask | null
  _fontProgress: PrintFontProgress | null
  bindInitChannel: () => void
  buildVisibilityMenuItems: () => PopoverMenuItem[]
  syncPopoverMenus: () => void
  handleClose: () => void
  handleVisibilityMenuTap: () => void
  handleVisibilityMenuClose: () => void
  handleVisibilityMenuSelect: (
    event: WechatMiniprogram.CustomEvent<{ id: MemoSharePopoverActionId }>
  ) => void
  applyShareMenuAction: (id: MemoSharePopoverActionId) => void
  scheduleSnapshotForShare: (callbacks: { onSuccess: (path: string) => void; onFail: () => void }) => void
  preparePrintFont: () => void
  _registerCachedFont: (fs: WechatMiniprogram.FileSystemManager) => void
  _downloadAndCacheFont: (fs: WechatMiniprogram.FileSystemManager) => void
  handlePrintFontRetry: () => void
  _ensureFontProgress: () => void
  runSnapshotCapture: (callbacks: { onSuccess: (path: string) => void; onFail: () => void }) => void
  resolveSnapshotFilePath: (
    result: SnapshotResult,
    onSuccess: (path: string) => void,
    onFail: () => void
  ) => void
  persistMemoShareImagePrefs: () => void
  handleShareToFriendTap: () => void
}

const SNAPSHOT_LAYOUT_DELAY_MS = 120

const SHARE_IMAGE_OPTIONS: MemoShareImageOptions = {
  showTags: true,
  showNickname: true,
  showDate: true,
  showBrand: true,
}

const PRINT_FONT_FAMILY = 'JingHuaLaoSong'
const PRINT_FONT_URL =
  'https://weimo.ink/fonts/%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v3.0.ttf'
const PRINT_FONT_CACHE_PATH = `${wx.env.USER_DATA_PATH}/JingHuaLaoSong.ttf`

function cloneShareOptions(options: MemoShareImageOptions): MemoShareImageOptions {
  return { ...options }
}

const SHARE_VISITOR_DISPLAY_NICKNAME = '游客'

/** 分享图署名：自建笔记用登录用户昵称/用户名；游客为「游客」。 */
function resolveShareDisplayNickname(): string {
  if (!hasSession()) return SHARE_VISITOR_DISPLAY_NICKNAME
  const user = getSession().user
  if (!user) return ''
  return String(user.nickname || user.username || '').trim()
}

Page<MemoShareImagePageData, MemoShareImagePageCustom>({
  data: {
    card: null,
    status: 'waiting',
    previewPath: '',
    errorMessage: '',
    actionDisabled: true,
    shareFontId: 'default',
    shareOptions: cloneShareOptions(SHARE_IMAGE_OPTIONS),
    visibilityMenuActive: false,
    visibilityMenuAnchorRect: null,
    visibilityMenuItems: [],
    shareNickname: '',
    sharePaperDateText: '',
    shareLunarDate: false,
    printFontStatus: 'idle' as const,
    printFontProgress: 0,
    navOverlayHeight: 0,
    navStatusMaskHeight: 0,
    shareLargeText: false,
  },

  _eventChannel: null,
  _shareMenuOpen: false,
  _shareCaptureBusy: false,
  _downloadTask: null,
  _fontProgress: null,

  onLoad() {
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const { statusBarHeight = 0 } = wx.getWindowInfo()
    const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })
    this.setData({
      navOverlayHeight: compactNavLayout.overlayHeight,
      navStatusMaskHeight: statusBarHeight || capsuleRect.top,
    })
    this.bindInitChannel()
    if (!this._eventChannel) {
      wx.showToast({ title: '无法打开分享页', icon: 'none', duration: 2500 })
    }
  },

  onShow() {
    applyNavStatusBarStyle()
  },

  bindInitChannel() {
    const ch = this.getOpenerEventChannel?.()
    if (!ch || typeof ch.on !== 'function') {
      return
    }
    this._eventChannel = ch
    ch.on('memo-share-image-init', (payload: MemoShareImageInitPayload) => {
      const card = payload?.card
      if (!card || !card.id) {
        this.setData({
          card: null,
          status: 'error',
          errorMessage: '笔记数据无效',
          actionDisabled: true,
        })
        return
      }
      const stored = readMemoShareImagePrefs()
      const shareFontId = stored?.shareFontId ?? 'default'
      const base = cloneShareOptions(SHARE_IMAGE_OPTIONS)
      const shareOptions = stored
        ? {
            ...base,
            showTags: stored.showTags,
            showNickname: stored.showNickname,
            showBrand: stored.showBrand,
          }
        : cloneShareOptions(SHARE_IMAGE_OPTIONS)
      const shareLargeText = stored?.shareLargeText ?? false
      const shareLunarDate = stored?.shareLunarDate ?? false
      const needsPrintFont = shareFontId === 'print'
      this.setData(
        {
          card,
          status: 'ready',
          previewPath: '',
          errorMessage: '',
          actionDisabled: needsPrintFont,
          shareFontId,
          shareOptions,
          visibilityMenuActive: false,
          visibilityMenuAnchorRect: null,
          shareNickname: resolveShareDisplayNickname(),
          sharePaperDateText: buildSharePaperDateText(card.createdAtText, shareLunarDate),
          shareLargeText,
          shareLunarDate,
        },
        () => {
          this.syncPopoverMenus()
          if (needsPrintFont) {
            this.preparePrintFont()
          }
        },
      )
    })
  },

  buildVisibilityMenuItems() {
    const options = this.data.shareOptions
    const printOn = this.data.shareFontId === 'print'
    return [
      {
        id: 'toggle-tags',
        label: '显示标签',
        icon: options.showTags ? 'check' : undefined,
        dividerBefore: false,
      },
      {
        id: 'toggle-nickname',
        label: '显示昵称',
        icon: options.showNickname ? 'check' : undefined,
        dividerBefore: false,
      },
      {
        id: 'toggle-brand',
        label: '显示 weimo 标志',
        icon: options.showBrand ? 'check' : undefined,
        dividerBefore: false,
      },
      {
        id: 'toggle-lunar-date',
        label: '使用农历日期',
        icon: this.data.shareLunarDate ? 'check' : undefined,
        dividerBefore: true,
      },
      {
        id: 'toggle-large-text',
        label: '使用大字号',
        icon: this.data.shareLargeText ? 'check' : undefined,
        dividerBefore: false,
      },
      {
        id: 'toggle-print-font',
        label: '京华老宋体',
        icon: printOn ? 'check' : undefined,
        dividerBefore: false,
        description:
          this.data.printFontStatus === 'ready' ? undefined : '首次使用需下载字体',
      },
    ]
  },

  syncPopoverMenus() {
    this.setData({
      visibilityMenuItems: this.buildVisibilityMenuItems(),
    })
  },

  handleClose() {
    wx.navigateBack({ delta: 1 })
  },

  preparePrintFont() {
    if (this.data.shareFontId !== 'print') return
    if (this.data.printFontStatus === 'ready' || this.data.printFontStatus === 'downloading') {
      return
    }
    const fs = wx.getFileSystemManager()
    fs.access({
      path: PRINT_FONT_CACHE_PATH,
      success: () => {
        wx.loadFontFace({
          family: PRINT_FONT_FAMILY,
          source: `url("${PRINT_FONT_CACHE_PATH}")`,
          complete: () => {
            this.setData(
              { printFontStatus: 'ready', printFontProgress: 100, actionDisabled: false },
              () => {
                this.syncPopoverMenus()
              },
            )
          },
        })
      },
      fail: () => {
        this._downloadAndCacheFont(fs)
      },
    })
  },

  _registerCachedFont(_fs: WechatMiniprogram.FileSystemManager) {
    wx.loadFontFace({
      family: PRINT_FONT_FAMILY,
      source: `url("${PRINT_FONT_CACHE_PATH}")`,
      complete: () => {
        this._ensureFontProgress()
        this._fontProgress!.fillToComplete(() => {
          this.setData({ printFontStatus: 'ready', actionDisabled: false }, () => {
            this.syncPopoverMenus()
          })
        })
      },
    })
  },

  _downloadAndCacheFont(fs: WechatMiniprogram.FileSystemManager) {
    this.setData(
      { printFontStatus: 'downloading', printFontProgress: 0, actionDisabled: true },
      () => {
        this.syncPopoverMenus()
      },
    )
    this._ensureFontProgress()
    this._fontProgress!.start()
    const task = wx.downloadFile({
      url: PRINT_FONT_URL,
      filePath: PRINT_FONT_CACHE_PATH,
      timeout: 120000,
      success: (res) => {
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          this._fontProgress?.destroy()
          fs.unlink({ filePath: PRINT_FONT_CACHE_PATH, success() {}, fail() {} })
          this.setData({ printFontStatus: 'error', actionDisabled: true }, () => {
            this.syncPopoverMenus()
          })
          return
        }
        this._registerCachedFont(fs)
      },
      fail: () => {
        this._fontProgress?.destroy()
        fs.unlink({ filePath: PRINT_FONT_CACHE_PATH, success() {}, fail() {} })
        this.setData({ printFontStatus: 'error', actionDisabled: true }, () => {
          this.syncPopoverMenus()
        })
      },
    })
    this._downloadTask = task
  },

  handlePrintFontRetry() {
    this._fontProgress?.destroy()
    this.setData({ printFontStatus: 'idle' as const, printFontProgress: 0 }, () => {
      this.syncPopoverMenus()
    })
    this.preparePrintFont()
  },

  _ensureFontProgress() {
    if (!this._fontProgress) {
      this._fontProgress = createPrintFontProgress({
        onProgress: (progress) => {
          this.setData({ printFontProgress: progress })
        },
        onTimeout: () => {
          if (this._downloadTask) {
            this._downloadTask.abort()
            this._downloadTask = null
          }
          this.setData({ printFontStatus: 'error', actionDisabled: true }, () => {
            this.syncPopoverMenus()
          })
        },
      })
    }
  },

  scheduleSnapshotForShare(callbacks: { onSuccess: (path: string) => void; onFail: () => void }) {
    setTimeout(() => {
      this.runSnapshotCapture(callbacks)
    }, SNAPSHOT_LAYOUT_DELAY_MS)
  },

  runSnapshotCapture(callbacks: { onSuccess: (path: string) => void; onFail: () => void }) {
    const query = wx.createSelectorQuery()
    query.select('#memo-share-snapshot').node().exec((res: unknown[]) => {
      const node = (
        Array.isArray(res) && res[0] ? (res[0] as { node?: SnapshotNode }).node : undefined
      ) as SnapshotNode | undefined

      if (!node || typeof node.takeSnapshot !== 'function') {
        callbacks.onFail()
        return
      }

      node.takeSnapshot({
        type: 'arraybuffer',
        format: 'png',
        success: (r) => {
          this.resolveSnapshotFilePath(
            r,
            (path) => {
              callbacks.onSuccess(path)
            },
            () => {
              callbacks.onFail()
            },
          )
        },
        fail: () => {
          callbacks.onFail()
        },
      })
    })
  },

  resolveSnapshotFilePath(
    result: SnapshotResult,
    onSuccess: (path: string) => void,
    onFail: () => void,
  ) {
    const tempFilePath = String(result.tempFilePath || '').trim()
    if (tempFilePath) {
      onSuccess(tempFilePath)
      return
    }

    if (typeof result.data === 'string') {
      const path = result.data.trim()
      if (path) {
        onSuccess(path)
        return
      }
    }

    if (!(result.data instanceof ArrayBuffer)) {
      onFail()
      return
    }

    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/memo_share_${Date.now()}.png`
    fs.writeFile({
      filePath,
      data: result.data,
      encoding: 'binary',
      success: () => onSuccess(filePath),
      fail: () => onFail(),
    })
  },

  persistMemoShareImagePrefs() {
    writeMemoShareImagePrefs({
      shareFontId: this.data.shareFontId,
      showTags: this.data.shareOptions.showTags,
      showNickname: this.data.shareOptions.showNickname,
      showBrand: this.data.shareOptions.showBrand,
      shareLargeText: this.data.shareLargeText,
      shareLunarDate: this.data.shareLunarDate,
    })
  },

  handleVisibilityMenuTap() {
    hapticTap('light')
    if (this.data.visibilityMenuActive) {
      this.setData({
        visibilityMenuActive: false,
        visibilityMenuAnchorRect: null,
      })
      return
    }
    const query = wx.createSelectorQuery()
    query.select('#memo-share-visibility-trigger').boundingClientRect().exec((res: unknown[]) => {
      const rect = res && res[0]
      if (!rect) return
      this.setData({
        visibilityMenuActive: true,
        visibilityMenuAnchorRect: rect as WechatMiniprogram.BoundingClientRectCallbackResult,
        visibilityMenuItems: this.buildVisibilityMenuItems(),
      })
    })
  },

  handleVisibilityMenuClose() {
    this.setData({
      visibilityMenuActive: false,
      visibilityMenuAnchorRect: null,
    })
  },

  handleVisibilityMenuSelect(event: WechatMiniprogram.CustomEvent<{ id: MemoSharePopoverActionId }>) {
    const id = event.detail?.id
    if (!id) return
    this.applyShareMenuAction(id)
  },

  applyShareMenuAction(id: MemoSharePopoverActionId) {
    if (id === 'toggle-print-font') {
      if (this.data.shareFontId === 'print') {
        this._fontProgress?.destroy()
        if (this._downloadTask) {
          this._downloadTask.abort()
          this._downloadTask = null
        }
        const keepFontReady = this.data.printFontStatus === 'ready'
        this.setData(
          {
            shareFontId: 'default',
            actionDisabled: false,
            printFontStatus: keepFontReady ? 'ready' as const : 'idle' as const,
            printFontProgress: keepFontReady ? 100 : 0,
          },
          () => {
            this.syncPopoverMenus()
            this.persistMemoShareImagePrefs()
          },
        )
      } else {
        const fontReady = this.data.printFontStatus === 'ready'
        this.setData(
          {
            shareFontId: 'print',
            actionDisabled: !fontReady,
          },
          () => {
            this.syncPopoverMenus()
            this.persistMemoShareImagePrefs()
            if (!fontReady) this.preparePrintFont()
          },
        )
      }
      return
    }

    if (id === 'toggle-large-text') {
      this.setData({ shareLargeText: !this.data.shareLargeText }, () => {
        this.syncPopoverMenus()
        this.persistMemoShareImagePrefs()
      })
      return
    }

    if (id === 'toggle-lunar-date') {
      const card = this.data.card
      if (!card) return
      const next = !this.data.shareLunarDate
      this.setData(
        {
          shareLunarDate: next,
          sharePaperDateText: buildSharePaperDateText(card.createdAtText, next),
        },
        () => {
          this.syncPopoverMenus()
          this.persistMemoShareImagePrefs()
        },
      )
      return
    }

    const current = this.data.shareOptions
    const nextOptions: MemoShareImageOptions = { ...current }
    if (id === 'toggle-tags') nextOptions.showTags = !current.showTags
    if (id === 'toggle-brand') nextOptions.showBrand = !current.showBrand
    if (id === 'toggle-nickname') {
      nextOptions.showNickname = !current.showNickname
    }

    this.setData(
      { shareOptions: nextOptions },
      () => {
        this.syncPopoverMenus()
        this.persistMemoShareImagePrefs()
      },
    )
  },

  handleShareToFriendTap() {
    if (this._shareMenuOpen || this._shareCaptureBusy) return
    if (!this.data.card || this.data.status !== 'ready') return
    if (this.data.shareFontId === 'print' && this.data.printFontStatus !== 'ready') return

    this._shareCaptureBusy = true
    this.setData({
      status: 'capturing',
      actionDisabled: true,
      errorMessage: '',
    })

    this.scheduleSnapshotForShare({
      onSuccess: (path) => {
        this._shareCaptureBusy = false
        this._shareMenuOpen = true
        this.setData({
          status: 'ready',
          actionDisabled: false,
          previewPath: path,
        })
        const shareOptions: ShareImageMenuOptionWithEntrance = {
          path,
          needShowEntrance: true,
          entrancePath: buildShareEntrancePath(this.data.card),
          fail: (err) => {
            const errMsg = String(err.errMsg || '').toLowerCase()
            if (errMsg.includes('cancel')) return
            wx.showToast({ title: '无法打开分享', icon: 'none' })
          },
          complete: () => {
            this._shareMenuOpen = false
            this.setData({ previewPath: '' })
          },
        }
        wx.showShareImageMenu(shareOptions)
      },
      onFail: () => {
        this._shareCaptureBusy = false
        this.setData({
          status: 'ready',
          actionDisabled: false,
        })
        wx.showToast({ title: '生成图片失败', icon: 'none' })
      },
    })
  },
})
