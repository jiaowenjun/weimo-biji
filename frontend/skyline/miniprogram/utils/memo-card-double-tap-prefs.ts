export const MEMO_CARD_DOUBLE_TAP_BEHAVIOR_STORAGE_KEY =
  'biji-skyline.memo-card.double-tap-behavior'

/** 双击卡片：编辑/批注（默认）或打开分享预览页 */
export type MemoCardDoubleTapBehavior = 'edit-annotate' | 'preview'

function isMemoCardDoubleTapBehavior(v: unknown): v is MemoCardDoubleTapBehavior {
  return v === 'edit-annotate' || v === 'preview'
}

export function readMemoCardDoubleTapBehavior(): MemoCardDoubleTapBehavior {
  try {
    const raw = wx.getStorageSync(MEMO_CARD_DOUBLE_TAP_BEHAVIOR_STORAGE_KEY) as unknown
    if (isMemoCardDoubleTapBehavior(raw)) return raw
  } catch {
    // ignore
  }
  return 'edit-annotate'
}

export function writeMemoCardDoubleTapBehavior(behavior: MemoCardDoubleTapBehavior): void {
  try {
    wx.setStorageSync(MEMO_CARD_DOUBLE_TAP_BEHAVIOR_STORAGE_KEY, behavior)
  } catch {
    // 配额、隐私模式等
  }
}
