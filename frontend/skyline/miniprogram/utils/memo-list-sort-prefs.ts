/** 笔记列表按创建时间排序：与 weimo-server `created_at_sort` 一致 */
export type MemoCreatedAtSort = 'asc' | 'desc'

const MEMO_LIST_CREATED_AT_SORT_STORAGE_KEY = 'biji-skyline.memo-list.created-at-sort'

function isMemoCreatedAtSort(value: unknown): value is MemoCreatedAtSort {
  return value === 'asc' || value === 'desc'
}

export function readMemoCreatedAtSort(): MemoCreatedAtSort {
  try {
    const raw = wx.getStorageSync(MEMO_LIST_CREATED_AT_SORT_STORAGE_KEY) as unknown
    if (isMemoCreatedAtSort(raw)) return raw
  } catch {
    // ignore
  }
  return 'desc'
}

export function writeMemoCreatedAtSort(sort: MemoCreatedAtSort): void {
  try {
    wx.setStorageSync(MEMO_LIST_CREATED_AT_SORT_STORAGE_KEY, sort)
  } catch {
    // 配额、隐私模式等
  }
}
