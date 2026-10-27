import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FriendProfile, FriendSummary } from '../../../models/friend'

const getFriendSummaryMock = vi.fn<() => Promise<FriendSummary>>()
const hasSessionMock = vi.fn(() => true)
const getSessionMock = vi.fn(() => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    username: 'alice',
    nickname: 'Alice',
    login_name: 'alice',
    has_login_password: false,
  },
}))
const createMemoScopeStrategyMock = vi.fn((scope: { kind: 'self' } | { kind: 'friend'; targetFriend: FriendProfile }) => ({
  kind: scope.kind,
  getFriend: () => (scope.kind === 'friend' ? scope.targetFriend : undefined),
  buildSearchQuery: vi.fn(),
  refresh: vi.fn(),
  loadMore: vi.fn(),
  resolveRelations: vi.fn(),
  getCurrentQuery: vi.fn(() => ({ keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' })),
  getCurrentDateLabel: vi.fn(() => ''),
  getStats: vi.fn(() => null),
  getTagTreeNodes: vi.fn(() => []),
  onCardDoubleTap: vi.fn(),
  onCardQuote: vi.fn(),
  onCardReferenceTap: vi.fn(),
}))

vi.mock('../../../services/friend', () => ({
  getFriendSummary: () => getFriendSummaryMock(),
  getFriendStats: vi.fn(),
  getFriendTagTree: vi.fn(),
  getFriendUnreadCount: vi.fn(),
}))

vi.mock('../../../utils/session', () => ({
  hasSession: () => hasSessionMock(),
  getSession: () => getSessionMock(),
  patchSession: vi.fn(),
}))

vi.mock('../../../utils/memo-scope', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/memo-scope')>(
    '../../../utils/memo-scope',
  )
  return {
    ...actual,
    createMemoScopeStrategy: (...args: Parameters<typeof actual.createMemoScopeStrategy>) =>
      createMemoScopeStrategyMock(...args),
  }
})

type IndexPageConfig = {
  data: Record<string, unknown>
  syncFriendSummary: () => Promise<void>
}

type IndexPageInstance = {
  data: Record<string, unknown>
  setData: (patch: Record<string, unknown>, callback?: () => void) => void
  switchToSelfScope: ReturnType<typeof vi.fn>
  _strategy: unknown
}

function friendSummary(friends: FriendProfile[], unreadCount = 0): FriendSummary {
  return {
    friends,
    pending_outgoing: [],
    pending_incoming_count: 0,
    unread_count: unreadCount,
  }
}

async function loadPageConfig(): Promise<IndexPageConfig> {
  let captured: IndexPageConfig | undefined

  vi.stubGlobal('Page', (options: IndexPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    worklet: {
      spring: vi.fn(),
      runOnJS: vi.fn(),
    },
    getWindowInfo: vi.fn(() => ({ windowWidth: 393 })),
  })

  await import('../index')

  if (!captured) {
    throw new Error('index page config was not captured')
  }

  return captured
}

function makeInstance(pageConfig: IndexPageConfig, overrides: Partial<Record<string, unknown>> = {}): IndexPageInstance {
  const instance: IndexPageInstance = {
    data: {
      ...pageConfig.data,
      friendProfiles: [{ username: 'bob', nickname: '旧昵称' }],
      selectedFriendUsername: 'bob',
      friendUnreadCount: 0,
      homeMemoScope: { kind: 'friend', targetFriend: { username: 'bob', nickname: '旧昵称' } },
      viewerRole: 'friend',
      memoQuery: { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
      friendMemoQuery: { keyword: '', selectedTag: '工作', dateMode: 'day', dateValue: '' },
      memoCreatedAtSort: 'desc',
      titleMenuItems: [],
      navBarTitle: '',
      navBarTitleLeadingIcon: '',
      ...overrides,
    },
    setData: vi.fn((patch: Record<string, unknown>, callback?: () => void) => {
      instance.data = {
        ...instance.data,
        ...patch,
      }
      callback?.()
    }),
    switchToSelfScope: vi.fn(() => {
      instance.data = {
        ...instance.data,
        homeMemoScope: { kind: 'self' },
      }
    }),
    _strategy: null,
  }
  return instance
}

describe('index syncFriendSummary runtime behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    hasSessionMock.mockReturnValue(true)
    getSessionMock.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'alice',
        nickname: 'Alice',
        login_name: 'alice',
        has_login_password: false,
      },
    })
  })

  it('refreshes the selected target friend snapshot when summary returns the same username', async () => {
    getFriendSummaryMock.mockResolvedValue(
      friendSummary([{ username: 'bob', nickname: '新昵称' }], 3),
    )
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.syncFriendSummary.call(instance)

    expect(instance.data.selectedFriendUsername).toBe('bob')
    expect(instance.data.friendUnreadCount).toBe(3)
    expect(instance.data.homeMemoScope).toEqual({
      kind: 'friend',
      targetFriend: { username: 'bob', nickname: '新昵称' },
    })
    expect(createMemoScopeStrategyMock).toHaveBeenCalledWith(
      { kind: 'friend', targetFriend: { username: 'bob', nickname: '新昵称' } },
      expect.any(Function),
    )
    expect(instance.switchToSelfScope).not.toHaveBeenCalled()
  })

  it('keeps an explicitly selected second friend instead of falling back to the first friend in a multi-friend summary', async () => {
    getFriendSummaryMock.mockResolvedValue(
      friendSummary([
        { username: 'bob', nickname: '小吴' },
        { username: 'carol', nickname: '新 Carol' },
      ], 5),
    )
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig, {
      friendProfiles: [
        { username: 'bob', nickname: '小吴' },
        { username: 'carol', nickname: '旧 Carol' },
      ],
      selectedFriendUsername: 'carol',
      homeMemoScope: {
        kind: 'friend',
        targetFriend: { username: 'carol', nickname: '旧 Carol' },
      },
    })

    await pageConfig.syncFriendSummary.call(instance)

    expect(instance.data.selectedFriendUsername).toBe('carol')
    expect(instance.data.friendUnreadCount).toBe(5)
    expect(instance.data.homeMemoScope).toEqual({
      kind: 'friend',
      targetFriend: { username: 'carol', nickname: '新 Carol' },
    })
    expect(createMemoScopeStrategyMock).toHaveBeenCalledWith(
      { kind: 'friend', targetFriend: { username: 'carol', nickname: '新 Carol' } },
      expect.any(Function),
    )
    expect(instance.switchToSelfScope).not.toHaveBeenCalled()
  })

  it('falls back to self scope when the selected target friend disappears from summary', async () => {
    getFriendSummaryMock.mockResolvedValue(friendSummary([], 0))
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.syncFriendSummary.call(instance)

    expect(instance.data.friendProfiles).toEqual([])
    expect(instance.data.selectedFriendUsername).toBe('')
    expect(instance.switchToSelfScope).toHaveBeenCalledTimes(1)
    expect(instance.data.homeMemoScope).toEqual({ kind: 'self' })
  })

  it('falls back to self scope instead of implicitly picking the first friend when a multi-friend selection becomes invalid', async () => {
    getFriendSummaryMock.mockResolvedValue(
      friendSummary([
        { username: 'bob', nickname: '小吴' },
        { username: 'carol', nickname: 'Carol' },
      ], 1),
    )
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig, {
      friendProfiles: [
        { username: 'bob', nickname: '小吴' },
        { username: 'dave', nickname: '旧 Dave' },
      ],
      selectedFriendUsername: 'dave',
      homeMemoScope: {
        kind: 'friend',
        targetFriend: { username: 'dave', nickname: '旧 Dave' },
      },
    })

    await pageConfig.syncFriendSummary.call(instance)

    expect(instance.data.friendProfiles).toEqual([
      { username: 'bob', nickname: '小吴' },
      { username: 'carol', nickname: 'Carol' },
    ])
    expect(instance.data.selectedFriendUsername).toBe('')
    expect(instance.switchToSelfScope).toHaveBeenCalledTimes(1)
    expect(instance.data.homeMemoScope).toEqual({ kind: 'self' })
    expect(createMemoScopeStrategyMock).not.toHaveBeenCalled()
  })
})
