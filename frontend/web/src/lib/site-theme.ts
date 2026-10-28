import { useCallback, useState } from 'react'

import type { ThemeMode } from 'weimo-ui-template/components/site-template-model'

const SITE_THEME_STORAGE_KEY = 'biji.theme'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredTheme(): ThemeMode {
  try {
    const value = window.localStorage.getItem(SITE_THEME_STORAGE_KEY)

    if (isThemeMode(value)) return value
  } catch {
    // localStorage 不可用（隐私模式等）时退回跟随系统
  }

  return 'system'
}

export function writeStoredTheme(theme: ThemeMode) {
  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, theme)
  } catch {
    // 持久化失败不影响本次会话的主题切换
  }
}

export function useSiteTheme() {
  const [theme, setTheme] = useState(readStoredTheme)

  const handleThemeChange = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme)
    writeStoredTheme(nextTheme)
  }, [])

  return { onThemeChange: handleThemeChange, theme }
}
