import { getSession } from './utils/session'
import { applyNavStatusBarStyle } from './utils/theme'
import { syncWorkspaceStoreRuntime } from './store/store-bindings/workspace-store.instance'
import { installRouteBuilder } from './custom-route/index'

App<IAppOption>({
  globalData: {
    session: undefined,
    skylineSupported: undefined,
    theme: undefined,
  },

  onLaunch() {
    console.log('[app] onLaunch fired')
    installRouteBuilder()
    this.globalData.session = getSession()
    syncWorkspaceStoreRuntime(true)
    this.detectSkyline()
    this.initTheme()
  },

  detectSkyline() {
    try {
      const info = wx.getSkylineInfoSync()
      this.globalData.skylineSupported = info.isSupported
    } catch (_error) {
      this.globalData.skylineSupported = false
    }
  },

  initTheme() {
    try {
      // wx.getAppBaseInfo 在运行时已支持，本地 typings 暂未同步，故 as any
      const baseInfo = (wx as any).getAppBaseInfo() as { theme?: 'light' | 'dark' }
      this.globalData.theme = baseInfo.theme === 'dark' ? 'dark' : 'light'
    } catch (_error) {
      this.globalData.theme = 'light'
    }

    wx.onThemeChange((result) => {
      const next = result.theme === 'dark' ? 'dark' : 'light'
      this.globalData.theme = next
      // 主题色 token 全部由 styles/tokens.wxss 的 @media (prefers-color-scheme: dark)
      // 接管，无需在 JS 侧主动刷新页面 inline style。
      // 但 navigationStyle: "custom" 下，系统状态栏前景色不会随媒体查询自动翻转，
      // 必须通过 wx.setNavigationBarColor 主动同步当前栈顶页面。
      applyNavStatusBarStyle(next)
    })
  },
})
