import { beforeEach, describe, expect, it, vi } from 'vitest'

type SearchPageConfig = {
  syncDraft: (this: {
    data: {
      draft: MemoQueryDraft
      memoListInitialized: boolean
      navChromeTransparent: boolean
    }
    setData: (patch: Record<string, unknown>) => void
    updateEmptyState: () => void
    bindDraftMemoList: (draft: MemoQueryDraft, options?: { holdRender?: boolean }) => void
    resetSearchResultsScroll: () => void
  }, nextDraft: MemoQueryDraft) => void
  resetSearchResultsScroll: (this: {
    data: { navChromeTransparent: boolean }
    setData: (patch: Record<string, unknown>) => void
    _navChromeLastScrollTop: number
    _searchResultsScrollView: { scrollTo: (options: { top: number; animated: boolean }) => void } | null
  }) => void
}

async function loadPageConfig(): Promise<SearchPageConfig> {
  let captured: SearchPageConfig | undefined

  vi.stubGlobal('Page', (options: SearchPageConfig) => {
    captured = options
  })
  vi.stubGlobal('wx', {
    getWindowInfo: vi.fn(() => ({ windowWidth: 393 })),
    nextTick: vi.fn((callback: () => void) => callback()),
  })

  await import('../index')

  if (!captured) {
    throw new Error('search page config was not captured')
  }

  return captured
}

describe('search page scroll reset on query change', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('resets results scroll when the next draft changes and still triggers search', async () => {
    const pageConfig = await loadPageConfig()
    const resetSearchResultsScroll = vi.fn()

    pageConfig.syncDraft.call(
      {
        data: {
          draft: {
            keyword: '',
            selectedTag: '',
            dateMode: 'day',
            dateValue: '',
          },
          memoListInitialized: true,
          navChromeTransparent: true,
        },
        setData: vi.fn(),
        updateEmptyState: vi.fn(),
        bindDraftMemoList: vi.fn(),
        resetSearchResultsScroll,
      },
      {
        keyword: 'milk',
        selectedTag: '',
        dateMode: 'day',
        dateValue: '',
      },
    )

    expect(resetSearchResultsScroll).toHaveBeenCalledTimes(1)
  })

  it('does not reset results scroll when the next draft clears into the non-search state', async () => {
    const pageConfig = await loadPageConfig()
    const resetSearchResultsScroll = vi.fn()

    pageConfig.syncDraft.call(
      {
        data: {
          draft: {
            keyword: 'milk',
            selectedTag: '',
            dateMode: 'day',
            dateValue: '',
          },
          memoListInitialized: true,
          navChromeTransparent: true,
      },
      setData: vi.fn(),
      updateEmptyState: vi.fn(),
      bindDraftMemoList: vi.fn(),
      resetSearchResultsScroll,
      },
      {
        keyword: '',
        selectedTag: '',
        dateMode: 'day',
        dateValue: '',
      },
    )

    expect(resetSearchResultsScroll).not.toHaveBeenCalled()
  })

  it('scrolls to top and clears transparent nav state when resetting search results scroll', async () => {
    const pageConfig = await loadPageConfig()
    const scrollTo = vi.fn()
    const setData = vi.fn()
    const instance = {
      data: {
        navChromeTransparent: true,
      },
      setData,
      _navChromeLastScrollTop: 128,
      _searchResultsScrollView: {
        scrollTo,
      },
    }

    pageConfig.resetSearchResultsScroll.call(instance)

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, animated: true })
    expect(instance._navChromeLastScrollTop).toBe(0)
    expect(setData).toHaveBeenCalledWith({ navChromeTransparent: false })
  })

  it('does nothing when the scroll-view context is still missing', async () => {
    const pageConfig = await loadPageConfig()
    const setData = vi.fn()
    const instance = {
      data: {
        navChromeTransparent: false,
      },
      setData,
      _navChromeLastScrollTop: 128,
      _searchResultsScrollView: null,
    }

    pageConfig.resetSearchResultsScroll.call(instance)

    expect(instance._navChromeLastScrollTop).toBe(0)
    expect(setData).not.toHaveBeenCalled()
  })
})
