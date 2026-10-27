import type { MiniWechatAuthDto } from '../../models/auth'
import {
  checkWechatMini,
  loginWechatMini,
  registerWechatMini,
} from '../../services/auth'
import {
  clearVisitorWorkspaceData,
  syncWorkspaceStoreRuntime,
} from '../../store/store-bindings/workspace-store.instance'
import { reLaunchToHome } from '../../utils/navigation'
import { toErrorMessage } from '../../utils/request'
import { hasSession, setSession } from '../../utils/session'
import { applyNavStatusBarStyle } from '../../utils/theme'

function getWechatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (result.code) {
          resolve(result.code)
          return
        }
        reject(new Error('没有拿到微信登录凭证，请稍后重试。'))
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '微信登录失败，请稍后重试。'))
      },
    })
  })
}

function completeAuthSuccess(authResult: MiniWechatAuthDto) {
  clearVisitorWorkspaceData()
  setSession({
    accessToken: authResult.token,
    refreshToken: authResult.refresh_token,
    user: {
      username: authResult.user.username,
      nickname: authResult.user.nickname,
    },
  })
  syncWorkspaceStoreRuntime(true)
  void reLaunchToHome()
}

Page({
  data: {
    allowBack: false,
    loading: false,
    showProfilePanel: false,
    nickname: '',
    hasProfileReady: false,
    keyboardHeight: 0,
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({ allowBack: query.allowBack === '1' })
  },

  onShow() {
    applyNavStatusBarStyle()
    if (hasSession()) {
      void reLaunchToHome()
    }
  },

  async handleMainAction() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const checkCode = await getWechatLoginCode()
      const checkResult = await checkWechatMini({ code: checkCode })

      if (checkResult.is_registered) {
        const loginCode = await getWechatLoginCode()
        const authResult = await loginWechatMini({ code: loginCode })
        completeAuthSuccess(authResult)
      } else {
        this.setData({ showProfilePanel: true })
      }
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error, '微信登录失败'),
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async submitRegistration() {
    if (this.data.loading) return

    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请先填写昵称（可点击昵称栏获取微信昵称）。', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const code = await getWechatLoginCode()
      const authResult = await registerWechatMini({ code, nickname })
      completeAuthSuccess(authResult)
    } catch (error) {
      wx.showToast({
        title: toErrorMessage(error, '微信注册失败'),
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onNicknameInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const nickname = e.detail.value
    const ready = !!nickname.trim()
    this.setData({
      nickname,
      hasProfileReady: ready,
      ...(ready ? { keyboardHeight: 0 } : {}),
    })
  },

  onKeyboardHeightChange(e: WechatMiniprogram.CustomEvent<{ height: number; duration: number }>) {
    this.setData({ keyboardHeight: e.detail.height })
  },

  closeProfilePanel() {
    this.setData({ showProfilePanel: false, keyboardHeight: 0 })
  },
})
