import type { MemoCardItem } from '../../utils/memo-list-presentation'
import type { ViewerRole } from '../../utils/memo-permissions'
import type { RelationTabKey, RelationTabRenderState } from '../../utils/memo-reference-relation-tab'
import {
  computeRelationPanelLayoutMetrics,
  RELATION_SWIPE_NO_OP_PROGRESS_EPS,
  resolveRelationSwipeTarget,
  shouldAcceptRelationSwipeGesture,
} from './relation-swipe-gesture'

type MemoReferenceDetailMode = 'detail' | 'references'

const { shared, timing, spring, runOnJS, runOnUI, Easing } = wx.worklet
const RELATION_PANELS_UNMOUNT_DELAY_MS = 32
const RELATION_SWIPE_TIMING_MS = 260
const RELATION_SWIPE_SPRING_CONFIG = { mass: 1, damping: 22, stiffness: 220 }
// Skyline GestureState: BEGIN=1, ACTIVE=2, END=3, CANCELLED=4
const GESTURE_BEGIN = 1
const GESTURE_ACTIVE = 2
const GESTURE_END = 3
const GESTURE_CANCELLED = 4

// 必须在模块顶层创建：Skyline worklet 一旦通过 `this.xxx` / `self.xxx` 读取 SharedValue，
// 会把整个 component instance 冻结，导致父页面 setData 下发 properties 时抛
// 「Cannot assign to read only property」。把状态放到模块作用域，worklet 通过闭包访问即可。
// detail page 同时只挂载一个 memo-reference-detail-view 实例，复用模块级 SharedValue 安全。
const relationProgress = shared(0)
const relationDragging = shared(false)
const relationDragStartProgress = shared(0)
const relationSelectedTabValue = shared(0)
const relationGestureEnabled = shared(0)
let relationPanelStridePx = 0
let fireRelationTabSwipeCallback: ((tab: RelationTabKey) => void) | null = null

function fireRelationTabSwipeFromUI(tab: RelationTabKey) {
  fireRelationTabSwipeCallback?.(tab)
}

interface RelationPanelsInstance {
  _relationPanelsUnmountTimer: ReturnType<typeof setTimeout> | null
  _relationAnimatedStyleBound: boolean
  _localCardMenuActive?: boolean
  _localCardGestureGateActive?: boolean
  applyAnimatedStyle: (
    selector: string,
    updater: () => Record<string, string | number>,
  ) => void
}

function relationTabValue(tab: string): 0 | 1 {
  return tab === 'referencedBy' ? 1 : 0
}

Component({
  properties: {
    mode: { type: String, value: 'detail' as MemoReferenceDetailMode },
    rootViewerRole: { type: String, value: 'self' as ViewerRole },
    rootCard: { type: null, value: null as MemoCardItem | null },
    referenceCards: { type: Array, value: [] as MemoCardItem[] },
    referencedByCards: { type: Array, value: [] as MemoCardItem[] },
    selectedRelationTab: { type: String, value: 'reference' as RelationTabKey },
    tabRenderState: { type: String, value: 'hidden' as RelationTabRenderState },
    tabSliderAnimated: { type: Boolean, value: false },
    cardMenuActive: { type: Boolean, value: false },
    relationGestureFillStyle: { type: String, value: '' },
  },

  data: {
    relationPanelsHeightStyle: '',
    relationPanelsTrackMounted: false,
  },

  observers: {
    'mode, tabRenderState, selectedRelationTab, referenceCards, referencedByCards': function () {
      this._syncRelationPanelsRenderState()
    },
    'cardMenuActive': function () {
      this._syncRelationGestureSharedValues('prop-cardMenuActive')
    },
  },

  lifetimes: {
    attached() {
      ;(this as unknown as RelationPanelsInstance)._localCardMenuActive = false
      ;(this as unknown as RelationPanelsInstance)._localCardGestureGateActive = false
      this._setupRelationSwipeAnimation()
    },

    detached() {
      ;(this as unknown as RelationPanelsInstance)._localCardMenuActive = false
      ;(this as unknown as RelationPanelsInstance)._localCardGestureGateActive = false
      this._clearRelationPanelsUnmountTimer()
      fireRelationTabSwipeCallback = null
    },
  },

  methods: {
    _setupRelationSwipeAnimation() {
      const self = this as unknown as RelationPanelsInstance
      const { windowWidth } = wx.getWindowInfo()
      relationPanelStridePx = computeRelationPanelLayoutMetrics(windowWidth).stridePx

      const initial = relationTabValue(this.properties.selectedRelationTab)
      runOnUI(() => {
        'worklet'
        relationProgress.value = initial
        relationDragStartProgress.value = initial
        relationSelectedTabValue.value = initial
        relationDragging.value = false
      })()

      fireRelationTabSwipeCallback = (tab: RelationTabKey) => {
        this.triggerEvent('relationtabswipe', { tab })
      }

      if (!self._relationAnimatedStyleBound) {
        self._relationAnimatedStyleBound = true
        self.applyAnimatedStyle('.memo-reference-relation-panels__track', () => {
          'worklet'
          return {
            transform: `translateX(${-relationProgress.value * relationPanelStridePx}px)`,
          }
        })
      }
      this._syncRelationGestureSharedValues('setup')
    },

    _clearRelationPanelsUnmountTimer() {
      const self = this as unknown as RelationPanelsInstance
      if (self._relationPanelsUnmountTimer) {
        clearTimeout(self._relationPanelsUnmountTimer)
        self._relationPanelsUnmountTimer = null
      }
    },

    _syncRelationPanelsRenderState() {
      const self = this as unknown as RelationPanelsInstance
      const mode = this.properties.mode as MemoReferenceDetailMode
      if (mode !== 'detail') {
        this._clearRelationPanelsUnmountTimer()
        if (this.data.relationPanelsTrackMounted || this.data.relationPanelsHeightStyle) {
          this.setData({
            relationPanelsTrackMounted: false,
            relationPanelsHeightStyle: '',
          }, () => {
            this._syncRelationGestureSharedValues('mode-not-detail-setdata')
          })
        }
        this._syncRelationGestureSharedValues('mode-not-detail')
        return
      }

      const tabRenderState = this.properties.tabRenderState as RelationTabRenderState
      if (tabRenderState !== 'hidden') {
        this._clearRelationPanelsUnmountTimer()
        if (!this.data.relationPanelsTrackMounted) {
          this.setData({ relationPanelsTrackMounted: true }, () => {
            this._syncRelationGestureSharedValues('track-mounted-setdata')
          })
        } else {
          this._syncRelationGestureSharedValues('track-already-mounted')
        }
        this._syncRelationPanelsHeight()
        this._animateRelationProgressToSelected()
        return
      }

      if (this.data.relationPanelsTrackMounted) {
        this._clearRelationPanelsUnmountTimer()
        self._relationPanelsUnmountTimer = setTimeout(() => {
          self._relationPanelsUnmountTimer = null
          this.setData({
            relationPanelsTrackMounted: false,
            relationPanelsHeightStyle: '',
          }, () => {
            this._syncRelationGestureSharedValues('track-unmounted-setdata')
          })
        }, RELATION_PANELS_UNMOUNT_DELAY_MS)
      }
      this._syncRelationGestureSharedValues('tab-render-hidden')
    },

    _syncRelationGestureSharedValues(_reason = 'unspecified') {
      const self = this as unknown as RelationPanelsInstance
      const nextSelectedTabValue = relationTabValue(this.properties.selectedRelationTab)
      const nextGestureEnabled = this.properties.mode === 'detail' &&
        this.properties.tabRenderState === 'visible' &&
        this.data.relationPanelsTrackMounted &&
        !this.properties.cardMenuActive &&
        !self._localCardMenuActive &&
        !self._localCardGestureGateActive
        ? 1
        : 0

      runOnUI(() => {
        'worklet'
        relationSelectedTabValue.value = nextSelectedTabValue
        relationGestureEnabled.value = nextGestureEnabled
      })()
    },

    _animateRelationProgressToSelected() {
      const target = this.properties.selectedRelationTab === 'referencedBy' ? 1 : 0
      if (this.properties.tabSliderAnimated) {
        runOnUI(() => {
          'worklet'
          if (relationDragging.value) return
          relationProgress.value = timing(target, {
            duration: RELATION_SWIPE_TIMING_MS,
            easing: Easing.cubicBezier(0.4, 0, 0.2, 1),
          })
        })()
      } else {
        runOnUI(() => {
          'worklet'
          if (relationDragging.value) return
          relationProgress.value = target
        })()
      }
    },

    getRelationSwipeAnimationContext(): { progress: SkylineSharedValue<number> } {
      return { progress: relationProgress }
    },

    shouldAcceptRelationPanelDrag(evt: { translationX: number; translationY: number }) {
      'worklet'
      const enabled = relationGestureEnabled.value >= 0.5
      const selectedRelationTab: RelationTabKey =
        relationSelectedTabValue.value >= 0.5 ? 'referencedBy' : 'reference'
      return shouldAcceptRelationSwipeGesture({
        enabled,
        selectedRelationTab,
        translationX: evt.translationX,
        translationY: evt.translationY,
      })
    },

    shouldRespondRelationPanelDrag() {
      'worklet'
      return relationGestureEnabled.value >= 0.5
    },

    handleRelationPanelDrag(evt: { state: number; deltaX: number; velocityX: number }) {
      'worklet'
      if (!relationPanelStridePx) return

      if (evt.state === GESTURE_BEGIN) {
        relationDragging.value = true
        relationDragStartProgress.value = relationProgress.value
        return
      }

      if (evt.state === GESTURE_ACTIVE) {
        if (!relationDragging.value) return
        const next = relationProgress.value - evt.deltaX / relationPanelStridePx
        if (next < 0) {
          relationProgress.value = 0
        } else if (next > 1) {
          relationProgress.value = 1
        } else {
          relationProgress.value = next
        }
        return
      }

      if (evt.state === GESTURE_END || evt.state === GESTURE_CANCELLED) {
        const startValue = relationDragStartProgress.value
        const moved = Math.abs(relationProgress.value - startValue)
        const target = moved < RELATION_SWIPE_NO_OP_PROGRESS_EPS
          ? startValue
          : resolveRelationSwipeTarget({
            progress: relationProgress.value,
            velocityX: evt.velocityX,
          })
        const targetTab: RelationTabKey = target === 1 ? 'referencedBy' : 'reference'

        relationProgress.value = spring(target, RELATION_SWIPE_SPRING_CONFIG, (finished) => {
          'worklet'
          if (!finished) return
          relationDragging.value = false
          if (target !== startValue) {
            runOnJS(fireRelationTabSwipeFromUI)(targetTab)
          }
        })
      }
    },

    _syncRelationPanelsHeight() {
      const mode = this.properties.mode as MemoReferenceDetailMode
      const tabRenderState = this.properties.tabRenderState as RelationTabRenderState
      if (
        mode !== 'detail' ||
        !this.data.relationPanelsTrackMounted ||
        tabRenderState === 'hidden'
      ) {
        return
      }

      const selectedRelationTab = this.properties.selectedRelationTab as RelationTabKey
      const panelSelector = selectedRelationTab === 'reference'
        ? '.memo-reference-relation-panels__panel--active[data-relation-panel="reference"]'
        : '.memo-reference-relation-panels__panel--active[data-relation-panel="referencedBy"]'

      wx.nextTick(() => {
        this.createSelectorQuery()
          .in(this)
          .select(panelSelector)
          .boundingClientRect((rect) => {
            if (!rect || typeof rect.height !== 'number' || rect.height <= 0) return
            const nextStyle = `height: ${rect.height}px`
            if (this.data.relationPanelsHeightStyle !== nextStyle) {
              this.setData({ relationPanelsHeightStyle: nextStyle }, () => {
                this.triggerEvent('relationpanellayout')
              })
              return
            }
            this.triggerEvent('relationpanellayout')
          })
          .exec()
      })
    },

    handleCardTap(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardtap', event.detail)
    },

    handleCardEdit(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardedit', event.detail)
    },

    handleCardQuote(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardquote', event.detail)
    },

    handleCardDelete(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('carddelete', event.detail)
    },

    handleCardModifyTag(
      event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
    ) {
      this.triggerEvent('cardmodifytag', event.detail)
    },

    handleCardTagAdd(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardtagadd', event.detail)
    },

    handleCardTagRemove(event: WechatMiniprogram.CustomEvent<{ memoId: number; tag: string }>) {
      this.triggerEvent('cardtagremove', event.detail)
    },

    handleMemoReferenceTap(
      event: WechatMiniprogram.CustomEvent<{ memoId: number }>,
    ) {
      this.triggerEvent('cardreferencetap', event.detail)
    },

    handleCardShare(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardshare', event.detail)
    },

    handleCardCopy(event: WechatMiniprogram.CustomEvent<{ memoId: number }>) {
      this.triggerEvent('cardcopy', event.detail)
    },

    handleCardMenuChange(event: WechatMiniprogram.CustomEvent<{ active: boolean }>) {
      const self = this as unknown as RelationPanelsInstance
      self._localCardMenuActive = !!event.detail?.active
      this._syncRelationGestureSharedValues('detail-view-menuchange')
      this.triggerEvent('menuchange', event.detail)
    },

    handleCardGestureGateChange(event: WechatMiniprogram.CustomEvent<{ active: boolean }>) {
      const self = this as unknown as RelationPanelsInstance
      self._localCardGestureGateActive = !!event.detail?.active
      this._syncRelationGestureSharedValues('detail-view-gesturegatechange')
      this.triggerEvent('gesturegatechange', event.detail)
    },
  },
})
