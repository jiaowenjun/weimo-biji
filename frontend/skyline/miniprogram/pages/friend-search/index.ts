import type { FriendSearchItem } from '../../models/friend'
import { createFriendRequest, searchFriendsByNickname } from '../../services/friend'
import { getApiErrorResponseData } from '../../utils/request'
import { applyNavStatusBarStyle } from '../../utils/theme'
import {
  deriveFriendSearchRows,
  friendSearchConflictToast,
  shouldSearchFriendNickname,
  type FriendSearchRow,
} from './view-state'

interface FriendSearchRowView extends FriendSearchRow {
  resolvedAvatarUrl: string
}

interface FriendSearchPageData {
  draft: string
  hasQuery: boolean
  rows: FriendSearchRowView[]
  loading: boolean
  loadFailed: boolean
  keyboardHeight: number
  inputFocus: boolean
  followingUsername: string
}

interface FriendSearchPageCustom {
  _searchSeq: number
  runSearch: (raw: string) => Promise<void>
  commitRows: (items: FriendSearchItem[]) => void
  handleDraftInput: (event: WechatMiniprogram.Input) => void
  handleConfirm: () => void
  handleClearDraft: () => void
  handleRetry: () => void
  handleFollowTap: (event: WechatMiniprogram.BaseEvent) => void
  handleKeyboardHeightChange: (
    event: WechatMiniprogram.CustomEvent<{ height: number }>,
  ) => void
}

Page<FriendSearchPageData, FriendSearchPageCustom>({
  data: {
    draft: '',
    hasQuery: false,
    rows: [] as FriendSearchRowView[],
    loading: false,
    loadFailed: false,
    keyboardHeight: 0,
    inputFocus: true,
    followingUsername: '',
  },

  _searchSeq: 0,

  onShow() {
    applyNavStatusBarStyle()
  },

  commitRows(items) {
    this.setData({
      rows: deriveFriendSearchRows(items).map((row) => ({
        ...row,
        resolvedAvatarUrl: '',
      })),
    })
  },

  async runSearch(raw) {
    const draft = raw.trim()
    const hasQuery = shouldSearchFriendNickname(draft)
    const seq = this._searchSeq + 1
    this._searchSeq = seq

    this.setData({ draft: raw, hasQuery })
    if (!hasQuery) {
      this.setData({ rows: [], loading: false, loadFailed: false })
      return
    }

    this.setData({ loading: true, loadFailed: false })
    try {
      const result = await searchFriendsByNickname(draft)
      if (this._searchSeq !== seq) return
      this.commitRows(result.items)
      this.setData({ loading: false, loadFailed: false })
    } catch {
      if (this._searchSeq !== seq) return
      this.setData({ loading: false, loadFailed: true })
    }
  },

  handleDraftInput(event) {
    void this.runSearch(event.detail.value || '')
  },

  handleConfirm() {
    void this.runSearch(this.data.draft)
  },

  handleClearDraft() {
    void this.runSearch('')
  },

  handleRetry() {
    void this.runSearch(this.data.draft)
  },

  async handleFollowTap(event) {
    const username = String(event.currentTarget.dataset.username || '')
    if (!username || this.data.followingUsername) return
    const row = this.data.rows.find((item) => item.user.username === username)
    if (!row || row.button.disabled) return

    this.setData({ followingUsername: username })
    try {
      await createFriendRequest(username)
      const rows = this.data.rows.map((item) => {
        if (item.user.username !== username) return item
        return {
          ...item,
          follow_state: 'pending_outgoing' as const,
          button: { label: '已申请', disabled: true },
        }
      })
      this.setData({ rows, followingUsername: '' })
      wx.showToast({ title: '已发送申请', icon: 'none' })
    } catch (error) {
      this.setData({ followingUsername: '' })
      wx.showToast({
        title: friendSearchConflictToast(getApiErrorResponseData(error)),
        icon: 'none',
      })
    }
  },

  handleKeyboardHeightChange(event) {
    const height = event.detail?.height ?? 0
    if (height === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: height })
  },
})
