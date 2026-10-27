import type { MemoCardItem } from '../../utils/memo-list-presentation'
import type { MemoRefId } from '../../models/memo'
import { readMemoCardDoubleTapBehavior } from '../../utils/memo-card-double-tap-prefs'
import {
  type CardActionsHost,
  confirmDeleteMemo,
  copyMemoContentForCard,
  detectMemoCardDoubleTap,
  openEditComposeForCard,
  openMemoShareForCard,
  openQuoteComposeForCard,
  runMemoAddTagFromList,
  runMemoModifyTag,
  runMemoRemoveTagFromMemo,
} from '../../utils/memo-list-card-actions'
import {
  removeMemoReferenceDetailCard,
  updateMemoReferenceDetailCardTags,
} from '../../utils/memo-reference-detail'
import {
  emptyMemoReferenceDetailData,
  loadMemoReferenceListData,
  loadSelfMemoReferenceDetailData,
} from '../../utils/memo-reference-detail-loader'
import {
  openMemoReferenceDetail,
  openMemoShareImage,
  reLaunchToHome,
} from '../../utils/navigation'
import { toErrorMessage } from '../../utils/request'
import { applyNavStatusBarStyle } from '../../utils/theme'
import { resolvePermissions, type MemoPermissions, type ViewerRole } from '../../utils/memo-permissions'
import { getSession } from '../../utils/session'
import { AppRoutes } from '../../utils/routes'
import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'
import { ownMemoIdFromRef } from '../../utils/memo-ref-id'
import {
  createRelationTabState,
  reduceRelationTabExitComplete,
  reduceRelationTabOnCardsChange,
  reduceRelationTabOnSelect,
  RELATION_TAB_EXIT_TRANSITION_MS,
  type RelationTabKey,
  type RelationTabRenderState,
} from '../../utils/memo-reference-relation-tab'
import { computeRelationGestureFillHeightPx } from '../../components/memo-reference-detail-view/relation-swipe-gesture'

type ErrorActionKind = 'retry' | 'home'

function retryActionState() {
  return {
    errorActionKind: 'retry' as ErrorActionKind,
    errorActionLabel: '重试',
  } as const
}

type MemoReferenceDetailMode = 'detail' | 'references'
type MemoReferenceDetailEntry = 'share' | 'in-app'

interface RelationSwipeContext {
  progress: SkylineSharedValue<number>
}

interface MemoReferenceDetailPageInstance {
  _relationSwipeProgress?: SkylineSharedValue<number>
  applyAnimatedStyle: (
    selector: string,
    updater: () => Record<string, string | number>,
  ) => void
}

function parseMemoRefList(value: string | undefined): MemoRefId[] {
  if (!value) return []

  const seen = new Set<MemoRefId>()
  const refs: MemoRefId[] = []
  value.split(',').forEach((part) => {
    const decoded = (() => {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })().trim()
    if (!decoded) return

    const ownMemoId = ownMemoIdFromRef(decoded)
    if (ownMemoId === null) return
    const normalizedRef = String(ownMemoId)
    if (seen.has(normalizedRef)) return
    seen.add(normalizedRef)
    refs.push(normalizedRef)
  })
  return refs
}

interface MemoReferenceDetailPageData {
  entry: MemoReferenceDetailEntry
  mode: MemoReferenceDetailMode
  cardMenuActive: boolean
  cardGestureGateActive: boolean
  rootViewerRole: ViewerRole
  navTitle: string
  navOverlayHeight: number
  navStatusMaskHeight: number
  memoId: number | null
  referenceMemoRefs: MemoRefId[]
  rootCard: MemoCardItem | null
  referenceCards: MemoCardItem[]
  referencedByCards: MemoCardItem[]
  loading: boolean
  errorMessage: string
  errorActionKind: ErrorActionKind
  errorActionLabel: string
  selectedRelationTab: RelationTabKey
  tabRenderState: RelationTabRenderState
  tabSliderAnimated: boolean
  relationGestureFillStyle: string
}

interface MemoReferenceDetailPageCustom {
  loadMemoReferenceDetail: (memoId: number) => Promise<void>
  loadMemoReferenceList: (memoRefs: MemoRefId[]) => Promise<void>
  handleRetry: () => void
  handleClose: () => void
  handleHomeTap: () => void
  handleMemoReferenceTap: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardTap: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardEdit: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardQuote: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardDelete: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardModifyTag: (
    event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
  ) => void
  handleCardTagAdd: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardTagRemove: (event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string }>) => void
  handleCardCopy: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleCardShare: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void
  handleRelationTabTap: (event: { currentTarget?: { dataset?: { tab?: string } } }) => void
  handleRelationTabSwipe: (event: WechatMiniprogram.CustomEvent<{ tab?: string }>) => void
  handleRelationPanelLayout: () => void
  handleCardGestureGateChange: (event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) => void
  handleCardMenuChange: (event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) => void
  _syncRelationGestureFill: () => void
  _syncRelationTabFromData: () => Partial<MemoReferenceDetailPageData>
  _applyRelationTabStateAfterDataChange: () => void
  _setDataWithRelationTab: (patch: Record<string, unknown>) => void
  _clearRelationTabExitTimer: () => void
  _ensureRelationSwipeCtx: () => boolean
  _refreshAfterMemoComposeSaved: () => Promise<void>
  _getAllCards: () => MemoCardItem[]
  _permissionsFor: (memoId: number) => MemoPermissions
  _createCardActionsHost: () => CardActionsHost
  _handleMemoDeleted: (memoId: number) => void
  _handleMemoTagsUpdated: (memoId: number, tags: string[]) => void
  _navOptions: <T extends Record<string, unknown>>(extra?: T) => (T & { routeType?: string }) | undefined
  _lastCardTapMemoId: number | null
  _lastCardTapAt: number
  _deletingMemoId: number | null
  _modifyingMemoId: number | null
  _relationTabExitTimer: ReturnType<typeof setTimeout> | null
}

Page<MemoReferenceDetailPageData, MemoReferenceDetailPageCustom>({
  data: {
    entry: 'in-app' as MemoReferenceDetailEntry,
    mode: 'detail' as MemoReferenceDetailMode,
    cardMenuActive: false,
    cardGestureGateActive: false,
    rootViewerRole: 'self' as ViewerRole,
    navTitle: '笔记详情',
    navOverlayHeight: 0,
    navStatusMaskHeight: 0,
    memoId: null,
    referenceMemoRefs: [] as MemoRefId[],
    rootCard: null as MemoCardItem | null,
    referenceCards: [] as MemoCardItem[],
    referencedByCards: [] as MemoCardItem[],
    loading: true,
    errorMessage: '',
    ...retryActionState(),
    ...createRelationTabState(),
    relationGestureFillStyle: '',
  },

  _lastCardTapMemoId: null,
  _lastCardTapAt: 0,
  _deletingMemoId: null,
  _modifyingMemoId: null,
  _relationTabExitTimer: null,

  async onLoad(options: Record<string, string | undefined>) {
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const { statusBarHeight = 0 } = wx.getWindowInfo()
    const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })
    const entry: MemoReferenceDetailEntry = options.entry === 'share' ? 'share' : 'in-app'

    this.setData({
      navOverlayHeight: compactNavLayout.overlayHeight,
      navStatusMaskHeight: statusBarHeight || capsuleRect.top,
    })

    if (entry === 'share') {
      const memoId = Number(options.memoId)
      if (!Number.isFinite(memoId) || memoId <= 0 || !getSession().user) {
        this.setData({
          entry,
          loading: false,
          rootViewerRole: 'denied',
          memoId: null,
        })
        return
      }
      this.setData({
        entry,
        memoId,
        rootViewerRole: 'self',
        navTitle: '我的笔记',
        mode: 'detail',
        referenceMemoRefs: [],
      })
      void this.loadMemoReferenceDetail(memoId)
      return
    }

    const mode: MemoReferenceDetailMode = options.mode === 'references' ? 'references' : 'detail'
    const memoRefs = parseMemoRefList(options.memoRefs || options.memoIds)
    const memoId = Number(options.memoId)
    const navTitle = mode === 'references' ? `引用 ${memoRefs.length} 条笔记` : '笔记详情'

    if (mode === 'references' && memoRefs.length > 0) {
      this.setData({
        entry,
        mode,
        rootViewerRole: 'self',
        navTitle,
        memoId: null,
        referenceMemoRefs: memoRefs,
      })
      void this.loadMemoReferenceList(memoRefs)
      return
    }

    if (!Number.isFinite(memoId) || memoId === 0) {
      this.setData({
        entry,
        mode,
        rootViewerRole: 'self',
        navTitle,
        memoId: null,
        referenceMemoRefs: memoRefs,
        loading: false,
        errorMessage: '笔记详情加载失败',
      })
      return
    }

    this.setData({ entry, mode, rootViewerRole: 'self', navTitle, memoId, referenceMemoRefs: [] })
    void this.loadMemoReferenceDetail(memoId)
  },

  onShow() {
    applyNavStatusBarStyle()
    this._ensureRelationSwipeCtx()

    // picker 在「取消 / 选回原标签」路径下不会回调 onApplied，导致 _modifyingMemoId
    // 永久滞留。利用「picker 关闭 → 详情页 onShow」这一必经路径兜底复位。
    this._modifyingMemoId = null

    if (!this.data.loading) {
      this._applyRelationTabStateAfterDataChange()
    }
  },

  onReady() {
    this._ensureRelationSwipeCtx()
    this._syncRelationGestureFill()
  },

  onUnload() {
    this._clearRelationTabExitTimer()
  },

  _syncRelationTabFromData() {
    const d = this.data
    const result = reduceRelationTabOnCardsChange(
      {
        selectedRelationTab: d.selectedRelationTab,
        tabRenderState: d.tabRenderState,
        tabSliderAnimated: d.tabSliderAnimated,
      },
      {
        referenceCards: d.referenceCards,
        referencedByCards: d.referencedByCards,
      },
      d.mode,
    )
    return result.patch
  },

  _applyRelationTabStateAfterDataChange() {
    const tabPatch = this._syncRelationTabFromData()
    const result = reduceRelationTabOnCardsChange(
      {
        selectedRelationTab: this.data.selectedRelationTab,
        tabRenderState: this.data.tabRenderState,
        tabSliderAnimated: this.data.tabSliderAnimated,
      },
      {
        referenceCards: this.data.referenceCards,
        referencedByCards: this.data.referencedByCards,
      },
      this.data.mode,
    )

    if (Object.keys(tabPatch).length > 0) {
      this.setData(tabPatch)
    }

    if (result.cancelExit) {
      this._clearRelationTabExitTimer()
    } else if (result.scheduleExit) {
      this._clearRelationTabExitTimer()
      this._relationTabExitTimer = setTimeout(() => {
        this._relationTabExitTimer = null
        this.setData(reduceRelationTabExitComplete())
      }, RELATION_TAB_EXIT_TRANSITION_MS)
    }
  },

  _setDataWithRelationTab(patch: Record<string, unknown>) {
    const merged = { ...this.data, ...patch }
    const result = reduceRelationTabOnCardsChange(
      {
        selectedRelationTab: merged.selectedRelationTab,
        tabRenderState: merged.tabRenderState,
        tabSliderAnimated: merged.tabSliderAnimated,
      },
      {
        referenceCards: merged.referenceCards,
        referencedByCards: merged.referencedByCards,
      },
      merged.mode,
    )
    this.setData({ ...patch, ...result.patch }, () => {
      this._ensureRelationSwipeCtx()
      this._syncRelationGestureFill()
    })

    if (result.cancelExit) {
      this._clearRelationTabExitTimer()
    } else if (result.scheduleExit) {
      this._clearRelationTabExitTimer()
      this._relationTabExitTimer = setTimeout(() => {
        this._relationTabExitTimer = null
        this.setData(reduceRelationTabExitComplete())
      }, RELATION_TAB_EXIT_TRANSITION_MS)
    }
  },

  _clearRelationTabExitTimer() {
    if (this._relationTabExitTimer) {
      clearTimeout(this._relationTabExitTimer)
      this._relationTabExitTimer = null
    }
  },

  _ensureRelationSwipeCtx() {
    const detailView = this.selectComponent('#memo-reference-detail-view') as unknown as
      | { getRelationSwipeAnimationContext(): RelationSwipeContext | null }
      | null
    if (!detailView) return false
    const ctx = detailView.getRelationSwipeAnimationContext()
    if (!ctx) return false

    const self = this as unknown as MemoReferenceDetailPageInstance
    if (self._relationSwipeProgress === ctx.progress) return true
    self._relationSwipeProgress = ctx.progress
    self.applyAnimatedStyle('.memo-reference-detail-toolbar__slider', () => {
      'worklet'
      return {
        transform: `translateX(${ctx.progress.value * 100}%)`,
      }
    })
    return true
  },

  handleRelationPanelLayout() {
    this._syncRelationGestureFill()
  },

  handleCardGestureGateChange(event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) {
    const nextActive = !!event.detail?.active
    this.setData({ cardGestureGateActive: nextActive })
  },

  handleCardMenuChange(event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) {
    const nextActive = !!event.detail?.active
    this.setData({ cardMenuActive: nextActive })
  },

  _syncRelationGestureFill() {
    const shouldMeasure = this.data.mode === 'detail' &&
      !this.data.loading &&
      this.data.errorMessage.length === 0 &&
      this.data.rootViewerRole !== 'denied' &&
      this.data.tabRenderState !== 'hidden'

    if (!shouldMeasure) {
      if (this.data.relationGestureFillStyle !== '') {
        this.setData({ relationGestureFillStyle: '' })
      }
      return
    }

    wx.nextTick(() => {
      this.createSelectorQuery()
        .select('#memo-reference-detail-view >>> .memo-reference-relation-panels')
        .boundingClientRect()
        .select('.memo-reference-detail-toolbar')
        .boundingClientRect()
        .exec((res) => {
          const panelsRect = res?.[0] as WechatMiniprogram.BoundingClientRectCallbackResult | null
          const toolbarRect = res?.[1] as WechatMiniprogram.BoundingClientRectCallbackResult | null
          if (!panelsRect || !toolbarRect) return

          const fillHeight = computeRelationGestureFillHeightPx(panelsRect.bottom, toolbarRect.top)
          const nextStyle = fillHeight > 0 ? `height: ${fillHeight}px` : ''
          if (this.data.relationGestureFillStyle !== nextStyle) {
            this.setData({ relationGestureFillStyle: nextStyle })
          }
        })
    })
  },

  handleRelationTabTap(event: { currentTarget?: { dataset?: { tab?: string } } }) {
    const tab = event.currentTarget?.dataset?.tab
    const selectPatch = reduceRelationTabOnSelect(String(tab || ''))
    if (!selectPatch) return
    this.setData(selectPatch, () => {
      this._syncRelationGestureFill()
    })
  },

  handleRelationTabSwipe(event: WechatMiniprogram.CustomEvent<{ tab?: string }>) {
    const tab = String(event.detail?.tab || '')
    const selectPatch = reduceRelationTabOnSelect(tab)
    if (!selectPatch) return
    this.setData(selectPatch, () => {
      this._syncRelationGestureFill()
    })
  },

  async loadMemoReferenceDetail(memoId: number) {
    this.setData({
      loading: true,
      errorMessage: '',
      ...retryActionState(),
    })

    try {
      const projection = await loadSelfMemoReferenceDetailData(memoId)
      const isShare = this.data.entry === 'share'
      const navTitle = isShare
        ? this.data.navTitle
        : (this.data.mode === 'references' ? `引用 ${projection.referenceCards.length} 条笔记` : '笔记详情')

      this._setDataWithRelationTab({
        ...projection,
        navTitle,
        loading: false,
        errorMessage: '',
        ...retryActionState(),
      })
    } catch (err) {
      this.setData({
        loading: false,
        errorMessage: toErrorMessage(err, '笔记详情加载失败'),
        ...retryActionState(),
      })
    }
  },

  async loadMemoReferenceList(memoRefs: MemoRefId[]) {
    this.setData({
      loading: true,
      errorMessage: '',
      ...retryActionState(),
    })

    try {
      const projection = await loadMemoReferenceListData(memoRefs)

      this._setDataWithRelationTab({
        ...emptyMemoReferenceDetailData(),
        ...projection,
        navTitle: `引用 ${projection.referenceCards.length} 条笔记`,
        loading: false,
        errorMessage: '',
        ...retryActionState(),
      })
    } catch (err) {
      this.setData({
        loading: false,
        errorMessage: toErrorMessage(err, '笔记不可用'),
        ...retryActionState(),
      })
    }
  },

  async _refreshAfterMemoComposeSaved() {
    try {
      if (this.data.mode === 'references') {
        const memoRefs = this.data.referenceMemoRefs
        if (memoRefs.length === 0) return
        const projection = await loadMemoReferenceListData(memoRefs)
        this._setDataWithRelationTab({
          ...emptyMemoReferenceDetailData(),
          ...projection,
          navTitle: `引用 ${projection.referenceCards.length} 条笔记`,
          loading: false,
          errorMessage: '',
          ...retryActionState(),
        })
        return
      }

      const memoId = this.data.memoId
      if (!memoId) return

      const projection = await loadSelfMemoReferenceDetailData(memoId)
      this._setDataWithRelationTab({
        ...projection,
        navTitle: this.data.entry === 'share' ? this.data.navTitle : '笔记详情',
        loading: false,
        errorMessage: '',
        ...retryActionState(),
      })
    } catch (err) {
      wx.showToast({ title: toErrorMessage(err, '笔记详情刷新失败'), icon: 'none' })
    }
  },

  handleRetry() {
    if (this.data.errorActionKind === 'home') {
      reLaunchToHome()
      return
    }
    if (this.data.mode === 'references' && this.data.referenceMemoRefs.length > 0) {
      void this.loadMemoReferenceList(this.data.referenceMemoRefs)
      return
    }
    const memoId = this.data.memoId
    if (!memoId) return
    void this.loadMemoReferenceDetail(memoId)
  },

  handleHomeTap() {
    wx.reLaunch({ url: AppRoutes.home })
  },

  handleClose() {
    wx.navigateBack({ delta: 1 })
  },

  _navOptions<T extends Record<string, unknown>>(extra?: T): (T & { routeType?: string }) | undefined {
    if (this.data.entry === 'share') {
      return extra
    }
    return { ...((extra as Record<string, unknown>) || {}), routeType: 'cupertino-inside' } as T & { routeType?: string }
  },

  handleMemoReferenceTap(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    openMemoReferenceDetail(memoId, this._navOptions())
  },

  _getAllCards(): MemoCardItem[] {
    const d = this.data
    const seen = new Set<number>()
    const cards: MemoCardItem[] = []
    const addCard = (card: MemoCardItem) => {
      if (seen.has(card.id)) return
      seen.add(card.id)
      cards.push(card)
    }
    if (d.rootCard) addCard(d.rootCard)
    d.referenceCards.forEach(addCard)
    d.referencedByCards.forEach(addCard)
    return cards
  },

  _permissionsFor(memoId: number): MemoPermissions {
    const card = this._getAllCards().find((item) => item.id === memoId)
    if (!card) return resolvePermissions('denied')
    return resolvePermissions('self')
  },

  _handleMemoDeleted(memoId: number) {
    const d = this.data
    if (d.entry === 'share' && d.rootCard?.id === memoId) {
      reLaunchToHome()
      return
    }
    this._setDataWithRelationTab(removeMemoReferenceDetailCard({
      rootCard: d.rootCard,
      referenceCards: d.referenceCards,
      referencedByCards: d.referencedByCards,
    }, memoId, {
      includeRootCard: true,
    }))
  },

  _handleMemoTagsUpdated(memoId: number, tags: string[]) {
    const d = this.data
    this.setData(updateMemoReferenceDetailCardTags({
      rootCard: d.rootCard,
      referenceCards: d.referenceCards,
      referencedByCards: d.referencedByCards,
    }, memoId, tags, {
      includeRootCard: true,
    }))
  },

  _createCardActionsHost(): CardActionsHost {
    const page = this
    return {
      data: { memoCards: this._getAllCards() },
      get _lastCardTapMemoId() { return page._lastCardTapMemoId },
      set _lastCardTapMemoId(value: number | null) { page._lastCardTapMemoId = value },
      get _lastCardTapAt() { return page._lastCardTapAt },
      set _lastCardTapAt(value: number) { page._lastCardTapAt = value },
      get _deletingMemoId() { return page._deletingMemoId },
      set _deletingMemoId(value: number | null) { page._deletingMemoId = value },
      get _modifyingMemoId() { return page._modifyingMemoId },
      set _modifyingMemoId(value: number | null) { page._modifyingMemoId = value },
      onMemoDeleted: (memoId) => page._handleMemoDeleted(memoId),
      onMemoTagsUpdated: (memoId, tags) => page._handleMemoTagsUpdated(memoId, tags),
    }
  },

  handleCardTap(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    if (!detectMemoCardDoubleTap(this._createCardActionsHost(), memoId, Date.now())) {
      return
    }
    const p = this._permissionsFor(memoId)
    if (!p.canView) return

    const cards = this._getAllCards()

    if (readMemoCardDoubleTapBehavior() === 'preview') {
      openMemoShareForCard(cards, memoId, this._navOptions())
      return
    }

    if (p.doubleTapPreferred === 'edit') {
      openEditComposeForCard(cards, memoId, () => void this._refreshAfterMemoComposeSaved(), this._navOptions())
      return
    }

    if (p.doubleTapPreferred === 'quote') {
      this.handleCardQuote(event)
    }
  },

  handleCardEdit(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId || !this._permissionsFor(memoId).canEdit) return
    openEditComposeForCard(
      this._getAllCards(),
      memoId,
      () => void this._refreshAfterMemoComposeSaved(),
      this._navOptions(),
    )
  },

  handleCardQuote(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    if (!this._permissionsFor(memoId).canQuote) return
    openQuoteComposeForCard(this._getAllCards(), memoId, this._navOptions({
      onSaved: () => void this._refreshAfterMemoComposeSaved(),
    }))
  },

  handleCardDelete(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId || !this._permissionsFor(memoId).canDelete) return
    confirmDeleteMemo(this._createCardActionsHost(), memoId)
  },

  handleCardModifyTag(
    event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
  ) {
    const memoId = event.detail?.memoId
    const targetTag = String(event.detail?.tag || '').trim()
    if (!memoId || !targetTag || !this._permissionsFor(memoId).canModifyTag) return
    const baseOpts = event.detail?.allowMultiTag === true ? { allowMultiTag: true } : undefined
    runMemoModifyTag(
      this._createCardActionsHost(),
      memoId,
      targetTag,
      this._navOptions(baseOpts),
    )
  },

  handleCardTagAdd(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId || !this._permissionsFor(memoId).canAddTag) return
    runMemoAddTagFromList(this._createCardActionsHost(), memoId, this._navOptions())
  },

  handleCardTagRemove(event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string }>) {
    const memoId = event.detail?.memoId
    const tag = String(event.detail?.tag || '').trim()
    if (!memoId || !tag || !this._permissionsFor(memoId).canRemoveTag) return
    runMemoRemoveTagFromMemo(this._createCardActionsHost(), memoId, tag)
  },

  handleCardCopy(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    copyMemoContentForCard(this._getAllCards(), memoId)
  },

  handleCardShare(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
    const memoId = event.detail?.memoId
    if (!memoId) return
    const card = this._getAllCards().find((c) => c.id === memoId)
    if (!card) return
    openMemoShareImage({ card }, this._navOptions())
  },
})
