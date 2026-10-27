import { applyNavStatusBarStyle } from '../../utils/theme'
import { getSession, hasSession } from '../../utils/session'
import { performLogout } from '../../utils/logout'
import { openAccountDetail, openAuthPage, openFriendSearch } from '../../utils/navigation'
import {
  readMemoCardDoubleTapBehavior,
  writeMemoCardDoubleTapBehavior,
  type MemoCardDoubleTapBehavior,
} from '../../utils/memo-card-double-tap-prefs'

interface SettingsPageData {
  isLoggedIn: boolean
  nickname: string
  memoCardDoubleTapBehavior: MemoCardDoubleTapBehavior
}

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    memoCardDoubleTapBehavior: 'edit-annotate',
  } as SettingsPageData,

  onShow() {
    applyNavStatusBarStyle()
    const isLoggedIn = hasSession()
    const session = getSession()
    const nickname = isLoggedIn ? (session.user?.nickname ?? '') : ''
    this.setData({
      isLoggedIn,
      nickname,
      memoCardDoubleTapBehavior: readMemoCardDoubleTapBehavior(),
    })
  },

  handleMemoCardDoubleTapChange(e: WechatMiniprogram.RadioGroupChange) {
    const value = e.detail.value as MemoCardDoubleTapBehavior
    if (value !== 'edit-annotate' && value !== 'preview') return
    writeMemoCardDoubleTapBehavior(value)
    this.setData({ memoCardDoubleTapBehavior: value })
  },

  handleAccountTap() {
    openAccountDetail()
  },

  handleAddFriendTap() {
    openFriendSearch()
  },

  handleLoginTap() {
    void openAuthPage({ allowBack: true })
  },

  handleLogoutTap() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#e53935',
      success: (res) => {
        if (!res.confirm) return
        performLogout()
        this.setData({
          isLoggedIn: false,
          nickname: '',
        })
        wx.showToast({ title: '已退出登录', icon: 'none' })
      },
    })
  },
})
