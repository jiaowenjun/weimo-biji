import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../utils/request'

const loadFriendMemoReferenceDetailDataMock = vi.fn()
const loadMemoReferenceListDataMock = vi.fn()
const reLaunchToHomeMock = vi.fn()
const openFriendSearchMock = vi.fn()
const showToastMock = vi.fn()

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

vi.mock('../../../utils/memo-reference-detail-loader', () => ({
  emptyMemoReferenceDetailData: emptyDetailData,
  loadFriendMemoReferenceDetailData: (...args: unknown[]) =>
    loadFriendMemoReferenceDetailDataMock(...args),
  loadMemoReferenceListData: (...args: unknown[]) =>
    loadMemoReferenceListDataMock(...args),
  loadSelfMemoReferenceDetailData: vi.fn(),
}))

vi.mock('../../../utils/navigation', () => ({
  openMemoReferenceDetail: vi.fn(),
  openFriendMemoReferenceDetail: vi.fn(),
  openMemoShareImage: vi.fn(),
  openFriendSearch: () => openFriendSearchMock(),
  reLaunchToHome: () => reLaunchToHomeMock(),
}))

type DetailPageConfig = {
  data: Record<string, unknown>
  loadFriendMemoReferenceDetail: (memoId: number, friendUsername: string) => Promise<void>
  loadMemoReferenceList: (memoRefs: string[]) => Promise<void>
  handleRetry: () => void
}

type DetailPageInstance = {
  data: Record<string, unknown>
  setData: (patch: Record<string, unknown>) => void
  loadFriendMemoReferenceDetail: (memoId: number, friendUsername: string) => Promise<void>
  loadMemoReferenceList: (memoRefs: string[]) => Promise<void>
}

function friendConflictError(code: string, message: string) {
  return new ApiError(message, 409, { code, message })
}

async function loadPageConfig(): Promise<DetailPageConfig> {
  let captured: DetailPageConfig | undefined
  vi.stubGlobal('Page', (options: DetailPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    showToast: showToastMock,
  })

  await import('../index')

  if (!captured) throw new Error('memo-reference-detail page config not captured')
  return captured
}

function makeInstance(pageConfig: DetailPageConfig): DetailPageInstance {
  const instance: DetailPageInstance = {
    data: {
      ...pageConfig.data,
      owner: 'friend',
      rootViewerRole: 'friend',
      memoId: 9,
      friendOwnerUsername: 'bob',
      errorActionKind: 'retry',
      errorActionLabel: '重新加载',
    },
    setData: vi.fn((patch: Record<string, unknown>) => {
      instance.data = {
        ...instance.data,
        ...patch,
      }
    }),
    loadFriendMemoReferenceDetail: pageConfig.loadFriendMemoReferenceDetail,
    loadMemoReferenceList: pageConfig.loadMemoReferenceList,
  }
  return instance
}

describe('memo-reference-detail friend resource recovery', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers home action when friend detail load fails with NOT_YOUR_FRIEND', async () => {
    loadFriendMemoReferenceDetailDataMock.mockRejectedValue(
      friendConflictError('NOT_YOUR_FRIEND', '该用户不是你的好友'),
    )
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)

    await pageConfig.loadFriendMemoReferenceDetail.call(instance, 9, 'bob')

    expect(instance.data.errorMessage).toBe('该用户不是你的好友')
    expect(instance.data.errorActionLabel).toBe('返回首页')
    expect(showToastMock).toHaveBeenCalledWith({ title: '该用户不是你的好友', icon: 'none' })
    expect(loadFriendMemoReferenceDetailDataMock).toHaveBeenCalledTimes(1)

    pageConfig.handleRetry.call(instance)

    expect(reLaunchToHomeMock).toHaveBeenCalledTimes(1)
    expect(openFriendSearchMock).not.toHaveBeenCalled()
    expect(loadFriendMemoReferenceDetailDataMock).toHaveBeenCalledTimes(1)
  })

  it('offers friend search when references-only load fails with NO_FRIENDS_YET', async () => {
    loadMemoReferenceListDataMock.mockRejectedValue(
      friendConflictError('NO_FRIENDS_YET', '你还没有添加好友'),
    )
    const pageConfig = await loadPageConfig()
    const instance = makeInstance(pageConfig)
    instance.data.mode = 'references'
    instance.data.referenceMemoRefs = ['bob/9']

    await pageConfig.loadMemoReferenceList.call(instance, ['bob/9'])

    expect(instance.data.errorMessage).toBe('你还没有添加好友')
    expect(instance.data.errorActionLabel).toBe('添加朋友')
    expect(showToastMock).toHaveBeenCalledWith({ title: '你还没有添加好友', icon: 'none' })
    expect(loadMemoReferenceListDataMock).toHaveBeenCalledWith(['bob/9'])

    pageConfig.handleRetry.call(instance)

    expect(openFriendSearchMock).toHaveBeenCalledTimes(1)
    expect(reLaunchToHomeMock).toHaveBeenCalledTimes(0)
  })
})
