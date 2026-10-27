import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../../../../models/auth'
import type { AccountEditSheetMode } from '../../../../utils/navigation'

type AccountDetailPageData = {
  profile: UserProfile | null
}

type AccountDetailPageConfig = {
  data: AccountDetailPageData
  onShow: (this: AccountDetailPageInstance) => void
  syncProfile: (this: AccountDetailPageInstance) => Promise<void>
  handleProfileUpdated: (this: AccountDetailPageInstance, user: UserProfile) => void
  openEditSheet: (this: AccountDetailPageInstance, mode: AccountEditSheetMode) => void
  handleEditNicknameTap: (this: AccountDetailPageInstance) => void
  handleEditLoginNameTap: (this: AccountDetailPageInstance) => void
  handleEditPasswordTap: (this: AccountDetailPageInstance) => void
}

type AccountDetailPageInstance = {
  data: AccountDetailPageData
  setData: (patch: Partial<AccountDetailPageData>) => void
  syncProfile: () => Promise<void>
  handleProfileUpdated: (user: UserProfile) => void
  openEditSheet: (mode: AccountEditSheetMode) => void
}

const sessionUser: UserProfile = {
  username: 'alice',
  nickname: 'Alice',
  login_name: 'alice',
  has_login_password: false,
}

const getSessionMock = vi.fn()
const hasSessionMock = vi.fn()
const patchSessionMock = vi.fn()
const getCurrentUserMock = vi.fn()
const openAccountEditSheetMock = vi.fn()
const navigateBackMock = vi.fn()

vi.mock('../../../../utils/theme', () => ({
  applyNavStatusBarStyle: vi.fn(),
}))

vi.mock('../../../../utils/session', () => ({
  getSession: () => getSessionMock(),
  hasSession: () => hasSessionMock(),
  patchSession: (...args: unknown[]) => patchSessionMock(...args),
}))

vi.mock('../../../../services/auth', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}))

vi.mock('../../../../utils/navigation', () => ({
  openAccountEditSheet: (
    mode: AccountEditSheetMode,
    profile: UserProfile,
    onUpdated: (user: UserProfile) => void,
  ) => openAccountEditSheetMock(mode, profile, onUpdated),
}))

async function loadPageConfig(): Promise<AccountDetailPageConfig> {
  let captured: AccountDetailPageConfig | undefined

  vi.stubGlobal('Page', (options: AccountDetailPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    navigateBack: navigateBackMock,
  })

  await import('../index')

  if (!captured) {
    throw new Error('account detail page config was not captured')
  }

  return captured
}

function makeInstance(pageConfig: AccountDetailPageConfig): AccountDetailPageInstance {
  const instance: AccountDetailPageInstance = {
    data: { ...pageConfig.data },
    setData: vi.fn((patch: Partial<AccountDetailPageData>) => {
      instance.data = {
        ...instance.data,
        ...patch,
      }
    }),
    syncProfile: vi.fn().mockResolvedValue(undefined),
    handleProfileUpdated: (user: UserProfile) => pageConfig.handleProfileUpdated.call(instance, user),
    openEditSheet: (mode: AccountEditSheetMode) => pageConfig.openEditSheet.call(instance, mode),
  }
  return instance
}

describe('account detail edit sheet entry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getSessionMock.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: sessionUser,
    })
    hasSessionMock.mockReturnValue(true)
    getCurrentUserMock.mockResolvedValue(sessionUser)
  })

  it('initializes profile data from session on show', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.onShow.call(instance)

    expect(instance.setData).toHaveBeenCalledWith({
      profile: sessionUser,
    })
    expect(instance.syncProfile).toHaveBeenCalledTimes(1)
  })

  it('navigates back when account page opens without a session', async () => {
    hasSessionMock.mockReturnValue(false)
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.onShow.call(instance)

    expect(navigateBackMock).toHaveBeenCalledTimes(1)
    expect(instance.syncProfile).not.toHaveBeenCalled()
  })

  it('syncs the latest profile from the service and patches session', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    const updatedProfile: UserProfile = {
      ...sessionUser,
      nickname: '阿衡',
    }
    getCurrentUserMock.mockResolvedValue(updatedProfile)

    await pageConfig.syncProfile.call(instance)

    expect(patchSessionMock).toHaveBeenCalledWith({ user: updatedProfile })
    expect(instance.data.profile).toEqual(updatedProfile)
  })

  it('opens nickname edit sheet and applies the returned profile locally', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = {
      profile: sessionUser,
    }

    pageConfig.handleEditNicknameTap.call(instance)

    expect(openAccountEditSheetMock).toHaveBeenCalledWith(
      'nickname',
      sessionUser,
      expect.any(Function),
    )
    const onUpdated = openAccountEditSheetMock.mock.calls[0][2] as (user: UserProfile) => void
    const updatedProfile: UserProfile = {
      ...sessionUser,
      nickname: '阿衡',
    }
    onUpdated(updatedProfile)

    expect(instance.data.profile).toEqual(updatedProfile)
    expect(patchSessionMock).not.toHaveBeenCalledWith({ user: updatedProfile })
  })

  it('opens login name and password edit sheets with the current profile', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = {
      profile: sessionUser,
    }

    pageConfig.handleEditLoginNameTap.call(instance)
    pageConfig.handleEditPasswordTap.call(instance)

    expect(openAccountEditSheetMock).toHaveBeenNthCalledWith(
      1,
      'login-name',
      sessionUser,
      expect.any(Function),
    )
    expect(openAccountEditSheetMock).toHaveBeenNthCalledWith(
      2,
      'password',
      sessionUser,
      expect.any(Function),
    )
  })

  it('does not open edit sheets before profile is loaded', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = {
      profile: null,
    }

    pageConfig.handleEditNicknameTap.call(instance)
    pageConfig.handleEditLoginNameTap.call(instance)
    pageConfig.handleEditPasswordTap.call(instance)

    expect(openAccountEditSheetMock).not.toHaveBeenCalled()
  })
})
