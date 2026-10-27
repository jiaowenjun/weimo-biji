export const MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY = 'biji-skyline.memo-share-image.prefs'

/** 分享图字体：`default` 为小程序默认字体，`print` 为京华老宋（需 loadFontFace） */
export type MemoShareFontIdPersisted = 'default' | 'print'

export interface MemoShareImageStoredPrefs {
  shareFontId: MemoShareFontIdPersisted
  showTags: boolean
  showNickname: boolean
  showBrand: boolean
  /** 分享图正文字级加大 */
  shareLargeText: boolean
  /** 页脚日期用农历展示 */
  shareLunarDate: boolean
}

function isMemoShareFontIdPersisted(v: unknown): v is MemoShareFontIdPersisted {
  return v === 'default' || v === 'print'
}

export function readMemoShareImagePrefs(): MemoShareImageStoredPrefs | null {
  try {
    const raw = wx.getStorageSync(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY) as unknown
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    if (!isMemoShareFontIdPersisted(o.shareFontId)) return null
    if (typeof o.showTags !== 'boolean') return null
    if (typeof o.showNickname !== 'boolean') return null
    if (typeof o.showBrand !== 'boolean') return null
    if ('shareLargeText' in o && typeof o.shareLargeText !== 'boolean') return null
    if ('shareLunarDate' in o && typeof o.shareLunarDate !== 'boolean') return null

    return {
      shareFontId: o.shareFontId,
      showTags: o.showTags,
      showNickname: o.showNickname,
      showBrand: o.showBrand,
      shareLargeText: typeof o.shareLargeText === 'boolean' ? o.shareLargeText : false,
      shareLunarDate: typeof o.shareLunarDate === 'boolean' ? o.shareLunarDate : false,
    }
  } catch {
    return null
  }
}

export function writeMemoShareImagePrefs(prefs: MemoShareImageStoredPrefs): void {
  try {
    wx.setStorageSync(MEMO_SHARE_IMAGE_PREFS_STORAGE_KEY, prefs)
  } catch {
    // 忽略存储失败（配额、隐私模式等）
  }
}
