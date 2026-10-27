import type { MemoQueryDraft } from '../../models/memo'
import type { MemoCreatedAtSort } from '../../utils/memo-list-sort-prefs'
import type { TagTreeMeta } from '../../models/tag'
import type { WorkspaceStats } from '../../models/workspace'
import type { SidebarAnimationContext } from '../../components/home-sidebar/index'
import { getCurrentUser } from '../../services/auth'
import {
  syncWorkspaceStoreRuntime,
  workspaceStore,
} from '../../store/store-bindings/workspace-store.instance'
import { bindWorkspaceStats, type WorkspaceStatsBinding } from '../../store/store-bindings/bind-workspace-stats'
import { bindTagTree, type TagTreeBinding } from '../../store/store-bindings/bind-tag-tree'
import { bindMemoList, type MemoListBinding } from '../../store/store-bindings/bind-memo-list'
import type { MemoListEntry } from '../../store/memo-cache-types'
import { memoListKeyFromQuery } from '../../store/workspace-keys'
import { hapticTap } from '../../utils/haptic'
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
  readMemoCreatedAtSort,
  writeMemoCreatedAtSort,
} from '../../utils/memo-list-sort-prefs'
import {
  openAuthPage,
  openMemoCompose,
  openMemoComposeTagPicker,
  openMemoSearch,
  openSettings,
  reLaunchToHome,
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
import { toErrorMessage } from '../../utils/request'
import { performLogout } from '../../utils/logout'
import { getSession, hasSession, patchSession } from '../../utils/session'
import { resolvePageNavChromeMetrics } from '../../utils/page-nav-chrome'
import { applyNavStatusBarStyle } from '../../utils/theme'
import { remapSelectedTagPath } from '../../utils/tag-path'
import { resolvePermissions, type MemoPermissions, type ViewerRole } from '../../utils/memo-permissions'
import {
  createMemoListSingletonMenuData,
  memoListSingletonMenuMethods,
  type PageWithMemoListSingletonMenu,
} from '../../utils/memo-list-singleton-menu'
import {
  makeMemoListOnChange,
  type MemoCardItem,
  type MemoRenderListItem,
} from '../../utils/memo-list-presentation'
import {
  buildHomeTitleMenuItems,
  isAllTagsTitleMenuAction,
  isGuestAuthTitleMenuAction,
  isMemoSortNewestFirstTitleMenuAction,
  isMemoSortOldestFirstTitleMenuAction,
  isParentTagTitleMenuAction,
  isRefreshTitleMenuAction,
  runHomePageRefreshActions,
} from '../../utils/page-refresh'
import { parentTagPath } from '../../utils/tag-path'
import type { PopoverMenuItem } from '../../components/weimo-popover-menu/index'
import {
  deriveIndexNavChromeState,
  INDEX_NAV_CHROME_DELTA_THRESHOLD,
  INDEX_NAV_CHROME_TOP_EPS,
} from './nav-chrome-state'
import { resolveSidebarTarget, shouldAcceptSidebarGesture } from './sidebar-gesture-core'
import {
  createMemoScopeStrategy,
  type MemoScopeStrategy,
  type CardActionContext,
} from '../../utils/memo-scope'
import { deriveIndexEmptyState } from './empty-state'
import { shouldNoOpExactHomeTagReselect } from './tag-selection'

const PAGE_SIZE = 8

const { spring, runOnJS } = wx.worklet
// 与 home-sidebar 内 _animateToVisible 使用同一组弹簧参数，跨入口手感一致
const SIDEBAR_SPRING_CONFIG = { mass: 1, damping: 22, stiffness: 220 }
const SIDEBAR_NO_OP_PROGRESS_EPS = 0.01
// Skyline GestureState 枚举值：BEGIN=1, ACTIVE=2, END=3, CANCELLED=4
const GESTURE_BEGIN = 1
const GESTURE_ACTIVE = 2
const GESTURE_END = 3
const GESTURE_CANCELLED = 4
function navBarTitleLeadingIconForSelectedTag(selectedTag: string): '' | 'hashtag' {
  return String(selectedTag || '').trim() ? 'hashtag' : ''
}

function selfNavUserLabel(session: WeimoSessionState): string | null {
  if (!session.user) {
    return null
  }
  const label = String(session.user.nickname || session.user.username || '').trim()
  return label.length > 0 ? label : null
}

function selfNavTitle(
  selectedTag: string,
  windowWidthPx: number,
  session: WeimoSessionState,
): string {
  return resolveHomeNavTitle(selectedTag, windowWidthPx, selfNavUserLabel(session))
}

function buildIndexTitleMenuItems(
  selectedTag: string,
  memoCreatedAtSort: MemoCreatedAtSort,
  isLoggedIn: boolean,
): PopoverMenuItem[] {
  return buildHomeTitleMenuItems(selectedTag, {
    showGuestAuthAction: !isLoggedIn,
    memoCreatedAtSort,
  })
}

interface IndexPageData {
  session: WeimoSessionState
  sidebarVisible: boolean
  stats: WorkspaceStats | null
  statsLoading: boolean
  viewerRole: ViewerRole
  tagTreeNodes: TagTreeMeta[]
  tagTreeUntaggedCount: number
  tagTreeLoading: boolean
  tagTreeInitialized: boolean
  tagTreeLoadFailed: boolean
  memoCards: MemoCardItem[]
  memoRenderCards: MemoRenderListItem[]
  memoNextCursor: string | null
  memoHasMore: boolean
  memoListInitialized: boolean
  memoListRefreshing: boolean
  memoListLoadingMore: boolean
  memoListInitialLoadFailed: boolean
  memoListLoadMoreFailed: boolean
  memoQuery: MemoQueryDraft
  memoDateLabel: string
  memoFacetLabel: string
  emptyTitle: string
  emptyDescription: string
  emptyActionText: string
  fabCompact: boolean
  navChromeTransparent: boolean
  navBarOverlayHeight: number
  navBarStatusMaskHeight: number
  enteringCardMap: Record<string, true> | null
  navBarTitle: string
  /** 有选中标签时导航栏标题前显示 hashtag icon */
  navBarTitleLeadingIcon: '' | 'hashtag'
  titleMenuItems: PopoverMenuItem[]
  /** 笔记列表按创建时间：`desc` 最新在前；`asc` 最旧在前 */
  memoCreatedAtSort: MemoCreatedAtSort
}

interface IndexPageCustom {
  _memoListBinding: MemoListBinding | null
  _statsBinding: WorkspaceStatsBinding | null
  _tagTreeBinding: TagTreeBinding | null
  _selfMemoListOnChange: ((entry: MemoListEntry | undefined) => void) | null
  _indexPageScrollView: WechatMiniprogram.ScrollViewContext | null
  _currentListKey: () => string
  _deletingMemoId: number | null
  _modifyingMemoId: number | null
  _lastCardTapMemoId: number | null
  _lastCardTapAt: number
  _fabLastScrollTop: number
  _filterTransitionPrevIds: Set<number> | null
  _filterTransitionActive: boolean
  _enteringCleanupTimer: number | null
  _hadSessionOnLastShow: boolean
  onLoad: (options: Record<string, string | undefined>) => void
  syncUserProfile: () => Promise<void>
  createSelfMemoListOnChange: () => (entry: MemoListEntry | undefined) => void
  syncSidebarStats: () => Promise<void>
  syncTagTree: () => Promise<void>
  refreshMemoList: () => Promise<void>
  loadMoreMemoList: () => Promise<void>
  cacheIndexPageScrollView: () => void
  resetIndexPageScroll: () => void
  applyMemoQuery: (
    nextQuery: MemoQueryDraft,
    options?: { resetScroll?: boolean },
  ) => Promise<void>
  updateEmptyState: () => void
  applyMemoCreatedAtSortChange: (sort: MemoCreatedAtSort) => Promise<void>
  handleTitleMenuSelect: (event: WechatMiniprogram.CustomEvent<{ id: string }>) => void
  handleScrollToLower: () => void
  handlePageScroll: (event: WechatMiniprogram.ScrollViewScroll) => void
  handleLoadMore: () => void
  handleRetryLoad: () => void
  handleMenuTap: () => void
  handleSidebarClose: () => void
  handleSidebarVisibleChange: (event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) => void
  shouldAcceptSidebarPageDrag: (evt: { translationX: number; translationY: number }) => boolean
  handleSidebarPageDrag: (evt: {
    state: number
    deltaX: number
    velocityX: number
  }) => void
  _sidebarProgress: SkylineSharedValue<number> | null
  _sidebarDragging: SkylineSharedValue<boolean> | null
  _sidebarDragStartProgress: SkylineSharedValue<number> | null
  _sidebarPageGestureEnabled: SkylineSharedValue<number> | null
  _sidebarPanelWidthPx: number
  _sidebarFireOpenHaptic: (() => void) | null
  _sidebarFireVisibleChange: ((open: boolean) => void) | null
  _sidebarSyncLastTarget: ((open: boolean) => void) | null
  _ensureSidebarCtx: () => boolean
  handleSidebarSettings: () => void
  handleSidebarAuth: () => void
  handleSearchTap: () => void
  handleLogout: () => void
  resetFiltersAfterLogout: () => void
  handleHeatmapDateSelect: (event: WechatMiniprogram.CustomEvent<{ date: string }>) => void
  applyCurrentScopeSelectedTag: (tag: string) => void
  handleSidebarTagSelect: (event: WechatMiniprogram.CustomEvent<{ tag: string }>) => void
  handleSidebarShowAll: () => void
  handleSidebarSelectFacet: (event: WechatMiniprogram.CustomEvent<{ facet: string }>) => void
  handleClearFacet: () => void
  handleSidebarTodayReview: (event: WechatMiniprogram.CustomEvent<{ date: string }>) => void
  handleMemoTagTap: (event: WechatMiniprogram.CustomEvent<{ tag: string }>) => void
  handleClearDate: () => void
  clearMemoDateFilter: () => void
  clearSelectedTag: () => void
  clearMemoSearch: () => void
  handleEmptyAction: () => void
  handleFabTap: () => void
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
  handleCardMenuChange: (event: WechatMiniprogram.CustomEvent<{ active: boolean }>) => void
  onCardMenuActiveChange: (active: boolean) => void
  _strategy: MemoScopeStrategy
  _cardActionContext: () => CardActionContext
  _permissionsFor: (memoId: number) => MemoPermissions
  _selfViewerRole: () => ViewerRole
  handleSidebarEditTag: (event: WechatMiniprogram.CustomEvent<{ tag: string }>) => void
  handleSidebarDeleteTag: (event: WechatMiniprogram.CustomEvent<{ tag: string }>) => void
  _renamingTag: string | null
}

Page({
  data: {
    session: getSession(),
    sidebarVisible: false,
    stats: null as WorkspaceStats | null,
    statsLoading: false,
    viewerRole: 'self' as ViewerRole,
    tagTreeNodes: [] as TagTreeMeta[],
    tagTreeUntaggedCount: 0,
    tagTreeLoading: false,
    tagTreeInitialized: false,
    tagTreeLoadFailed: false,
    memoCards: [] as MemoCardItem[],
    memoRenderCards: [] as MemoRenderListItem[],
    memoNextCursor: null,
    memoHasMore: false,
    memoListInitialized: false,
    memoListRefreshing: false,
    memoListLoadingMore: false,
    memoListInitialLoadFailed: false,
    memoListLoadMoreFailed: false,
    memoQuery: createEmptyMemoQueryDraft() as MemoQueryDraft,
    memoDateLabel: '',
    memoFacetLabel: '',
    emptyTitle: '还没有笔记',
    emptyDescription: '点击 + 记录你的第一个想法',
    emptyActionText: '',
    fabCompact: false,
    navChromeTransparent: false,
    navBarOverlayHeight: 0,
    navBarStatusMaskHeight: 0,
    enteringCardMap: null as Record<string, true> | null,
    ...createMemoListSingletonMenuData(),
    navBarTitle: resolveHomeNavTitle('', wx.getWindowInfo().windowWidth, selfNavUserLabel(getSession())),
    navBarTitleLeadingIcon: '',
    memoCreatedAtSort: 'desc',
    titleMenuItems: buildIndexTitleMenuItems('', 'desc', hasSession()),
  },

  _memoListBinding: null as MemoListBinding | null,
  _statsBinding: null as WorkspaceStatsBinding | null,
  _tagTreeBinding: null as TagTreeBinding | null,
  _selfMemoListOnChange: null as ((entry: MemoListEntry | undefined) => void) | null,
  _indexPageScrollView: null as WechatMiniprogram.ScrollViewContext | null,
  _deletingMemoId: null,
  _modifyingMemoId: null,
  _lastCardTapMemoId: null,
  _lastCardTapAt: 0,
  _fabLastScrollTop: 0,
  _filterTransitionPrevIds: null as Set<number> | null,
  _filterTransitionActive: false,
  _enteringCleanupTimer: null as number | null,
  _sidebarProgress: null as SkylineSharedValue<number> | null,
  _sidebarDragging: null as SkylineSharedValue<boolean> | null,
  _sidebarDragStartProgress: null as SkylineSharedValue<number> | null,
  _sidebarPageGestureEnabled: null as SkylineSharedValue<number> | null,
  _sidebarPanelWidthPx: 0,
  _sidebarFireOpenHaptic: null as (() => void) | null,
  _sidebarFireVisibleChange: null as ((open: boolean) => void) | null,
  _sidebarSyncLastTarget: null as ((open: boolean) => void) | null,
  _hadSessionOnLastShow: false,
  _renamingTag: null as string | null,
  _strategy: null as unknown as MemoScopeStrategy,

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

  _selfViewerRole(): ViewerRole {
    return hasSession() ? 'self' : 'visitor'
  },

  _currentListKey() {
    return memoListKeyFromQuery(
      buildMemoListSearchQuery(this.data.memoQuery, this.data.memoCreatedAtSort),
      PAGE_SIZE,
    )
  },

  createSelfMemoListOnChange() {
    const onChange = makeMemoListOnChange(this)
    this._selfMemoListOnChange = onChange

    return onChange
  },

  onLoad(_options: Record<string, string | undefined>) {
    console.log('[index] onLoad fired')

    if (!this._sidebarPageGestureEnabled) {
      this._sidebarPageGestureEnabled = wx.worklet.shared(1)
    }

    const w = wx.getWindowInfo().windowWidth
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const windowInfo = wx.getWindowInfo()
    this._sidebarPageGestureEnabled.value = 1
    const normalizedInitial = normalizeMemoQueryDraft(createEmptyMemoQueryDraft())
    const effectiveMemoQuery = normalizedInitial
    const navChromeMetrics = resolvePageNavChromeMetrics(windowInfo, {
      top: capsuleRect.top,
      left: capsuleRect.left,
      height: capsuleRect.height,
    })

    const initialMemoCreatedAtSort = readMemoCreatedAtSort()

    this.setData(
      {
        viewerRole: this._selfViewerRole(),
        memoQuery: cloneMemoQueryDraft(effectiveMemoQuery),
        memoDateLabel: formatMemoQueryDateLabel(effectiveMemoQuery),
        memoFacetLabel: formatMemoFacetLabel(effectiveMemoQuery.listFacet),
        navBarOverlayHeight: navChromeMetrics.overlayHeight,
        navBarStatusMaskHeight: navChromeMetrics.statusMaskHeight,
        navBarTitle: selfNavTitle(normalizedInitial.selectedTag, w, getSession()),
        navBarTitleLeadingIcon: navBarTitleLeadingIconForSelectedTag(normalizedInitial.selectedTag),
        memoCreatedAtSort: initialMemoCreatedAtSort,
        titleMenuItems: buildIndexTitleMenuItems(
          normalizedInitial.selectedTag,
          initialMemoCreatedAtSort,
          hasSession(),
        ),
      },
      () => {
        this.updateEmptyState()
      },
    )

    this._statsBinding = bindWorkspaceStats((entry) => {
      this.setData({
        stats: entry.data ?? null,
        statsLoading: entry.status === 'loading',
      })
    })
    this._tagTreeBinding = bindTagTree((entry) => {
      const isFinalState = entry.status === 'success' || entry.status === 'error'
      this.setData({
        tagTreeNodes: entry.data ?? [],
        tagTreeLoading: entry.status === 'loading',
        tagTreeInitialized: isFinalState || (entry.data ?? []).length > 0,
        tagTreeLoadFailed: entry.status === 'error' && (!entry.data || entry.data.length === 0),
        tagTreeUntaggedCount: entry.untaggedCount ?? 0,
      })
    })

    const getMemoSort = () => this.data.memoCreatedAtSort
    this._strategy = createMemoScopeStrategy(getMemoSort)

    const initialKey = this._currentListKey()
    this._memoListBinding = bindMemoList(initialKey, this.createSelfMemoListOnChange())
    void workspaceStore.ensureMemoList(
      initialKey,
      buildMemoListSearchQuery(normalizedInitial, this.data.memoCreatedAtSort),
      PAGE_SIZE,
    )
    this._hadSessionOnLastShow = hasSession()
  },

  onReady() {
    // 提前缓存 sidebar 动画上下文（组件 attached 已完成），避免首次手势进入 worklet 时为空
    this._ensureSidebarCtx()
    this.cacheIndexPageScrollView()
  },

  onShow() {
    syncWorkspaceStoreRuntime()

    const hadSession = this._hadSessionOnLastShow
    const nowHasSession = hasSession()
    this._hadSessionOnLastShow = nowHasSession
    const sessionEnded = hadSession && !nowHasSession

    // navigationStyle: custom 下在页面可见时同步系统状态栏前景
    applyNavStatusBarStyle()
    const w = wx.getWindowInfo().windowWidth
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    const tag = currentQuery.selectedTag
    this.setData({
      session: getSession(),
      viewerRole: this._selfViewerRole(),
      navBarTitle: selfNavTitle(tag, w, getSession()),
      navBarTitleLeadingIcon: navBarTitleLeadingIconForSelectedTag(tag),
      titleMenuItems: buildIndexTitleMenuItems(tag, this.data.memoCreatedAtSort, nowHasSession),
    })

    // 异常时序兜底：onReady 已尝试过；这里再补一刀，缓存已就绪则早返回，无副作用
    this._ensureSidebarCtx()

    // picker 在「取消 / 选回原标签」路径下不会回调 onApplied，导致 _modifyingMemoId
    // 永久滞留。利用「picker 关闭 → index 页 onShow」这一必经路径兜底复位。
    this._modifyingMemoId = null

    void this.syncUserProfile()
    void workspaceStore.ensureStats()
    void workspaceStore.ensureTagTree()
    if (sessionEnded) {
      this.resetFiltersAfterLogout()
    } else {
      void workspaceStore.ensureMemoList(
        this._currentListKey(),
        buildMemoListSearchQuery(this.data.memoQuery, this.data.memoCreatedAtSort),
        PAGE_SIZE,
      )
    }
  },

  onHide() {},

  onUnload() {
    this._statsBinding?.unsubscribe()
    this._tagTreeBinding?.unsubscribe()
    this._memoListBinding?.unsubscribe()
    this._statsBinding = null
    this._tagTreeBinding = null
    this._memoListBinding = null
    this._selfMemoListOnChange = null
    this._indexPageScrollView = null
    if (this._enteringCleanupTimer != null) {
      clearTimeout(this._enteringCleanupTimer)
      this._enteringCleanupTimer = null
    }
  },

  cacheIndexPageScrollView() {
    const query = this.createSelectorQuery().in(this)
    query.select('#index-page-scroll').node()
    query.exec((res) => {
      const scrollView = (
        res?.[0] as { node?: WechatMiniprogram.ScrollViewContext } | undefined
      )?.node
      this._indexPageScrollView = scrollView ?? null
    })
  },

  resetIndexPageScroll() {
    this._indexPageScrollView?.scrollTo({
      top: 0,
      animated: true,
    })

    this._fabLastScrollTop = 0

    const patch: Partial<IndexPageData> = {}
    if (this.data.fabCompact) {
      patch.fabCompact = false
    }
    if (this.data.navChromeTransparent) {
      patch.navChromeTransparent = false
    }
    if (Object.keys(patch).length > 0) {
      this.setData(patch)
    }
  },

  async syncUserProfile() {
    if (!hasSession()) return
    try {
      const user = await getCurrentUser()
      patchSession({ user })
      const session = getSession()
      const patch: Partial<IndexPageData> = { session }
      const w = wx.getWindowInfo().windowWidth
      if (!String(this.data.memoQuery.selectedTag || '').trim()) {
        patch.navBarTitle = selfNavTitle('', w, session)
      }
      this.setData(patch)
    } catch {
      // silently fail
    }
  },

  async syncSidebarStats() {
    await workspaceStore.refreshStats()
  },

  async syncTagTree() {
    await workspaceStore.refreshTagTree()
  },

  updateEmptyState() {
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    const currentDateLabel = this._strategy.getCurrentDateLabel(this.data)

    this.setData(deriveIndexEmptyState({
      scopeKind: 'self',
      query: currentQuery,
      dateLabel: currentDateLabel,
    }))
  },

  resetFiltersAfterLogout() {
    void this.applyMemoQuery(createEmptyMemoQueryDraft(), { resetScroll: true })
  },

  async applyMemoQuery(nextQuery: MemoQueryDraft, options: { resetScroll?: boolean } = {}) {
    const normalizedQuery = normalizeMemoQueryDraft(nextQuery)
    if (isSameMemoQueryDraft(this.data.memoQuery, normalizedQuery)) {
      return
    }

    const w = wx.getWindowInfo().windowWidth
    this.setData({
      memoQuery: cloneMemoQueryDraft(normalizedQuery),
      memoDateLabel: formatMemoQueryDateLabel(normalizedQuery),
      memoFacetLabel: formatMemoFacetLabel(normalizedQuery.listFacet),
      navBarTitle: selfNavTitle(normalizedQuery.selectedTag, w, getSession()),
      navBarTitleLeadingIcon: navBarTitleLeadingIconForSelectedTag(normalizedQuery.selectedTag),
      titleMenuItems: buildIndexTitleMenuItems(
        normalizedQuery.selectedTag,
        this.data.memoCreatedAtSort,
        hasSession(),
      ),
    })

    if (options.resetScroll === true) {
      this.resetIndexPageScroll()
    }

    this.updateEmptyState()

    const prevCards = this.data.memoCards
    if (prevCards.length > 0) {
      this._filterTransitionPrevIds = new Set(prevCards.map((c) => c.id))
      this._filterTransitionActive = true
    }

    this._memoListBinding?.unsubscribe()
    const newKey = this._currentListKey()
    this._memoListBinding = bindMemoList(newKey, this.createSelfMemoListOnChange())

    try {
      await workspaceStore.ensureMemoList(
        newKey,
        buildMemoListSearchQuery(normalizedQuery, this.data.memoCreatedAtSort),
        PAGE_SIZE,
      )
    } catch {
      // 错误状态由 binding 推送到 page（memoListInitialLoadFailed 等字段）
    }
  },

  async refreshMemoList() {
    await workspaceStore.refreshMemoList(this._currentListKey())
  },

  async loadMoreMemoList() {
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

  async applyMemoCreatedAtSortChange(sort: MemoCreatedAtSort) {
    writeMemoCreatedAtSort(sort)
    const tag = this._strategy.getCurrentQuery(this.data).selectedTag
    this.setData({
      memoCreatedAtSort: sort,
      titleMenuItems: buildIndexTitleMenuItems(tag, sort, hasSession()),
    })

    this._memoListBinding?.unsubscribe()
    const newKey = this._currentListKey()
    this._memoListBinding = bindMemoList(newKey, this.createSelfMemoListOnChange())
    this.resetIndexPageScroll()
    await workspaceStore.ensureMemoList(
      newKey,
      buildMemoListSearchQuery(this.data.memoQuery, sort),
      PAGE_SIZE,
    )
  },

  handleTitleMenuSelect(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0

    const id = String(event.detail?.id || '')
    if (isGuestAuthTitleMenuAction(id)) {
      void openAuthPage({ allowBack: true })
      return
    }
    if (isParentTagTitleMenuAction(id)) {
      const parent = parentTagPath(this._strategy.getCurrentQuery(this.data).selectedTag)
      if (!parent) return
      this.applyCurrentScopeSelectedTag(parent)
      return
    }
    if (isAllTagsTitleMenuAction(id)) {
      this.clearSelectedTag()
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

    void runHomePageRefreshActions({
      refreshMemoList: () => this.refreshMemoList(),
      refreshStats: () => this.syncSidebarStats(),
      refreshTagTree: () => this.syncTagTree(),
    })
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

  handlePageScroll(event: WechatMiniprogram.ScrollViewScroll) {
    const scrollTop = event.detail.scrollTop
    const prev = this._fabLastScrollTop
    const nextTransparent = deriveIndexNavChromeState({
      scrollTop,
      previousScrollTop: prev,
      isTransparent: this.data.navChromeTransparent,
    })

    if (scrollTop <= INDEX_NAV_CHROME_TOP_EPS) {
      this._fabLastScrollTop = scrollTop
      const patch: Partial<IndexPageData> = {}
      if (this.data.fabCompact) {
        patch.fabCompact = false
      }
      if (this.data.navChromeTransparent) {
        patch.navChromeTransparent = false
      }
      if (Object.keys(patch).length > 0) {
        this.setData(patch)
      }
      return
    }

    const delta = scrollTop - prev
    this._fabLastScrollTop = scrollTop

    const patch: Partial<IndexPageData> = {}
    if (delta > INDEX_NAV_CHROME_DELTA_THRESHOLD && !this.data.fabCompact) {
      patch.fabCompact = true
    } else if (delta < -INDEX_NAV_CHROME_DELTA_THRESHOLD && this.data.fabCompact) {
      patch.fabCompact = false
    }

    if (nextTransparent !== this.data.navChromeTransparent) {
      patch.navChromeTransparent = nextTransparent
    }

    if (Object.keys(patch).length > 0) {
      this.setData(patch)
    }
  },

  handleLoadMore() {
    void this.loadMoreMemoList()
  },

  handleRetryLoad() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    void this.refreshMemoList().catch(() => {})
  },

  handleMenuTap() {
    this.setData({ sidebarVisible: true })
  },

  handleSidebarClose() {
    this.setData({ sidebarVisible: false })
  },

  handleSidebarVisibleChange(event: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    const next = !!event.detail?.visible
    if (this.data.sidebarVisible === next) return
    this.setData({ sidebarVisible: next })
  },

  /**
   * 懒加载 sidebar 动画上下文，把 SharedValue 直接挂到 page `this` 上，
   * 让 worklet 能稳定读到跨线程代理（避免通过中间普通对象间接访问）。
   * 组件 attached 早于 page onReady，正常路径下 onReady 调用即可命中；
   * onShow 兜底再调一次，覆盖某些异常时序。
   */
  _ensureSidebarCtx() {
    if (
      this._sidebarProgress &&
      this._sidebarDragging &&
      this._sidebarDragStartProgress
    ) {
      return true
    }
    const sidebar = this.selectComponent('#sidebar') as unknown as
      | { getAnimationContext(): SidebarAnimationContext | null }
      | null
    if (!sidebar) {
      return false
    }
    const ctx = sidebar.getAnimationContext()
    if (!ctx) {
      return false
    }
    this._sidebarProgress = ctx.progress
    this._sidebarDragging = ctx.dragging
    this._sidebarPanelWidthPx = ctx.panelWidthPx
    this._sidebarFireOpenHaptic = ctx.fireOpenHaptic
    this._sidebarFireVisibleChange = ctx.fireVisibleChange
    this._sidebarSyncLastTarget = ctx.syncLastTarget
    if (!this._sidebarDragStartProgress) {
      // 由页面侧自管，无需对 home-sidebar 暴露；仅供手势 BEGIN/END 间存当前段起点。
      this._sidebarDragStartProgress = wx.worklet.shared(0)
    }
    return true
  },

  shouldAcceptSidebarPageDrag(evt: { translationX: number; translationY: number }) {
    'worklet'
    const gate = this._sidebarPageGestureEnabled
    // 此前用 this.data.sidebarVisible 做门闸，但 worklet 端的 this.data 是镜像，
    // setData(sidebarVisible:true) 后镜像可能仍 stale，导致用户点遮罩时手指
    // 微抖被误接管为右滑手势，触发重复震动并把 sidebarVisible 回写成 true，
    // 覆盖 handleOverlayTap 写入的 false。改用 SharedValue（UI 线程源真相）。
    return shouldAcceptSidebarGesture({
      enabled: !gate || gate.value >= 0.5,
      progress: this._sidebarProgress ? this._sidebarProgress.value : 0,
      translationX: evt.translationX,
      translationY: evt.translationY,
    })
  },

  handleSidebarPageDrag(evt: { state: number; deltaX: number; velocityX: number }) {
    'worklet'
    const progress = this._sidebarProgress
    const dragging = this._sidebarDragging
    const startProgress = this._sidebarDragStartProgress
    const panelWidthPx = this._sidebarPanelWidthPx
    if (!progress || !dragging || !startProgress || !panelWidthPx) return

    if (evt.state === GESTURE_BEGIN) {
      const gate = this._sidebarPageGestureEnabled
      if (gate && gate.value < 0.5) return
      dragging.value = true
      startProgress.value = progress.value
      return
    }

    if (evt.state === GESTURE_ACTIVE) {
      if (!dragging.value) return
      const gate = this._sidebarPageGestureEnabled
      if (gate && gate.value < 0.5) {
        dragging.value = false
        return
      }
      const next = progress.value + evt.deltaX / panelWidthPx
      if (next < 0) {
        progress.value = 0
      } else if (next > 1) {
        progress.value = 1
      } else {
        progress.value = next
      }
      return
    }

    if (evt.state === GESTURE_END || evt.state === GESTURE_CANCELLED) {
      // 兜底：BEGIN→END 间 progress 几乎没有移动（典型轻触微抖），视为未真实
      // 拖拽，直接清 dragging 并 no-op，不写 spring、不发震动、不回写 sidebarVisible，
      // 避免覆盖 handleOverlayTap 等并发的 setData。
      if (Math.abs(progress.value - startProgress.value) < SIDEBAR_NO_OP_PROGRESS_EPS) {
        dragging.value = false
        return
      }

      const target = resolveSidebarTarget({
        progress: progress.value,
        velocityX: evt.velocityX,
      })
      const shouldOpen = target === 1
      const fireOpen = this._sidebarFireOpenHaptic
      const fireVisible = this._sidebarFireVisibleChange
      const syncLastTarget = this._sidebarSyncLastTarget

      progress.value = spring(target, SIDEBAR_SPRING_CONFIG, (finished) => {
        'worklet'
        // 被新手势打断时（finished=false），状态由后续手势收尾，避免误清 dragging
        // 与回写已过期的 sidebarVisible
        if (!finished) return
        dragging.value = false
        // 先同步 _lastTarget，避免 fireVisible 触发的 observer 把 _lastTarget 当成
        // 真正的状态变化而再跑一次 spring（会带来重复震动）
        if (syncLastTarget) {
          runOnJS(syncLastTarget)(shouldOpen)
        }
        if (shouldOpen && fireOpen) {
          runOnJS(fireOpen)()
        }
        if (fireVisible) {
          runOnJS(fireVisible)(shouldOpen)
        }
      })
    }
  },

  handleSidebarSettings() {
    this.setData({ sidebarVisible: false })
    openSettings()
  },

  handleSidebarEditTag(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0

    const oldTag = String(event.detail?.tag || '').trim()
    if (!oldTag) return
    if (!this.data.session.accessToken) return

    openMemoComposeTagPicker(
      {
        mode: 'update',
        targetTag: oldTag,
        selectedTags: [oldTag],
        initialDraft: oldTag,
        allowEmptyRemove: false,
      },
      async (result) => {
        const nextTag = String(result?.selectedTags?.[0] || '').trim()
        if (!nextTag || nextTag === oldTag) return
        if (this._renamingTag === oldTag) return

        this._renamingTag = oldTag
        try {
          const resolvedTag = await workspaceStore.renameTag(oldTag, nextTag)
          const currentQuery = cloneMemoQueryDraft(this.data.memoQuery)
          const nextSelectedTag = remapSelectedTagPath(
            currentQuery.selectedTag,
            oldTag,
            resolvedTag,
          )

          if (nextSelectedTag !== currentQuery.selectedTag) {
            await this.applyMemoQuery({
              ...currentQuery,
              selectedTag: nextSelectedTag,
            })
          }

          wx.showToast({ title: '标签已更新', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: toErrorMessage(error, '更新标签失败'), icon: 'none' })
        } finally {
          this._renamingTag = null
        }
      },
      { routeType: 'cupertino' },
    )
  },

  handleSidebarDeleteTag(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0

    const tag = String(event.detail?.tag || '').trim()
    if (!tag) return
    if (!this.data.session.accessToken) return

    wx.showModal({
      title: '删除标签',
      content: `确定删除标签「${tag}」吗？该标签将从所有笔记中移除。`,
      confirmColor: '#ff3b30',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await workspaceStore.deleteTag(tag)
          wx.showToast({ title: '标签已删除', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: toErrorMessage(error, '删除标签失败'), icon: 'none' })
        }
      },
    })
  },

  handleSearchTap() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const currentQuery = this._strategy.getCurrentQuery(this.data)

    openMemoSearch(currentQuery, (nextQuery) => {
      void this.applyMemoQuery(nextQuery)
    })
  },

  handleLogout() {
    this.resetFiltersAfterLogout()
    performLogout()
    void reLaunchToHome()
  },

  handleSidebarAuth() {
    this.setData({ sidebarVisible: false })
    void openAuthPage({ allowBack: true })
  },

  handleHeatmapDateSelect(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const date = String(event.detail?.date || '')
    if (!date) return
    const currentQuery = this._strategy.getCurrentQuery(this.data)

    void this.applyMemoQuery(
      {
        ...currentQuery,
        dateMode: 'day',
        dateValue: date,
      },
      { resetScroll: true }
    )
  },

  applyCurrentScopeSelectedTag(tag: string) {
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    if (shouldNoOpExactHomeTagReselect(currentQuery.selectedTag, tag)) return

    void this.applyMemoQuery(
      {
        ...currentQuery,
        selectedTag: tag,
      },
      { resetScroll: true }
    )
  },

  handleSidebarTagSelect(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const tag = String(event.detail?.tag || '').trim()
    if (!tag) return
    this.applyCurrentScopeSelectedTag(tag)
  },

  handleSidebarShowAll() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    if (!hasActiveMemoQuery(currentQuery)) return

    void this.applyMemoQuery(createEmptyMemoQueryDraft(), { resetScroll: true })
  },

  handleSidebarSelectFacet(event: WechatMiniprogram.CustomEvent<{ facet: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const facet = event.detail?.facet
    if (
      facet !== 'annotation' &&
      facet !== 'markdown-quote' &&
      facet !== 'heading' &&
      facet !== 'unordered-list'
    ) {
      return
    }
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    const nextQuery: MemoQueryDraft = {
      ...cloneMemoQueryDraft(currentQuery),
      listFacet: facet,
    }
    void this.applyMemoQuery(nextQuery, { resetScroll: true })
  },

  handleClearFacet() {
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    const nextQuery: MemoQueryDraft = {
      ...cloneMemoQueryDraft(currentQuery),
      listFacet: 'none',
    }
    void this.applyMemoQuery(nextQuery, { resetScroll: true })
  },

  handleSidebarTodayReview(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const date = String(event.detail?.date || '')
    if (!date) return
    const currentQuery = this._strategy.getCurrentQuery(this.data)

    void this.applyMemoQuery(
      {
        ...currentQuery,
        selectedTag: '',
        dateMode: 'day',
        dateValue: date,
      },
      { resetScroll: true }
    )
  },

  handleMemoTagTap(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const tag = String(event.detail?.tag || '').trim()
    if (!tag) return
    this.applyCurrentScopeSelectedTag(tag)
  },

  clearMemoDateFilter() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    if (!currentQuery.dateValue) return

    void this.applyMemoQuery({
      ...currentQuery,
      dateMode: 'day',
      dateValue: '',
    })
  },

  handleClearDate() {
    this.clearMemoDateFilter()
  },

  clearSelectedTag() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    if (!currentQuery.selectedTag) return

    void this.applyMemoQuery({
      ...currentQuery,
      selectedTag: '',
    })
  },

  clearMemoSearch() {
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    if (!currentQuery.keyword) return

    void this.applyMemoQuery({
      ...currentQuery,
      keyword: '',
    })
  },

  handleEmptyAction() {
    const currentQuery = this._strategy.getCurrentQuery(this.data)
    const currentDateLabel = this._strategy.getCurrentDateLabel(this.data)

    if (currentQuery.keyword) {
      this.clearMemoSearch()
    } else if (currentQuery.selectedTag) {
      this.clearSelectedTag()
    } else if (currentDateLabel) {
      this.clearMemoDateFilter()
    }
  },

  handleFabTap() {
    hapticTap('light')
    this._lastCardTapMemoId = null
    this._lastCardTapAt = 0

    const selectedTag = this._strategy.getCurrentQuery(this.data).selectedTag
    const initialTags = selectedTag ? [selectedTag] : []

    openMemoCompose({ mode: 'create', initialContent: '', initialTags, initialRefs: [] })
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
    const allowMultiTag = event.detail?.allowMultiTag === true
    dispatchMemoModifyTag(this, memoId, targetTag, allowMultiTag
      ? { allowMultiTag: true, routeType: 'cupertino' }
      : { routeType: 'cupertino' })
  },

  handleMemoTagAdd(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    dispatchMemoAddTag(this, memoId, { routeType: 'cupertino' })
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

  onCardMenuActiveChange(active: boolean) {
    const gate = this._sidebarPageGestureEnabled
    if (!gate) return
    if (active) {
      gate.value = 0
    } else {
      gate.value = 1
    }
  },

  handleCardMenuChange(event: WechatMiniprogram.CustomEvent<{ active: boolean }>) {
    const active = !!event.detail?.active
    if (!active) {
      this.closeSingletonMenu()
      return
    }
    this.setData({ cardMenuActive: true })
    this.onCardMenuActiveChange(true)
  },
} satisfies PageWithMemoListSingletonMenu<IndexPageData, IndexPageCustom>)
