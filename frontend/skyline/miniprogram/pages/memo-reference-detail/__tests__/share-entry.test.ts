import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FriendSummary } from '../../../models/friend'

const getFriendSummaryMock = vi.fn<() => Promise<FriendSummary>>()
const reLaunchMock = vi.fn()
const reLaunchToHomeMock = vi.fn()
const showToastMock = vi.fn()
const openMemoReferenceDetailMock = vi.fn()
const openFriendMemoReferenceDetailMock = vi.fn()
const getSessionMock = vi.fn(() => ({
  user: { username: 'alice', nickname: 'Alice', login_name: 'alice', has_login_password: false },
}))
const loadSelfMemoReferenceDetailDataMock = vi.fn()
const loadFriendMemoReferenceDetailDataMock = vi.fn()

function emptyDetailData() {
  return {
    rootCard: null,
    referenceCards: [],
    ownReferenceCards: [],
    friendReferenceCards: [],
    referencedByCards: [],
    ownReferencedByCards: [],
    friendReferencedByCards: [],
    friendReferenceOwnerLabel: '',
    friendReferencedByOwnerLabel: '',
    friendOwnerUsername: '',
    friendOwnerLabel: '',
  }
}

function friendSummary(friends: FriendSummary['friends']): FriendSummary {
  return {
    friends,
    pending_outgoing: [],
    pending_incoming_count: 0,
    unread_count: 0,
  }
}

vi.mock('../../../services/friend', () => ({
  getFriendSummary: () => getFriendSummaryMock(),
}))

vi.mock('../../../utils/session', () => ({
  getSession: () => getSessionMock(),
  hasSession: () => true,
}))

vi.mock('../../../utils/memo-reference-detail-loader', () => ({
  emptyMemoReferenceDetailData: emptyDetailData,
  loadFriendMemoReferenceDetailData: (...args: unknown[]) =>
    loadFriendMemoReferenceDetailDataMock(...args),
  loadMemoReferenceListData: vi.fn(),
  loadSelfMemoReferenceDetailData: (...args: unknown[]) =>
    loadSelfMemoReferenceDetailDataMock(...args),
}))

vi.mock('../../../utils/navigation', () => ({
  openMemoReferenceDetail: (...args: unknown[]) => openMemoReferenceDetailMock(...args),
  openFriendMemoReferenceDetail: (...args: unknown[]) => openFriendMemoReferenceDetailMock(...args),
  openMemoShareImage: vi.fn(),
  openFriendSearch: vi.fn(),
  reLaunchToHome: () => reLaunchToHomeMock(),
}))

type DetailPageConfig = {
  data: Record<string, unknown>
  onLoad: (options: Record<string, string | undefined>) => Promise<void> | void
  onShow: () => void
  handleClose: () => void
  handleHomeTap: () => void
  _handleMemoDeleted: (memoId: number) => void
  handleMemoReferenceTap: (
    event: { detail?: { memoId?: number; ownerUsername?: string } },
  ) => void
  loadMemoReferenceDetail: (memoId: number) => Promise<void>
  loadFriendMemoReferenceDetail: (memoId: number, friendUsername: string) => Promise<void>
}

type DetailPageInstance = {
  data: Record<string, unknown>
  _modifyingMemoId: number | null
  setData: (patch: Record<string, unknown>) => void
  loadMemoReferenceDetail: (memoId: number) => Promise<void>
  loadFriendMemoReferenceDetail: (memoId: number, friendUsername: string) => Promise<void>
  _navOptions: <T extends Record<string, unknown>>(extra?: T) => (T & { routeType?: string }) | undefined
  _ensureRelationSwipeCtx: () => void
  _applyRelationTabStateAfterDataChange: () => void
}

async function loadPageConfig(): Promise<DetailPageConfig> {
  let captured: DetailPageConfig | undefined
  vi.stubGlobal('Page', (options: DetailPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    showToast: showToastMock,
    reLaunch: reLaunchMock,
    navigateBack: vi.fn(),
    getMenuButtonBoundingClientRect: vi.fn(() => ({
      top: 14,
      left: 320,
      height: 32,
      width: 88,
      right: 408,
      bottom: 46,
    })),
    getWindowInfo: vi.fn(() => ({
      statusBarHeight: 20,
      windowWidth: 430,
      windowHeight: 932,
    })),
  })

  await import('../index')

  if (!captured) throw new Error('memo-reference-detail page config not captured')
  return captured
}

function makeInstance(pageConfig: DetailPageConfig): DetailPageInstance {
  const instance: DetailPageInstance = {
    data: {
      ...pageConfig.data,
      errorActionKind: 'retry',
      errorActionLabel: '重新加载',
    },
    _modifyingMemoId: null,
    setData: vi.fn((patch: Record<string, unknown>) => {
      instance.data = { ...instance.data, ...patch }
    }),
    loadMemoReferenceDetail: pageConfig.loadMemoReferenceDetail,
    loadFriendMemoReferenceDetail: pageConfig.loadFriendMemoReferenceDetail,
    _navOptions: (pageConfig as unknown as DetailPageInstance)._navOptions,
    _ensureRelationSwipeCtx: vi.fn(),
    _applyRelationTabStateAfterDataChange: vi.fn(),
  }
  return instance
}

describe('memo-reference-detail share entry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getSessionMock.mockReturnValue({
      user: { username: 'alice', nickname: 'Alice', login_name: 'alice', has_login_password: false },
    })
  })

  it('resolves self viewer role when share entry owner matches session', async () => {
    loadSelfMemoReferenceDetailDataMock.mockResolvedValue(emptyDetailData())
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.onLoad.call(instance, {
      entry: 'share',
      memoId: '7',
      ownerUsername: 'alice',
    })

    expect(instance.data.entry).toBe('share')
    expect(instance.data.rootViewerRole).toBe('self')
    expect(instance.data.owner).toBe('self')
    expect(instance.data.navTitle).toBe('我的笔记')
    expect(loadSelfMemoReferenceDetailDataMock).toHaveBeenCalledWith(7)
    expect(loadFriendMemoReferenceDetailDataMock).not.toHaveBeenCalled()
  })

  it('resolves friend viewer role and uses nickname in navTitle when share owner is a friend', async () => {
    getFriendSummaryMock.mockResolvedValue(
      friendSummary([
        {
          username: 'bob',
          nickname: 'Bobby',
          avatar_url: '',
          status: 'accepted',
          added_at: '2026-01-01T00:00:00Z',
        } as FriendSummary['friends'][number],
      ]),
    )
    loadFriendMemoReferenceDetailDataMock.mockResolvedValue(emptyDetailData())
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.onLoad.call(instance, {
      entry: 'share',
      memoId: '12',
      ownerUsername: 'bob',
    })

    expect(instance.data.rootViewerRole).toBe('friend')
    expect(instance.data.owner).toBe('friend')
    expect(instance.data.navTitle).toBe('Bobby的笔记')
    expect(loadFriendMemoReferenceDetailDataMock).toHaveBeenCalledWith(12, 'bob')
    expect(loadSelfMemoReferenceDetailDataMock).not.toHaveBeenCalled()
  })

  it('short-circuits with denied state when share entry has no session', async () => {
    getSessionMock.mockReturnValue({ user: null })
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.onLoad.call(instance, {
      entry: 'share',
      memoId: '5',
      ownerUsername: 'bob',
    })

    expect(instance.data.rootViewerRole).toBe('denied')
    expect(instance.data.loading).toBe(false)
    expect(loadSelfMemoReferenceDetailDataMock).not.toHaveBeenCalled()
    expect(loadFriendMemoReferenceDetailDataMock).not.toHaveBeenCalled()
  })

  it('handleHomeTap reLaunches to the home route', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.handleHomeTap.call(instance)

    expect(reLaunchMock).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })

  it('reLaunches home when share-entry root card is deleted', async () => {
    loadSelfMemoReferenceDetailDataMock.mockResolvedValue({
      ...emptyDetailData(),
      rootCard: { id: 7, ownerUsername: '', content: 'hi', tags: [] },
    })
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = {
      ...instance.data,
      entry: 'share',
      rootCard: { id: 7, ownerUsername: '', content: 'hi', tags: [] },
    }

    pageConfig._handleMemoDeleted.call(instance, 7)

    expect(reLaunchToHomeMock).toHaveBeenCalledTimes(1)
  })

  it('defaults entry to in-app when no entry option is provided', async () => {
    const pageConfig = await loadPageConfig()
    expect(pageConfig.data.entry).toBe('in-app')
  })

  it('stores overlay-nav metrics on load for in-app entry', async () => {
    loadSelfMemoReferenceDetailDataMock.mockResolvedValue(emptyDetailData())
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.onLoad.call(instance, { memoId: '7' })

    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({
      navOverlayHeight: 48,
      navStatusMaskHeight: 20,
    }))
  })

  it('opens nested self-memo reference without routeType in share entry (defaults to cupertino)', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = { ...instance.data, entry: 'share', owner: 'self', rootCard: null }

    pageConfig.handleMemoReferenceTap.call(instance, { detail: { memoId: 42 } })

    expect(openMemoReferenceDetailMock).toHaveBeenCalledWith(42, undefined)
  })

  it('opens nested friend-memo reference without routeType in share entry', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = { ...instance.data, entry: 'share', owner: 'friend', rootCard: null }

    pageConfig.handleMemoReferenceTap.call(instance, {
      detail: { memoId: 42, ownerUsername: 'bob' },
    })

    expect(openFriendMemoReferenceDetailMock).toHaveBeenCalledWith(42, { ownerUsername: 'bob' })
  })

  it('opens nested reference with cupertino-inside in in-app entry', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = { ...instance.data, entry: 'in-app', owner: 'self', rootCard: null }

    pageConfig.handleMemoReferenceTap.call(instance, { detail: { memoId: 42 } })

    expect(openMemoReferenceDetailMock).toHaveBeenCalledWith(42, { routeType: 'cupertino-inside' })
  })

  it('opens nested friend-reference with cupertino-inside in in-app entry', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data = { ...instance.data, entry: 'in-app', owner: 'friend', rootCard: null }

    pageConfig.handleMemoReferenceTap.call(instance, {
      detail: { memoId: 42, ownerUsername: 'bob' },
    })

    expect(openFriendMemoReferenceDetailMock).toHaveBeenCalledWith(42, {
      ownerUsername: 'bob',
      routeType: 'cupertino-inside',
    })
  })

  it('clears stale modifying state on show after returning from the tag picker without apply', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance._modifyingMemoId = 7
    instance.data = { ...instance.data, loading: true }

    pageConfig.onShow.call(instance)

    expect(instance._modifyingMemoId).toBeNull()
  })

  it('handleClose navigates back one page', async () => {
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    pageConfig.handleClose.call(instance)

    expect((globalThis as any).wx.navigateBack).toHaveBeenCalledWith({ delta: 1 })
  })
})
