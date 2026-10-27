import type { MemoQueryDraft } from '../../models/memo'
import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'
import { bindMemoList, type MemoListBinding } from '../../store/store-bindings/bind-memo-list'
import type { MemoListEntry } from '../../store/memo-cache-types'
import { memoListKeyFromQuery } from '../../store/workspace-keys'
import { formatLocalDateInputValue } from '../../utils/memo-date-filter'
import { resolveHomeNavTitle } from '../../utils/home-nav-title'
import {
  buildMemoListSearchQuery,
  cloneMemoQueryDraft,
  createEmptyMemoQueryDraft,
  formatMemoFacetLabel,
  formatMemoQueryDateLabel,
  hasActiveMemoQuery,
  isSameMemoQueryDraft,
  normalizeMemoQueryDraft,
} from '../../utils/memo-query'
import {
  makeMemoListOnChange,
  type MemoCardItem,
  type MemoRenderListItem,
} from '../../utils/memo-list-presentation'
import {
  openMemoComposeTagPicker,
  type MemoSearchInitPayload,
} from '../../utils/navigation'
import {
  dispatchMemoAddTag,
  copyMemoContentForCard,
  dispatchMemoCardTap,
  dispatchMemoDelete,
  dispatchMemoEdit,
  dispatchMemoModifyTag,
  dispatchMemoQuote,
  dispatchMemoReferenceTap,
  dispatchMemoRemoveTag,
  openMemoShareForCard,
  resetMemoCardTap,
  shouldSkipLoadMore,
} from '../../utils/memo-list-card-actions'
import {
  buildTitleMenuWithOptionalAllTags,
  isAllTagsTitleMenuAction,
  isMemoSortNewestFirstTitleMenuAction,
  isMemoSortOldestFirstTitleMenuAction,
  isParentTagTitleMenuAction,
  isRefreshTitleMenuAction,
  runSearchPageRefreshActions,
} from '../../utils/page-refresh'
import { parentTagPath } from '../../utils/tag-path'
import {
  derivePageNavChromeTransparent,
  resolvePageNavChromeMetrics,
} from '../../utils/page-nav-chrome'
import { applyNavStatusBarStyle } from '../../utils/theme'
import { resolvePermissions, type MemoPermissions, type ViewerRole } from '../../utils/memo-permissions'
import {
  readMemoCreatedAtSort,
  writeMemoCreatedAtSort,
  type MemoCreatedAtSort,
} from '../../utils/memo-list-sort-prefs'
import type { PopoverMenuItem } from '../../components/weimo-popover-menu/index'
import {
  createMemoListSingletonMenuData,
  memoListSingletonMenuMethods,
  type PageWithMemoListSingletonMenu,
} from '../../utils/memo-list-singleton-menu'
import {
  createMemoScopeStrategy,
  type MemoScopeStrategy,
  type CardActionContext,
} from '../../utils/memo-scope'
import { getSession } from '../../utils/session'
import {
  shouldHoldSearchRenderTransition,
  shouldSearchFromDraft,
} from './view-state'

const PAGE_SIZE = 8

function selfUserLabelForSearchNav(): string | null {
  const user = getSession().user
  if (!user) return null
  const label = String(user.nickname || user.username || '').trim()
  return label.length > 0 ? label : null
}

function resolveSearchNavBarTitle(selectedTag: string, windowWidth: number): string {
  return resolveHomeNavTitle(selectedTag, windowWidth, selfUserLabelForSearchNav())
}

interface SearchPageData {
  draft: MemoQueryDraft
  showTagFilterBadge: boolean
  showDateFilterBadge: boolean
  dateLabel: string
  facetLabel: string
  hasActiveQuery: boolean
  todayValue: string
  keywordFocus: boolean
  keyboardHeight: number
  viewerRole: ViewerRole
  memoCards: MemoCardItem[]
  memoRenderCards: MemoRenderListItem[]
  memoNextCursor: string | null
  memoHasMore: boolean
  memoListInitialized: boolean
  memoListRefreshing: boolean
  memoListLoadingMore: boolean
  memoListInitialLoadFailed: boolean
  memoListLoadMoreFailed: boolean
  emptyTitle: string
  emptyDescription: string
  enteringCardMap: Record<string, true> | null
  titleMenuItems: PopoverMenuItem[]
  memoCreatedAtSort: MemoCreatedAtSort
  navBarTitle: string
  navChromeTransparent: boolean
  navBarOverlayHeight: number
  navBarStatusMaskHeight: number
}

interface SearchPageCustom {
  _eventChannel: WechatMiniprogram.EventChannel | null
  _memoListBinding: MemoListBinding | null
  _strategy: MemoScopeStrategy
  _searchMemoListOnChange: ((entry: MemoListEntry | undefined) => void) | null
  _searchResultsScrollView: WechatMiniprogram.ScrollViewContext | null
  _renderTransitionHoldActive?: boolean
  _currentListKey: () => string
  _filterTransitionPrevIds: Set<number> | null
  _filterTransitionActive: boolean
  _enteringCleanupTimer: number | null
  _keywordDebounceTimer: number | null
  _lastCardTapMemoId: number | null
  _lastCardTapAt: number
  _navChromeLastScrollTop: number
  _deletingMemoId: number | null
  _modifyingMemoId: number | null
  _cardActionContext: () => CardActionContext
  _permissionsFor: (memoId: number) => MemoPermissions
  resetRenderTransitionState: () => void
  prepareRenderTransitionState: (holdRender: boolean) => void
  cacheSearchResultsScrollView: () => void
  resetSearchResultsScroll: () => void
  syncDraft: (nextDraft: MemoQueryDraft) => void
  bindDraftMemoList: (
    draft: MemoQueryDraft,
    options?: { holdRender?: boolean },
  ) => Promise<void>
  clearSearchMemoList: () => void
  refreshMemoList: () => Promise<void>
  applyMemoCreatedAtSortChange: (sort: MemoCreatedAtSort) => Promise<void>
  updateEmptyState: () => void
  loadMoreMemoList: () => Promise<void>
  handleKeywordInput: (event: WechatMiniprogram.Input) => void
  handleKeywordClear: () => void
  handleDayPick: (event: WechatMiniprogram.CustomEvent<{ value: string }>) => void
  handleClearDate: () => void
  handleClearFacet: () => void
  handleTagPick: () => void
  handleKeywordConfirm: () => void
  handleTitleMenuSelect: (event: WechatMiniprogram.CustomEvent<{ id: string }>) => void
  handleKeyboardHeightChange: (event: WechatMiniprogram.CustomEvent<{ height: number }>) => void
  handlePageScroll: (event: WechatMiniprogram.ScrollViewScroll) => void
  handleScrollToLower: () => void
  handleLoadMore: () => void
  handleRetryLoad: () => void
  handleMemoCardTap: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoEdit: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoQuote: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoReferenceTap: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoDelete: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoModifyTag: (
    event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
  ) => void
  handleMemoTagAdd: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoTagRemove: (event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string }>) => void
  handleMemoShare: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoCopy: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleMemoTagTap: (event: WechatMiniprogram.CustomEvent<{ tag: string }>) => void
}

Page({
  data: {
    draft: createEmptyMemoQueryDraft() as MemoQueryDraft,
    showTagFilterBadge: false,
    showDateFilterBadge: false,
    dateLabel: '',
    facetLabel: '',
    hasActiveQuery: false,
    todayValue: '',
    keywordFocus: true,
    keyboardHeight: 0,
    viewerRole: 'self' as ViewerRole,
    memoCards: [] as MemoCardItem[],
    memoRenderCards: [] as MemoRenderListItem[],
    memoNextCursor: null,
    memoHasMore: false,
    memoListInitialized: false,
    memoListRefreshing: false,
    memoListLoadingMore: false,
    memoListInitialLoadFailed: false,
    memoListLoadMoreFailed: false,
    emptyTitle: '还没有笔记',
    emptyDescription: '换个关键词试试，或返回首页新建一条笔记',
    enteringCardMap: null as Record<string, true> | null,
    ...createMemoListSingletonMenuData(),
    memoCreatedAtSort: readMemoCreatedAtSort(),
    titleMenuItems: buildTitleMenuWithOptionalAllTags('', true, readMemoCreatedAtSort()),
    navBarTitle: 'weimo',
    navChromeTransparent: false,
    navBarOverlayHeight: 0,
    navBarStatusMaskHeight: 0,
  },

  _eventChannel: null,
  _memoListBinding: null as MemoListBinding | null,
  _strategy: null as unknown as MemoScopeStrategy,
  _searchMemoListOnChange: null as ((entry: MemoListEntry | undefined) => void) | null,
  _searchResultsScrollView: null as WechatMiniprogram.ScrollViewContext | null,
  _renderTransitionHoldActive: false,
  _filterTransitionPrevIds: null as Set<number> | null,
  _filterTransitionActive: false,
  _enteringCleanupTimer: null as number | null,
  _keywordDebounceTimer: null as number | null,
  _lastCardTapMemoId: null,
  _lastCardTapAt: 0,
  _navChromeLastScrollTop: 0,
  _deletingMemoId: null,
  _modifyingMemoId: null,

  _currentListKey() {
    return memoListKeyFromQuery(
      buildMemoListSearchQuery(normalizeMemoQueryDraft(this.data.draft), this.data.memoCreatedAtSort),
      PAGE_SIZE,
    )
  },

  _cardActionContext(): CardActionContext {
    return {
      memoCards: this.data.memoCards,
      host: this,
      refreshList: () => this.refreshMemoList(),
    }
  },

  ...memoListSingletonMenuMethods,

  _permissionsFor(_memoId: number): MemoPermissions {
    return resolvePermissions(this.data.viewerRole)
  },

  onLoad() {
    this._strategy = createMemoScopeStrategy(() => this.data.memoCreatedAtSort)

    const now = new Date()
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const windowInfo = wx.getWindowInfo()
    const navChromeMetrics = resolvePageNavChromeMetrics(windowInfo, {
      top: capsuleRect.top,
      left: capsuleRect.left,
      height: capsuleRect.height,
    })

    this.setData({
      todayValue: formatLocalDateInputValue(now),
      navBarOverlayHeight: navChromeMetrics.overlayHeight,
      navBarStatusMaskHeight: navChromeMetrics.statusMaskHeight,
    })

    this._eventChannel = this.getOpenerEventChannel()
    if (this._eventChannel) {
      this._eventChannel.on('memo-search-init', (payload: MemoSearchInitPayload) => {
        this._strategy = createMemoScopeStrategy(() => this.data.memoCreatedAtSort)
        this.syncDraft(payload.draft)
      })
    }

    void this.bindDraftMemoList(this.data.draft)
  },

  onShow() {
    applyNavStatusBarStyle()
    const w = wx.getWindowInfo().windowWidth
    const sort = this.data.memoCreatedAtSort
    this.setData({
      navBarTitle: resolveSearchNavBarTitle(this.data.draft.selectedTag, w),
      titleMenuItems: buildTitleMenuWithOptionalAllTags(this.data.draft.selectedTag, true, sort),
    })
    this._modifyingMemoId = null
  },

  onReady() {
    this.cacheSearchResultsScrollView()
  },

  onUnload() {
    this._memoListBinding?.unsubscribe()
    this._memoListBinding = null
    this._searchMemoListOnChange = null
    this._searchResultsScrollView = null
    if (this._enteringCleanupTimer != null) {
      clearTimeout(this._enteringCleanupTimer)
      this._enteringCleanupTimer = null
    }
    if (this._keywordDebounceTimer != null) {
      clearTimeout(this._keywordDebounceTimer)
      this._keywordDebounceTimer = null
    }
  },

  resetRenderTransitionState() {
    this._renderTransitionHoldActive = false
    this._filterTransitionPrevIds = null
    this._filterTransitionActive = false
  },

  prepareRenderTransitionState(holdRender: boolean) {
    this._renderTransitionHoldActive = holdRender

    const prevCards = this.data.memoCards
    if (prevCards.length > 0) {
      this._filterTransitionPrevIds = new Set(prevCards.map((card) => card.id))
      this._filterTransitionActive = true
      return
    }

    this._filterTransitionPrevIds = null
    this._filterTransitionActive = false
  },

  cacheSearchResultsScrollView() {
    const query = wx.createSelectorQuery()
    query.select('#search-results-scroll').node()
    query.exec((res) => {
      const scrollView = (
        res?.[0] as { node?: WechatMiniprogram.ScrollViewContext } | undefined
      )?.node
      this._searchResultsScrollView = scrollView ?? null
    })
  },

  resetSearchResultsScroll() {
    this._searchResultsScrollView?.scrollTo({
      top: 0,
      animated: true,
    })
    this._navChromeLastScrollTop = 0
    if (this.data.navChromeTransparent) {
      this.setData({ navChromeTransparent: false })
    }
  },

  syncDraft(nextDraft: MemoQueryDraft) {
    const draft = cloneMemoQueryDraft(nextDraft)
    const draftChanged = !isSameMemoQueryDraft(draft, this.data.draft)
    const shouldResetSearchResultsScroll = shouldSearchFromDraft(draft) && draftChanged
    const holdRender = shouldHoldSearchRenderTransition({
      currentDraft: this.data.draft,
      nextDraft: draft,
      memoListInitialized: this.data.memoListInitialized,
    })

    const w = wx.getWindowInfo().windowWidth
    const normalizedDraft = normalizeMemoQueryDraft(draft)
    const willSearch = shouldSearchFromDraft(normalizedDraft)
    this.setData({
      draft,
      showTagFilterBadge: Boolean(normalizedDraft.selectedTag),
      showDateFilterBadge: Boolean(normalizedDraft.dateValue),
      dateLabel: formatMemoQueryDateLabel(draft),
      facetLabel: formatMemoFacetLabel(draft.listFacet),
      hasActiveQuery: hasActiveMemoQuery(draft),
      navBarTitle: resolveSearchNavBarTitle(draft.selectedTag, w),
      titleMenuItems: buildTitleMenuWithOptionalAllTags(
        draft.selectedTag,
        true,
        this.data.memoCreatedAtSort,
      ),
      ...(willSearch && draftChanged
        ? { memoCards: [], memoRenderCards: [], memoListRefreshing: true }
        : {}),
    })

    if (shouldResetSearchResultsScroll) {
      this.resetSearchResultsScroll()
    }

    if (!holdRender) {
      this.updateEmptyState()
    }

    void this.bindDraftMemoList(draft, { holdRender })
  },

  clearSearchMemoList() {
    this._memoListBinding?.unsubscribe()
    this._memoListBinding = null
    this.resetRenderTransitionState()
    this.setData({
      memoCards: [],
      memoRenderCards: [],
      memoNextCursor: null,
      memoHasMore: false,
      memoListInitialized: true,
      memoListRefreshing: false,
      memoListLoadingMore: false,
      memoListInitialLoadFailed: false,
      memoListLoadMoreFailed: false,
      enteringCardMap: null,
    })
    this.updateEmptyState()
  },

  async bindDraftMemoList(
    draft: MemoQueryDraft,
    options: { holdRender?: boolean } = {},
  ) {
    const normalizedDraft = normalizeMemoQueryDraft(draft)
    if (!shouldSearchFromDraft(normalizedDraft)) {
      this.clearSearchMemoList()
      return
    }

    const sort = this.data.memoCreatedAtSort
    this.prepareRenderTransitionState(options.holdRender === true)

    const searchQuery = buildMemoListSearchQuery(normalizedDraft, sort)
    const nextKey = memoListKeyFromQuery(
      searchQuery,
      PAGE_SIZE,
    )

    this._memoListBinding?.unsubscribe()
    const innerOnChange = makeMemoListOnChange(this, {
      highlightKeyword: normalizedDraft.keyword,
    })
    this._searchMemoListOnChange = innerOnChange
    this._memoListBinding = bindMemoList(nextKey, innerOnChange)

    try {
      await workspaceStore.ensureMemoList(
        nextKey,
        searchQuery,
        PAGE_SIZE,
      )
    } catch {
      // Error state is pushed to page via binding
    }
  },

  updateEmptyState() {
    const normalizedDraft = normalizeMemoQueryDraft(this.data.draft)
    const { keyword } = normalizedDraft
    const shouldSearch = shouldSearchFromDraft(normalizedDraft)

    let emptyTitle = '输入关键词开始搜索'
    let emptyDescription = '可结合标签或日期筛选'

    if (shouldSearch) {
      if (this.data.memoListRefreshing) {
        emptyTitle = '搜索中'
        emptyDescription = ''
      } else {
        emptyTitle = `没有找到包含「${keyword}」的笔记`
        emptyDescription = ''
      }
    }

    this.setData({ emptyTitle, emptyDescription })
  },

  async refreshMemoList() {
    if (!shouldSearchFromDraft(this.data.draft)) {
      this.clearSearchMemoList()
      return
    }

    await workspaceStore.refreshMemoList(this._currentListKey())
  },

  async applyMemoCreatedAtSortChange(sort: MemoCreatedAtSort) {
    writeMemoCreatedAtSort(sort)
    const draft = this.data.draft
    const tag = draft.selectedTag
    await new Promise<void>((resolve) => {
      this.setData({
        memoCreatedAtSort: sort,
        titleMenuItems: buildTitleMenuWithOptionalAllTags(tag, true, sort),
      }, () => {
        resolve()
      })
    })
    const normalizedDraft = normalizeMemoQueryDraft(draft)
    if (!shouldSearchFromDraft(normalizedDraft)) return

    this.resetSearchResultsScroll()
    await this.bindDraftMemoList(draft)
  },

  handleKeywordInput(event: WechatMiniprogram.Input) {
    const keyword = event.detail.value || ''
    if (this._keywordDebounceTimer != null) {
      clearTimeout(this._keywordDebounceTimer)
    }
    this._keywordDebounceTimer = setTimeout(() => {
      this._keywordDebounceTimer = null
      this.syncDraft({
        ...this.data.draft,
        keyword,
      })
    }, 100) as unknown as number
  },

  handleKeywordClear() {
    if (this._keywordDebounceTimer != null) {
      clearTimeout(this._keywordDebounceTimer)
      this._keywordDebounceTimer = null
    }
    this.resetRenderTransitionState()
    this.syncDraft({
      ...this.data.draft,
      keyword: '',
    })
  },

  handleDayPick(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const dateValue = String(event.detail?.value || '')
    if (!dateValue) return

    this.syncDraft({
      ...this.data.draft,
      dateMode: 'day',
      dateValue,
    })
  },

  handleClearDate() {
    if (!this.data.draft.dateValue) return

    this.syncDraft({
      ...this.data.draft,
      dateMode: 'day',
      dateValue: '',
    })
  },

  handleClearFacet() {
    if (this.data.draft.listFacet === 'none') return

    this.syncDraft({
      ...this.data.draft,
      listFacet: 'none',
    })
  },

  handleTagPick() {
    const selectedTagContext = (this.data.draft.selectedTag || '')
      .replace(/^#+/, '')
      .trim()

    openMemoComposeTagPicker(
      {
        mode: 'pick',
        targetTag: '',
        selectedTags: selectedTagContext ? [selectedTagContext] : [],
        initialDraft: this.data.draft.selectedTag,
      },
      (result) => {
        const nextSelectedTags = Array.isArray(result?.selectedTags)
          ? result.selectedTags
              .map((tag) => String(tag || '').trim())
              .filter(Boolean)
          : []
        const picked = nextSelectedTags[nextSelectedTags.length - 1] || ''
        if (!picked) return
        this.syncDraft({
          ...this.data.draft,
          selectedTag: picked,
        })
      },
      { routeType: 'cupertino' },
    )
  },

  handleKeywordConfirm() {
    this.setData({ keywordFocus: false })
  },

  handleTitleMenuSelect(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0

    const id = String(event.detail?.id || '')
    if (isParentTagTitleMenuAction(id)) {
      const parent = parentTagPath(this.data.draft.selectedTag)
      if (!parent) return
      this.syncDraft({ ...this.data.draft, selectedTag: parent })
      return
    }
    if (isAllTagsTitleMenuAction(id)) {
      this.syncDraft({ ...this.data.draft, selectedTag: '' })
      return
    }
    if (isMemoSortNewestFirstTitleMenuAction(id)) {
      if (this.data.memoCreatedAtSort !== 'desc') {
        void this.applyMemoCreatedAtSortChange('desc')
      }
      return
    }
    if (isMemoSortOldestFirstTitleMenuAction(id)) {
      if (this.data.memoCreatedAtSort !== 'asc') {
        void this.applyMemoCreatedAtSortChange('asc')
      }
      return
    }
    if (!isRefreshTitleMenuAction(id)) return

    void runSearchPageRefreshActions({
      refreshMemoList: () => this.refreshMemoList(),
    })
  },

  handleKeyboardHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    const height = event.detail?.height ?? 0
    if (height === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: height })
  },

  handlePageScroll(event: WechatMiniprogram.ScrollViewScroll) {
    const scrollTop = event.detail.scrollTop
    const nextTransparent = derivePageNavChromeTransparent({
      scrollTop,
      previousScrollTop: this._navChromeLastScrollTop,
      isTransparent: this.data.navChromeTransparent,
    })
    this._navChromeLastScrollTop = scrollTop

    if (nextTransparent !== this.data.navChromeTransparent) {
      this.setData({ navChromeTransparent: nextTransparent })
    }
  },

  handleScrollToLower() {
    if (
      shouldSkipLoadMore({
        initialized: this.data.memoListInitialized,
        initialLoadFailed: this.data.memoListInitialLoadFailed,
        refreshing: this.data.memoListRefreshing,
        loadingMore: this.data.memoListLoadingMore,
        loadMoreFailed: this.data.memoListLoadMoreFailed,
        hasMore: this.data.memoHasMore,
        nextCursor: this.data.memoNextCursor,
      })
    ) return
    void this.loadMoreMemoList()
  },

  handleLoadMore() {
    void this.loadMoreMemoList()
  },

  handleRetryLoad() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    void this.bindDraftMemoList(this.data.draft)
  },

  async loadMoreMemoList() {
    if (!shouldSearchFromDraft(this.data.draft)) return

    if (
      this.data.memoListRefreshing ||
      this.data.memoListLoadingMore ||
      !this.data.memoHasMore ||
      !this.data.memoNextCursor
    ) {
      return
    }
    await workspaceStore.loadMoreMemoList(this._currentListKey())
  },

  handleMemoCardTap(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoCardTap(this, memoId)
  },

  handleMemoEdit(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoEdit(this, memoId)
  },

  handleMemoQuote(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoQuote(this, memoId)
  },

  handleMemoReferenceTap(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoReferenceTap(this, memoId)
  },

  handleMemoDelete(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoDelete(this, memoId)
  },

  handleMemoModifyTag(
    event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
  ) {
    const memoId = event.detail?.memoId
    const targetTag = String(event.detail?.tag || '').trim()
    if (!memoId || !targetTag) return
    dispatchMemoModifyTag(
      this,
      memoId,
      targetTag,
      event.detail?.allowMultiTag === true ? { allowMultiTag: true } : undefined,
    )
  },

  handleMemoTagAdd(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoAddTag(this, memoId)
  },

  handleMemoTagRemove(event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string }>) {
    const memoId = event.detail?.memoId
    const tag = String(event.detail?.tag || '').trim()
    if (!memoId || !tag) return
    dispatchMemoRemoveTag(this, memoId, tag)
  },

  handleMemoShare(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    resetMemoCardTap(this)
    const memoId = event.detail?.memoId
    if (!memoId) return
    openMemoShareForCard(this.data.memoCards, memoId)
  },

  handleMemoCopy(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    resetMemoCardTap(this)
    const memoId = event.detail?.memoId
    if (!memoId) return
    copyMemoContentForCard(this.data.memoCards, memoId)
  },

  handleMemoTagTap(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const tag = String(event.detail?.tag || '').trim()
    if (!tag) return

    this.syncDraft({
      ...this.data.draft,
      selectedTag: tag,
    })
  },

} satisfies PageWithMemoListSingletonMenu<SearchPageData, SearchPageCustom>)
