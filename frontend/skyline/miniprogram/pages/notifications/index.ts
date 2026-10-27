import {
  acceptFriendRequest,
  getFriendNotifications,
  markFriendNotificationsRead,
} from '../../services/friend'
import { getApiErrorResponseData } from '../../utils/request'
import { hasSession } from '../../utils/session'
import { applyNavStatusBarStyle } from '../../utils/theme'
import {
  deriveNotificationRows,
  notificationConflictToast,
  type NotificationRow,
} from './view-state'

type NotificationRowView = NotificationRow & {
  resolvedAvatarUrl: string
}

interface NotificationsPageData {
  rows: NotificationRowView[]
  loading: boolean
  loadFailed: boolean
  acceptingRequestId: string
}

interface NotificationsPageCustom {
  loadNotifications: () => Promise<void>
  handleRetry: () => void
  handleAcceptTap: (event: WechatMiniprogram.BaseEvent) => void
}

Page<NotificationsPageData, NotificationsPageCustom>({
  data: {
    rows: [] as NotificationRowView[],
    loading: false,
    loadFailed: false,
    acceptingRequestId: '',
  },

  onLoad() {
    void this.loadNotifications()
  },

  onShow() {
    applyNavStatusBarStyle()
  },

  async loadNotifications() {
    if (!hasSession()) {
      this.setData({ rows: [], loading: false, loadFailed: false })
      return
    }

    this.setData({ loading: true, loadFailed: false })
    try {
      const result = await getFriendNotifications()
      const rows = deriveNotificationRows(result.items).map((row) => ({
        ...row,
        resolvedAvatarUrl: '',
      }))
      this.setData({ rows, loading: false, loadFailed: false })
    } catch {
      this.setData({ loading: false, loadFailed: true })
      return
    }

    try {
      await markFriendNotificationsRead()
    } catch {
      // Mark-read is best-effort after the user has already seen the list.
    }
  },

  handleRetry() {
    void this.loadNotifications()
  },

  async handleAcceptTap(event) {
    const requestId = String(event.currentTarget.dataset.requestId || '')
    if (!requestId || this.data.acceptingRequestId) return
    const row = this.data.rows.find((item) => item.requestId === requestId)
    if (!row || row.actionDisabled) return

    this.setData({ acceptingRequestId: requestId })
    try {
      await acceptFriendRequest(requestId)
      const rows = this.data.rows.map((item) => {
        if (item.requestId !== requestId) return item
        return {
          ...item,
          actionLabel: '已同意',
          actionDisabled: true,
        }
      })
      this.setData({ rows, acceptingRequestId: '' })
      wx.showToast({ title: '已同意', icon: 'none' })
    } catch (error) {
      const message = notificationConflictToast(getApiErrorResponseData(error))
      const rows = this.data.rows.map((item) => {
        if (item.requestId !== requestId) return item
        return message === '这条申请已失效'
          ? { ...item, actionLabel: '已失效', actionDisabled: true }
          : item
      })
      this.setData({ rows, acceptingRequestId: '' })
      wx.showToast({ title: message, icon: 'none' })
    }
  },
})
