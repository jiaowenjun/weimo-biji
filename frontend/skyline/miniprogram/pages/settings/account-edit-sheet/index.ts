import type { UserProfile } from '../../../models/auth'
import {
  updateCurrentUserLoginName,
  updateCurrentUserLoginPassword,
  updateCurrentUserNickname,
} from '../../../services/auth'
import { toErrorMessage } from '../../../utils/request'
import { patchSession } from '../../../utils/session'
import { applyNavStatusBarStyle } from '../../../utils/theme'
import type { AccountEditSheetInitPayload, AccountEditSheetMode } from '../../../utils/navigation'

interface AccountEditSheetPageData {
  mode: AccountEditSheetMode
  title: string
  profile: UserProfile | null
  draftNickname: string
  draftLoginName: string
  draftPassword: string
  draftConfirmPassword: string
  showPassword: boolean
  showConfirmPassword: boolean
  isSaving: boolean
  isSaveDisabled: boolean
  keyboardHeight: number
  inputFocus: boolean
}

interface AccountEditSheetPageCustom {
  _eventChannel: WechatMiniprogram.EventChannel | null
  syncInit: (payload: AccountEditSheetInitPayload) => void
  handleNicknameInput: (e: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleLoginNameInput: (e: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handlePasswordInput: (e: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleConfirmPasswordInput: (e: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleTogglePasswordVisibility: () => void
  handleToggleConfirmPasswordVisibility: () => void
  handleCloseTap: () => void
  handleSaveTap: () => Promise<void>
  handleKeyboardHeightChange: (e: WechatMiniprogram.CustomEvent<{ height: number }>) => void
  saveNickname: () => Promise<void>
  saveLoginName: () => Promise<void>
  savePassword: () => Promise<void>
  finishSuccess: (user: UserProfile, toastTitle: string) => void
}

function normalizeMode(rawMode: string | undefined): AccountEditSheetMode {
  if (rawMode === 'login-name' || rawMode === 'password') return rawMode
  return 'nickname'
}

function titleForMode(mode: AccountEditSheetMode): string {
  if (mode === 'login-name') return '修改网页端登录名'
  if (mode === 'password') return '修改登录密码'
  return '修改昵称'
}

function currentLoginName(profile: UserProfile): string {
  return profile.login_name || profile.username
}

function isNicknameSaveDisabled(profile: UserProfile | null, draftNickname: string): boolean {
  const nickname = draftNickname.trim()
  return !profile || !nickname || nickname === profile.nickname.trim()
}

function isLoginNameSaveDisabled(profile: UserProfile | null, draftLoginName: string): boolean {
  const loginName = draftLoginName.trim()
  return !profile || !loginName || loginName === currentLoginName(profile).trim()
}

function isPasswordSaveDisabled(draftPassword: string, draftConfirmPassword: string): boolean {
  return !draftPassword.trim() || draftPassword !== draftConfirmPassword
}

Page<AccountEditSheetPageData, AccountEditSheetPageCustom>({
  data: {
    mode: 'nickname' as AccountEditSheetMode,
    title: '修改昵称',
    profile: null,
    draftNickname: '',
    draftLoginName: '',
    draftPassword: '',
    draftConfirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
    isSaving: false,
    isSaveDisabled: true,
    keyboardHeight: 0,
    inputFocus: true,
  },

  _eventChannel: null,

  onLoad(query) {
    const mode = normalizeMode(query.mode)
    this.setData({
      mode,
      title: titleForMode(mode),
    })

    this._eventChannel = this.getOpenerEventChannel()
    if (this._eventChannel) {
      this._eventChannel.on('account-edit-sheet-init', (payload: AccountEditSheetInitPayload) => {
        this.syncInit(payload)
      })
    }
  },

  onShow() {
    applyNavStatusBarStyle()
  },

  syncInit(payload) {
    if (!this._eventChannel) {
      this._eventChannel = this.getOpenerEventChannel()
    }

    const mode = payload.mode
    const profile = payload.profile
    const draftNickname = profile.nickname
    const draftLoginName = currentLoginName(profile)
    const draftPassword = ''
    const draftConfirmPassword = ''

    const isSaveDisabled =
      mode === 'nickname'
        ? isNicknameSaveDisabled(profile, draftNickname)
        : mode === 'login-name'
          ? isLoginNameSaveDisabled(profile, draftLoginName)
          : isPasswordSaveDisabled(draftPassword, draftConfirmPassword)

    this.setData({
      mode,
      title: titleForMode(mode),
      profile,
      draftNickname,
      draftLoginName,
      draftPassword,
      draftConfirmPassword,
      showPassword: false,
      showConfirmPassword: false,
      isSaving: false,
      isSaveDisabled,
      keyboardHeight: 0,
      inputFocus: true,
    })
  },

  handleNicknameInput(e) {
    const draftNickname = e.detail.value
    this.setData({
      draftNickname,
      isSaveDisabled: isNicknameSaveDisabled(this.data.profile, draftNickname),
    })
  },

  handleLoginNameInput(e) {
    const draftLoginName = e.detail.value
    this.setData({
      draftLoginName,
      isSaveDisabled: isLoginNameSaveDisabled(this.data.profile, draftLoginName),
    })
  },

  handlePasswordInput(e) {
    const draftPassword = e.detail.value
    this.setData({
      draftPassword,
      isSaveDisabled: isPasswordSaveDisabled(draftPassword, this.data.draftConfirmPassword),
    })
  },

  handleConfirmPasswordInput(e) {
    const draftConfirmPassword = e.detail.value
    this.setData({
      draftConfirmPassword,
      isSaveDisabled: isPasswordSaveDisabled(this.data.draftPassword, draftConfirmPassword),
    })
  },

  handleTogglePasswordVisibility() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  handleToggleConfirmPasswordVisibility() {
    this.setData({ showConfirmPassword: !this.data.showConfirmPassword })
  },

  handleCloseTap() {
    wx.navigateBack()
  },

  async handleSaveTap() {
    if (this.data.isSaving) return
    if (this.data.mode === 'login-name') {
      await this.saveLoginName()
      return
    }
    if (this.data.mode === 'password') {
      await this.savePassword()
      return
    }
    await this.saveNickname()
  },

  async saveNickname() {
    const profile = this.data.profile
    const nickname = this.data.draftNickname.trim()
    if (!profile) return

    if (!nickname) {
      this.setData({ isSaveDisabled: true })
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    if (nickname === profile.nickname.trim()) {
      this.setData({ isSaveDisabled: true })
      return
    }

    this.setData({ isSaving: true })
    try {
      await updateCurrentUserNickname({ nickname })
      const user: UserProfile = {
        username: profile.username,
        nickname,
        login_name: profile.login_name,
        has_login_password: profile.has_login_password,
      }
      this.finishSuccess(user, '昵称已更新')
    } catch (error) {
      this.setData({ isSaving: false })
      wx.showToast({ title: toErrorMessage(error, '昵称更新失败'), icon: 'none' })
    }
  },

  async saveLoginName() {
    const profile = this.data.profile
    const loginName = this.data.draftLoginName.trim()
    if (!profile) return

    if (!loginName) {
      this.setData({ isSaveDisabled: true })
      wx.showToast({ title: '请输入登录名', icon: 'none' })
      return
    }

    if (loginName === currentLoginName(profile).trim()) {
      this.setData({ isSaveDisabled: true })
      return
    }

    this.setData({ isSaving: true })
    try {
      const user = await updateCurrentUserLoginName({ login_name: loginName })
      this.finishSuccess(user, '登录名已更新')
    } catch (error) {
      this.setData({ isSaving: false })
      wx.showToast({ title: toErrorMessage(error, '登录名更新失败'), icon: 'none' })
    }
  },

  async savePassword() {
    const password = this.data.draftPassword
    const confirmPassword = this.data.draftConfirmPassword

    if (!password.trim()) {
      this.setData({ isSaveDisabled: true })
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    if (password !== confirmPassword) {
      this.setData({ isSaveDisabled: true })
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' })
      return
    }

    this.setData({ isSaving: true })
    try {
      const user = await updateCurrentUserLoginPassword({
        password,
        confirm_password: confirmPassword,
      })
      this.finishSuccess(user, '密码已更新')
    } catch (error) {
      this.setData({ isSaving: false })
      wx.showToast({ title: toErrorMessage(error, '密码更新失败'), icon: 'none' })
    }
  },

  finishSuccess(user, toastTitle) {
    patchSession({ user })
    this._eventChannel?.emit('account-profile-updated', user)
    this.setData({
      profile: user,
      draftPassword: '',
      draftConfirmPassword: '',
      showPassword: false,
      showConfirmPassword: false,
      isSaving: false,
      isSaveDisabled: true,
      keyboardHeight: 0,
    })
    wx.showToast({ title: toastTitle, icon: 'none' })
    wx.navigateBack()
  },

  handleKeyboardHeightChange(e) {
    const height = e.detail?.height ?? 0
    if (height === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: height })
  },
})
