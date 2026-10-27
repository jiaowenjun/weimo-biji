/**
 * JS 侧色板常量。
 *
 * 同步约定：
 *   - getNavBarColors  ↔ navigationBar 前景/背景（隐式继承 page 背景）
 *   - getDangerColor   ↔ --color-danger
 *
 * 主题色（brand / heat）已统一收敛到 styles/tokens.wxss，由 page 默认值与
 * `@media (prefers-color-scheme: dark)` 双套字面值独立掌控；JS 侧不再注入
 * inline CSS 变量，避免出现「inline 残留 vs 媒体查询」的不同步状态。
 */

export type ThemeMode = 'light' | 'dark'

export function getCurrentTheme(): ThemeMode {
  try {
    const info = wx.getAppBaseInfo() as { theme?: 'light' | 'dark' }
    return info.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export interface NavBarColors {
  frontColor: '#ffffff' | '#000000'
  backgroundColor: '#ffffff' | '#000000'
}

export function getNavBarColors(theme: ThemeMode = getCurrentTheme()): NavBarColors {
  return theme === 'dark'
    ? { frontColor: '#ffffff', backgroundColor: '#000000' }
    : { frontColor: '#000000', backgroundColor: '#ffffff' }
}

export function getDangerColor(theme: ThemeMode = getCurrentTheme()): string {
  return theme === 'dark' ? '#e34d59' : '#d54941'
}

/**
 * 主动把系统状态栏前景色同步到当前主题。
 *
 * 必要性：app.json 里 `navigationStyle: "custom"`，`navigationBarTextStyle`
 * 仅在页面 onLoad 时被系统读取一次，启动即 dark / 热切换至 dark 等场景
 * 下不会回头同步，导致状态栏字体卡在 black。统一通过 wx.setNavigationBarColor
 * 主动写入，确保亮暗模式都正确。
 */
export function applyNavStatusBarStyle(theme: ThemeMode = getCurrentTheme()): void {
  try {
    wx.setNavigationBarColor({
      ...getNavBarColors(theme),
      animation: { duration: 0, timingFunc: 'linear' },
      fail: () => {
        // navigationStyle: "custom" + Android 等场景可能直接 fail，静默忽略
      },
    })
  } catch {
    // ignore
  }
}
