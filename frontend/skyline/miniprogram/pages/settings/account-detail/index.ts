import { applyNavStatusBarStyle } from '../../../utils/theme'
import { getSession, hasSession, patchSession } from '../../../utils/session'
import type { UserProfile } from '../../../models/auth'
import { getCurrentUser } from '../../../services/auth'
import { openAccountEditSheet, type AccountEditSheetMode } from '../../../utils/navigation'

interface AccountDetailPageData {
  profile: UserProfile | null
}

Page({
  data: {
    profile: null,
  } as AccountDetailPageData,

  onShow() {
    applyNavStatusBarStyle()
    if (!hasSession()) {
      wx.navigateBack()
      return
    }
    const session = getSession()
    this.setData({
      profile: session.user,
    })
    void this.syncProfile()
  },

  async syncProfile() {
    if (!hasSession()) return
    try {
      const user = await getCurrentUser()
      patchSession({ user })
      this.setData({ profile: user })
    } catch {
      // keep session profile on refresh failure
    }
  },

  handleProfileUpdated(user: UserProfile) {
    this.setData({ profile: user })
  },

  openEditSheet(mode: AccountEditSheetMode) {
    const profile = this.data.profile
    if (!profile) return
    openAccountEditSheet(mode, profile, (user) => {
      this.handleProfileUpdated(user)
    })
  },

  handleEditNicknameTap() {
    this.openEditSheet('nickname')
  },

  handleEditLoginNameTap() {
    this.openEditSheet('login-name')
  },

  handleEditPasswordTap() {
    this.openEditSheet('password')
  },
})
