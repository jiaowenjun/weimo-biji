import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}))

describe('auth service profile APIs', () => {
  beforeEach(() => {
    requestMock.mockReset()
    vi.resetModules()
  })

  it('updates current user nickname through the Mini Program compatible endpoint', async () => {
    requestMock.mockResolvedValue(undefined)
    const { updateCurrentUserNickname } = await import('../auth')

    await updateCurrentUserNickname({ nickname: '新昵称' })

    expect(requestMock).toHaveBeenCalledWith({
      url: '/me/nickname',
      method: 'POST',
      data: { nickname: '新昵称' },
    })
  })

  it('updates current user login name through the settings endpoint', async () => {
    requestMock.mockResolvedValue({
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice-web',
      has_login_password: true,
    })
    const { updateCurrentUserLoginName } = await import('../auth')

    const profile = await updateCurrentUserLoginName({ login_name: 'alice-web' })

    expect(profile.login_name).toBe('alice-web')
    expect(requestMock).toHaveBeenCalledWith({
      url: '/me/login-name',
      method: 'POST',
      data: { login_name: 'alice-web' },
    })
  })

  it('updates current user login password through the settings endpoint', async () => {
    requestMock.mockResolvedValue({
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice',
      has_login_password: true,
    })
    const { updateCurrentUserLoginPassword } = await import('../auth')

    const profile = await updateCurrentUserLoginPassword({
      password: 'new-secret',
      confirm_password: 'new-secret',
    })

    expect(profile.has_login_password).toBe(true)
    expect(requestMock).toHaveBeenCalledWith({
      url: '/me/login-password',
      method: 'POST',
      data: {
        password: 'new-secret',
        confirm_password: 'new-secret',
      },
    })
  })
})
