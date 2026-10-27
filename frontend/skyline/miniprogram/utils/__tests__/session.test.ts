import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, unknown>()

describe('session normalization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    storage.clear()
    vi.stubGlobal('getApp', () => ({
      globalData: {},
    }))
    vi.stubGlobal('wx', {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => {
        storage.set(key, value)
      },
      removeStorageSync: (key: string) => {
        storage.delete(key)
      },
    })
  })

  it('derives login_name from username for old stored sessions', async () => {
    storage.set('biji-skyline.session', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'alice',
        nickname: 'Alice',
      },
    })

    const { getSession } = await import('../session')

    expect(getSession().user).toEqual({
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice',
      has_login_password: false,
    })
  })

  it('persists normalized login credential fields', async () => {
    const { getSession, setSession } = await import('../session')

    setSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'alice',
        nickname: 'Alice',
        login_name: 'alice-web',
        has_login_password: true,
      },
    })

    expect(getSession().user).toEqual({
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice-web',
      has_login_password: true,
    })
  })
})
