import { isRecord } from './guards'

const SESSION_STORAGE_KEY = 'biji-skyline.session'

const EMPTY_SESSION: WeimoSessionState = {
  accessToken: null,
  refreshToken: null,
  user: null,
}

type SessionUserInput = {
  username: string
  nickname: string
  login_name?: string
  has_login_password?: boolean
}

type SessionStateInput = Omit<WeimoSessionState, 'user'> & {
  user: SessionUserInput | null
}

function normalizeSession(value: unknown): WeimoSessionState {
  if (!isRecord(value)) {
    return { ...EMPTY_SESSION }
  }

  const accessToken =
    typeof value.accessToken === 'string' && value.accessToken.trim()
      ? value.accessToken
      : null
  const refreshToken =
    typeof value.refreshToken === 'string' && value.refreshToken.trim()
      ? value.refreshToken
      : null
  let user: WeimoSessionUser | null = null
  if (
    isRecord(value.user) &&
    typeof value.user.username === 'string' &&
    typeof value.user.nickname === 'string'
  ) {
    const loginName =
      typeof value.user.login_name === 'string' && value.user.login_name.trim()
        ? value.user.login_name.trim()
        : value.user.username
    user = {
      username: value.user.username,
      nickname: value.user.nickname,
      login_name: loginName,
      has_login_password: value.user.has_login_password === true,
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
  }
}

function syncAppSession(session: WeimoSessionState) {
  try {
    const app = getApp<IAppOption>()
    app.globalData.session = session
  } catch (_error) {
    // App 还没准备好时忽略同步失败。
  }
}

export function getSession(): WeimoSessionState {
  try {
    return normalizeSession(wx.getStorageSync(SESSION_STORAGE_KEY))
  } catch (_error) {
    return { ...EMPTY_SESSION }
  }
}

export function setSession(session: SessionStateInput) {
  const normalized = normalizeSession(session)
  wx.setStorageSync(SESSION_STORAGE_KEY, normalized)
  syncAppSession(normalized)
}

export function patchSession(
  partial: Partial<Omit<WeimoSessionState, 'user'>> & {
    user?: SessionUserInput | null
  },
) {
  setSession({
    ...getSession(),
    ...partial,
  })
}

export function clearSession() {
  wx.removeStorageSync(SESSION_STORAGE_KEY)
  syncAppSession({ ...EMPTY_SESSION })
}

export function hasSession() {
  return Boolean(getSession().accessToken)
}
