import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../../../../models/auth'
import type { AccountEditSheetInitPayload, AccountEditSheetMode } from '../../../../utils/navigation'

type AccountEditSheetPageData = {
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

type AccountEditSheetPageConfig = {
  data: AccountEditSheetPageData
  _eventChannel: WechatMiniprogram.EventChannel | null
  onLoad: (
    this: AccountEditSheetPageInstance,
    query: Record<string, string | undefined>
  ) => void
  syncInit: (this: AccountEditSheetPageInstance, payload: AccountEditSheetInitPayload) => void
  handleNicknameInput: (
    this: AccountEditSheetPageInstance,
    event: WechatMiniprogram.CustomEvent<{ value: string }>
  ) => void
  handleLoginNameInput: (
    this: AccountEditSheetPageInstance,
    event: WechatMiniprogram.CustomEvent<{ value: string }>
  ) => void
  handlePasswordInput: (
    this: AccountEditSheetPageInstance,
    event: WechatMiniprogram.CustomEvent<{ value: string }>
  ) => void
  handleConfirmPasswordInput: (
    this: AccountEditSheetPageInstance,
    event: WechatMiniprogram.CustomEvent<{ value: string }>
  ) => void
  handleTogglePasswordVisibility: (this: AccountEditSheetPageInstance) => void
  handleToggleConfirmPasswordVisibility: (this: AccountEditSheetPageInstance) => void
  handleCloseTap: (this: AccountEditSheetPageInstance) => void
  handleSaveTap: (this: AccountEditSheetPageInstance) => Promise<void>
  handleKeyboardHeightChange: (
    this: AccountEditSheetPageInstance,
    event: WechatMiniprogram.CustomEvent<{ height: number }>
  ) => void
  saveNickname: (this: AccountEditSheetPageInstance) => Promise<void>
  saveLoginName: (this: AccountEditSheetPageInstance) => Promise<void>
  savePassword: (this: AccountEditSheetPageInstance) => Promise<void>
  finishSuccess: (
    this: AccountEditSheetPageInstance,
    user: UserProfile,
    toastTitle: string
  ) => void
}

type AccountEditSheetPageInstance = {
  data: AccountEditSheetPageData
  _eventChannel: WechatMiniprogram.EventChannel | null
  setData: (patch: Partial<AccountEditSheetPageData>) => void
  getOpenerEventChannel: () => WechatMiniprogram.EventChannel
  syncInit: (payload: AccountEditSheetInitPayload) => void
  handleNicknameInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleLoginNameInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handlePasswordInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleConfirmPasswordInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleTogglePasswordVisibility: () => void
  handleToggleConfirmPasswordVisibility: () => void
  handleCloseTap: () => void
  handleSaveTap: () => Promise<void>
  handleKeyboardHeightChange: (event: WechatMiniprogram.CustomEvent<{ height: number }>) => void
  saveNickname: () => Promise<void>
  saveLoginName: () => Promise<void>
  savePassword: () => Promise<void>
  finishSuccess: (user: UserProfile, toastTitle: string) => void
}

const sessionUser: UserProfile = {
  username: 'alice',
  nickname: 'Alice',
  login_name: 'alice',
  has_login_password: false,
}

const updatedProfile: UserProfile = {
  username: 'alice',
  nickname: 'Alice',
  login_name: 'alice-web',
  has_login_password: true,
}

const patchSessionMock = vi.fn()
const updateCurrentUserNicknameMock = vi.fn()
const updateCurrentUserLoginNameMock = vi.fn()
const updateCurrentUserLoginPasswordMock = vi.fn()
const showToastMock = vi.fn()
const navigateBackMock = vi.fn()

vi.mock('../../../../utils/session', () => ({
  patchSession: (...args: unknown[]) => patchSessionMock(...args),
}))

vi.mock('../../../../services/auth', () => ({
  updateCurrentUserNickname: (...args: unknown[]) => updateCurrentUserNicknameMock(...args),
  updateCurrentUserLoginName: (...args: unknown[]) => updateCurrentUserLoginNameMock(...args),
  updateCurrentUserLoginPassword: (...args: unknown[]) =>
    updateCurrentUserLoginPasswordMock(...args),
}))

vi.mock('../../../../utils/request', () => ({
  toErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

async function loadPageConfig(): Promise<AccountEditSheetPageConfig> {
  let captured: AccountEditSheetPageConfig | undefined

  vi.stubGlobal('Page', (options: AccountEditSheetPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    showToast: showToastMock,
    navigateBack: navigateBackMock,
  })

  await import('../index')

  if (!captured) {
    throw new Error('account edit sheet page config was not captured')
  }

  return captured
}

function makeEventChannel() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    emit: vi.fn(),
    on: vi.fn((name: string, handler: (payload: unknown) => void) => {
      handlers.set(name, handler)
    }),
    trigger(name: string, payload: unknown) {
      const handler = handlers.get(name)
      if (!handler) throw new Error(`missing handler for ${name}`)
      handler(payload)
    },
  }
}

function makeInstance(
  pageConfig: AccountEditSheetPageConfig,
  eventChannel = makeEventChannel(),
): AccountEditSheetPageInstance & { eventChannel: ReturnType<typeof makeEventChannel> } {
  const instance = {
    data: { ...pageConfig.data },
    _eventChannel: null as WechatMiniprogram.EventChannel | null,
    setData: vi.fn((patch: Partial<AccountEditSheetPageData>) => {
      instance.data = {
        ...instance.data,
        ...patch,
      }
    }),
    getOpenerEventChannel: vi.fn(() => eventChannel as unknown as WechatMiniprogram.EventChannel),
    eventChannel,
    syncInit: (payload: AccountEditSheetInitPayload) => pageConfig.syncInit.call(instance, payload),
    handleNicknameInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) =>
      pageConfig.handleNicknameInput.call(instance, event),
    handleLoginNameInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) =>
      pageConfig.handleLoginNameInput.call(instance, event),
    handlePasswordInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) =>
      pageConfig.handlePasswordInput.call(instance, event),
    handleConfirmPasswordInput: (event: WechatMiniprogram.CustomEvent<{ value: string }>) =>
      pageConfig.handleConfirmPasswordInput.call(instance, event),
    handleTogglePasswordVisibility: () => pageConfig.handleTogglePasswordVisibility.call(instance),
    handleToggleConfirmPasswordVisibility: () =>
      pageConfig.handleToggleConfirmPasswordVisibility.call(instance),
    handleCloseTap: () => pageConfig.handleCloseTap.call(instance),
    handleSaveTap: () => pageConfig.handleSaveTap.call(instance),
    handleKeyboardHeightChange: (event: WechatMiniprogram.CustomEvent<{ height: number }>) =>
      pageConfig.handleKeyboardHeightChange.call(instance, event),
    saveNickname: () => pageConfig.saveNickname.call(instance),
    saveLoginName: () => pageConfig.saveLoginName.call(instance),
    savePassword: () => pageConfig.savePassword.call(instance),
    finishSuccess: (user: UserProfile, toastTitle: string) =>
      pageConfig.finishSuccess.call(instance, user, toastTitle),
  }
  return instance
}

describe('account edit sheet page', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('binds init event and initializes nickname mode from payload', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.onLoad.call(instance, { mode: 'nickname' })
    instance.eventChannel.trigger('account-edit-sheet-init', {
      mode: 'nickname',
      profile: sessionUser,
    })

    expect(instance.eventChannel.on).toHaveBeenCalledWith(
      'account-edit-sheet-init',
      expect.any(Function),
    )
    expect(instance.data.mode).toBe('nickname')
    expect(instance.data.title).toBe('修改昵称')
    expect(instance.data.profile).toEqual(sessionUser)
    expect(instance.data.draftNickname).toBe('Alice')
    expect(instance.data.isSaveDisabled).toBe(true)
    expect(instance.data.inputFocus).toBe(true)
  })

  it('saves a trimmed nickname, patches session, emits update, and closes', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'nickname',
      profile: sessionUser,
    })
    updateCurrentUserNicknameMock.mockResolvedValue(undefined)

    pageConfig.handleNicknameInput.call(instance, {
      detail: { value: '  阿衡  ' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    const expectedUser: UserProfile = {
      username: 'alice',
      nickname: '阿衡',
      login_name: 'alice',
      has_login_password: false,
    }
    expect(updateCurrentUserNicknameMock).toHaveBeenCalledWith({ nickname: '阿衡' })
    expect(patchSessionMock).toHaveBeenCalledWith({ user: expectedUser })
    expect(instance.eventChannel.emit).toHaveBeenCalledWith('account-profile-updated', expectedUser)
    expect(showToastMock).toHaveBeenCalledWith({ title: '昵称已更新', icon: 'none' })
    expect(navigateBackMock).toHaveBeenCalledTimes(1)
  })

  it('blocks blank nickname and keeps failed nickname save editable', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'nickname',
      profile: sessionUser,
    })

    pageConfig.handleNicknameInput.call(instance, {
      detail: { value: '   ' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(updateCurrentUserNicknameMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith({ title: '请输入昵称', icon: 'none' })

    updateCurrentUserNicknameMock.mockRejectedValue(new Error('服务暂不可用'))
    pageConfig.handleNicknameInput.call(instance, {
      detail: { value: '阿衡' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(instance.data.draftNickname).toBe('阿衡')
    expect(instance.data.isSaving).toBe(false)
    expect(showToastMock).toHaveBeenLastCalledWith({ title: '服务暂不可用', icon: 'none' })
    expect(navigateBackMock).not.toHaveBeenCalled()
  })

  it('saves login name using the returned profile', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'login-name',
      profile: sessionUser,
    })
    updateCurrentUserLoginNameMock.mockResolvedValue(updatedProfile)

    pageConfig.handleLoginNameInput.call(instance, {
      detail: { value: '  alice-web  ' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(instance.data.title).toBe('修改网页端登录名')
    expect(updateCurrentUserLoginNameMock).toHaveBeenCalledWith({ login_name: 'alice-web' })
    expect(patchSessionMock).toHaveBeenCalledWith({ user: updatedProfile })
    expect(instance.eventChannel.emit).toHaveBeenCalledWith('account-profile-updated', updatedProfile)
    expect(showToastMock).toHaveBeenCalledWith({ title: '登录名已更新', icon: 'none' })
    expect(navigateBackMock).toHaveBeenCalledTimes(1)
  })

  it('blocks blank login name and keeps failed login name save editable', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'login-name',
      profile: sessionUser,
    })

    pageConfig.handleLoginNameInput.call(instance, {
      detail: { value: '   ' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(updateCurrentUserLoginNameMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith({ title: '请输入登录名', icon: 'none' })

    updateCurrentUserLoginNameMock.mockRejectedValue(new Error('登录名已存在'))
    pageConfig.handleLoginNameInput.call(instance, {
      detail: { value: 'alice-web' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(instance.data.draftLoginName).toBe('alice-web')
    expect(instance.data.isSaving).toBe(false)
    expect(showToastMock).toHaveBeenLastCalledWith({ title: '登录名已存在', icon: 'none' })
    expect(navigateBackMock).not.toHaveBeenCalled()
  })

  it('blocks invalid password saves and toggles password visibility', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'password',
      profile: sessionUser,
    })

    await pageConfig.handleSaveTap.call(instance)
    expect(updateCurrentUserLoginPasswordMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith({ title: '请输入密码', icon: 'none' })

    pageConfig.handlePasswordInput.call(instance, {
      detail: { value: 'new-secret' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    pageConfig.handleConfirmPasswordInput.call(instance, {
      detail: { value: 'other-secret' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(updateCurrentUserLoginPasswordMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenLastCalledWith({
      title: '两次输入的密码不一致',
      icon: 'none',
    })

    pageConfig.handleTogglePasswordVisibility.call(instance)
    pageConfig.handleToggleConfirmPasswordVisibility.call(instance)
    expect(instance.data.showPassword).toBe(true)
    expect(instance.data.showConfirmPassword).toBe(true)
  })

  it('saves password, patches session, emits update, clears drafts, and closes', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    pageConfig.syncInit.call(instance, {
      mode: 'password',
      profile: sessionUser,
    })
    updateCurrentUserLoginPasswordMock.mockResolvedValue(updatedProfile)

    pageConfig.handlePasswordInput.call(instance, {
      detail: { value: 'new-secret' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    pageConfig.handleConfirmPasswordInput.call(instance, {
      detail: { value: 'new-secret' },
    } as WechatMiniprogram.CustomEvent<{ value: string }>)
    await pageConfig.handleSaveTap.call(instance)

    expect(updateCurrentUserLoginPasswordMock).toHaveBeenCalledWith({
      password: 'new-secret',
      confirm_password: 'new-secret',
    })
    expect(patchSessionMock).toHaveBeenCalledWith({ user: updatedProfile })
    expect(instance.eventChannel.emit).toHaveBeenCalledWith('account-profile-updated', updatedProfile)
    expect(instance.data.draftPassword).toBe('')
    expect(instance.data.draftConfirmPassword).toBe('')
    expect(instance.data.showPassword).toBe(false)
    expect(instance.data.showConfirmPassword).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith({ title: '密码已更新', icon: 'none' })
    expect(navigateBackMock).toHaveBeenCalledTimes(1)
  })

  it('handles close taps and keyboard height changes', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.handleKeyboardHeightChange.call(instance, {
      detail: { height: 320 },
    } as WechatMiniprogram.CustomEvent<{ height: number }>)
    pageConfig.handleKeyboardHeightChange.call(instance, {
      detail: { height: 320 },
    } as WechatMiniprogram.CustomEvent<{ height: number }>)
    pageConfig.handleCloseTap.call(instance)

    expect(instance.data.keyboardHeight).toBe(320)
    expect(instance.setData).toHaveBeenCalledTimes(1)
    expect(navigateBackMock).toHaveBeenCalledTimes(1)
  })
})
