import {
  clearTouchLiftTimer,
  createTouchLiftSession,
  hapticTap,
  shouldCancelTouchLift,
  TOUCH_LIFT_DELAY_MS,
  type TouchLiftSession,
} from '../../utils/haptic'
import {
  resolvePermissions,
  type MemoAction,
  type MemoPermissions,
  type ViewerRole,
} from '../../utils/memo-permissions'
import { isTagNoneMemoPlaceholder } from '../../utils/tag-none'
import { estimateMemoCardMenuPopoverHeightPx } from './menu-popover-height'
import {
  buildMemoCardMenuItems,
  type MemoCardMenuItem,
} from './menu-items'
import { buildMemoCardTagPopoverItems } from './tag-menu-items'
import { formatMemoCardDateBarText } from './date-display'

/*
 * 出场动画两阶段间隔：先写入当前高度作为动画起点，再切到折叠终点。
 */
const EXIT_PHASE_GAP_MS = 30
/** 槽位复用时 snap 清空 exitHostStyle 后再移除 inline style 的间隔 */
const EXIT_SNAP_CLEAR_MS = 0
/** 入场类移除后强制复位 inline style，避免 Skyline 动画合成残留低 opacity */
const ENTERING_SURFACE_RESET_MS = 50
/** 在真正 longpress 前，提前拉起菜单手势门禁，避免同触点续滑穿透到父级手势。 */
const MENU_GESTURE_GATE_DELAY_MS = 240
const EXIT_HOST_NEUTRAL_STYLE =
  'transform:translateX(0);opacity:1;max-height:none;margin-bottom:0'

type MemoCardPopoverMode = 'card' | 'tag'

const MENU_ID_TO_ACTION: Record<string, MemoAction> = {
  edit: 'edit',
  quote: 'quote',
  delete: 'delete',
  share: 'share',
  copy: 'copy',
  'memo-detail': 'memoDetail',
}

interface MemoReferencePreview {
  id: string
  displayText: string
}

interface OpenCardMenuOptions {
  liftCard: boolean
}

interface MemoCardMenuOpenDetail {
  memoId: number
  ownerUsername: string
  mode: MemoCardPopoverMode
  tag?: string
  triggerRect: WechatMiniprogram.BoundingClientRectCallbackResult
  items: MemoCardMenuItem[]
  estimatedHeight: number
  placementPriority: string
  horizontalAlign: string
  scaleAnchor: string
  header: string
}

Component({
  properties: {
    memoId: { type: Number, value: 0 },
    createdAtText: { type: String, value: '' },
    content: { type: String, value: '' },
    contentNodes: { type: Array, value: [] },
    renderRichText: { type: Boolean, value: true },
    tags: { type: Array, value: [] },
    referencePreview: { type: null, value: null as MemoReferencePreview | null },
    referencedByPreviews: { type: Array, value: [] as MemoReferencePreview[] },
    showReferenceBar: { type: Boolean, value: true },
    referenceDisabled: { type: Boolean, value: false },
    menuReadonly: { type: Boolean, value: false },
    viewerRole: { type: String, value: 'self' as ViewerRole },
    ownerUsername: { type: String, value: '' },
    selectedTag: { type: String, value: '' },
    exiting: { type: Boolean, value: false },
    entering: { type: Boolean, value: false },
    externalMenu: { type: Boolean, value: false },
    externalMenuActive: { type: Boolean, value: false },
    externalPopoverMode: { type: String, value: 'card' as MemoCardPopoverMode },
    menuGestureGate: { type: Boolean, value: false },
  },

  data: {
    createdAtDisplayText: '',
    menuActive: false,
    pressing: false,
    lifted: false,
    pressingTagIdx: -1,
    liftedTagIdx: -1,
    _permissions: resolvePermissions('self') as MemoPermissions,
    menuAnchorRect: null as WechatMiniprogram.BoundingClientRectCallbackResult | null,
    menuItems: buildMemoCardMenuItems([], { permissions: resolvePermissions('self') }),
    menuPopoverEstimatedHeight: estimateMemoCardMenuPopoverHeightPx(
      buildMemoCardMenuItems([], { permissions: resolvePermissions('self') }),
    ),
    popoverMode: 'card' as MemoCardPopoverMode,
    /** 三点菜单：下方优先 + 触发器右缘对齐；标签菜单：上方优先 + start 贴合左缘向右展开 */
    popoverMenuPlacementPriority: 'down-first',
    popoverMenuHorizontalAlign: 'end',
    /** 标签胶囊菜单上下文：被选中的路径字面量（含占位「无」） */
    tagPopoverTarget: '',
    /** 标签胶囊弹出层顶部标题（完整路径字面量）；三点菜单清空 */
    menuPopoverHeader: '',
    /** 标签菜单左侧锚点缩放；三点菜单为 end（关闭标签菜单后仍短时保持 start 以完成对称收起动画，打开三点时再置 end） */
    popoverScaleAnchor: 'end',
    exitHostStyle: '',
    /** list-builder 槽位复用时禁用 host transition，避免 translateX(-100%) 回弹 */
    exitHostSnapReset: false,
    /** 入场结束后短暂写入，打断 Skyline 对 memo-card--entering 的合成残留 opacity */
    memoCardSurfaceStyle: '',
  },

  observers: {
    memoId(next: number) {
      if (!(this as any)._memoRecycleReady) return
      const prev = (this as any)._priorMemoIdForRecycle as number | undefined
      ;(this as any)._priorMemoIdForRecycle = next
      if (prev === undefined || prev === next) return
      this._resetForListRecycle()
    },
    entering(val: boolean) {
      if (!val) {
        this._snapEnteringSurfaceVisible()
      }
    },
    createdAtText(value: string) {
      this._syncCreatedAtDisplayText(value)
    },
    exiting(val: boolean) {
      if (!val) {
        this._cancelExitAnimation()
        return
      }
      this._startExitAnimation()
    },
    viewerRole(role: ViewerRole) {
      this.setData({ _permissions: resolvePermissions(role) })
    },
    externalMenuActive(active: boolean) {
      if (!this.data.externalMenu || active) return
      this.setData({
        lifted: false,
        liftedTagIdx: -1,
        pressing: false,
        pressingTagIdx: -1,
      })
    },
    'tags, viewerRole, menuReadonly, showReferenceBar, referencePreview, referencedByPreviews'() {
      if (this.data.externalMenu) return
      const active = this.data.menuActive
      const tagOpen = active && this.data.popoverMode === 'tag'
      if (tagOpen) return
      this._syncMenuItems((this.data.tags as string[]) || [])
    },
  },

  lifetimes: {
    attached() {
      this._syncCreatedAtDisplayText()
      ;(this as any)._memoRecycleReady = true
      ;(this as any)._priorMemoIdForRecycle = this.data.memoId
    },
    detached() {
      this._cancelEnteringSurfaceSnap()
      this._cancelExitSnapClearTimer()
      ;(this as any)._menuGestureGateLocked = false
      this._setMenuGestureGateActive(false)
      ;(this as any)._memoRecycleReady = false
      ;(this as any)._priorMemoIdForRecycle = undefined
      if (this.data.externalMenu) {
        if (this.data.externalMenuActive) {
          this._emitMenuChange(false, 'detached-external-menu-active')
        }
        this._cancelExitAnimation({ immediate: true })
        this._cancelLift()
        this._cancelTagLift()
        return
      }
      if (this.data.menuActive) {
        this.setData({
          menuActive: false,
          lifted: false,
          popoverMode: 'card',
          tagPopoverTarget: '',
          menuPopoverHeader: '',
          popoverScaleAnchor: 'end',
        })
        this._emitMenuChange(false, 'detached-local-menu-active')
      }
      this._cancelExitAnimation({ immediate: true })
      this._cancelLift()
    },
  },

  methods: {
    _emitMenuChange(active: boolean, _reason?: string) {
      this.triggerEvent('menuchange', { active })
    },

    _cancelEnteringSurfaceSnap() {
      const t = (this as any)._enteringSurfaceClearTimer as ReturnType<typeof setTimeout> | null
      if (t != null) {
        clearTimeout(t)
        ;(this as any)._enteringSurfaceClearTimer = null
      }
      if (this.data.memoCardSurfaceStyle) {
        this.setData({ memoCardSurfaceStyle: '' })
      }
    },

    _snapEnteringSurfaceVisible() {
      const t = (this as any)._enteringSurfaceClearTimer as ReturnType<typeof setTimeout> | null
      if (t != null) {
        clearTimeout(t)
      }
      this.setData({ memoCardSurfaceStyle: 'opacity:1;transform:translateY(0)' })
      ;(this as any)._enteringSurfaceClearTimer = setTimeout(() => {
        ;(this as any)._enteringSurfaceClearTimer = null
        if (this.data.memoCardSurfaceStyle) {
          this.setData({ memoCardSurfaceStyle: '' })
        }
      }, ENTERING_SURFACE_RESET_MS)
    },

    /** list-builder 按槽位复用实例时重置与 memo 身份绑定的本地状态 */
    _resetForListRecycle() {
      ;(this as any)._menuGestureGateLocked = false
      this._setMenuGestureGateActive(false)
      this._cancelEnteringSurfaceSnap()
      this._cancelExitAnimation()
      this._cancelLift()
      this._cancelTagLift()

      if (this.data.externalMenu) {
        if (this.data.externalMenuActive) {
          this._emitMenuChange(false, 'list-recycle-external-menu-active')
        }
      } else if (this.data.menuActive) {
        this.setData({
          menuActive: false,
          lifted: false,
          popoverMode: 'card',
          tagPopoverTarget: '',
          menuPopoverHeader: '',
          popoverScaleAnchor: 'end',
        })
        this._emitMenuChange(false, 'list-recycle-local-menu-active')
      }

      const patch: Record<string, unknown> = {}
      if (this.data.pressing) patch.pressing = false
      if (this.data.lifted) patch.lifted = false
      if (this.data.pressingTagIdx !== -1) patch.pressingTagIdx = -1
      if (this.data.liftedTagIdx !== -1) patch.liftedTagIdx = -1
      if (this.data.memoCardSurfaceStyle) patch.memoCardSurfaceStyle = ''

      if (Object.keys(patch).length > 0) {
        this.setData(patch)
      }
    },

    _cancelExitSnapClearTimer() {
      const timer = (this as any)._exitSnapClearTimer as ReturnType<typeof setTimeout> | null
      if (timer != null) {
        clearTimeout(timer)
        ;(this as any)._exitSnapClearTimer = null
      }
    },

    _snapClearExitHostStyle(immediate = false) {
      if (!this.data.exitHostStyle) return

      this._cancelExitSnapClearTimer()

      if (immediate) {
        this.setData({
          exitHostSnapReset: true,
          exitHostStyle: EXIT_HOST_NEUTRAL_STYLE,
        })
        return
      }

      this.setData({
        exitHostSnapReset: true,
        exitHostStyle: EXIT_HOST_NEUTRAL_STYLE,
      })
      ;(this as any)._exitSnapClearTimer = setTimeout(() => {
        ;(this as any)._exitSnapClearTimer = null
        this.setData({
          exitHostSnapReset: true,
          exitHostStyle: '',
        })
        ;(this as any)._exitSnapClearTimer = setTimeout(() => {
          ;(this as any)._exitSnapClearTimer = null
          this.setData({ exitHostSnapReset: false })
        }, EXIT_SNAP_CLEAR_MS)
      }, EXIT_SNAP_CLEAR_MS)
    },

    _syncCreatedAtDisplayText(value?: string) {
      const createdAtDisplayText = formatMemoCardDateBarText(value ?? this.data.createdAtText)
      if (createdAtDisplayText === this.data.createdAtDisplayText) return
      this.setData({ createdAtDisplayText })
    },

    _setMenuGestureGateActive(active: boolean) {
      if (!this.properties.menuGestureGate) return
      const self = this as any
      if (!!self._menuGestureGateActive === active) return
      self._menuGestureGateActive = active
      this.triggerEvent('gesturegatechange', { active })
    },

    handleContentTap() {
      this.triggerEvent('tap', {
        memoId: this.data.memoId,
        ownerUsername: this.data.ownerUsername,
      })
    },

    handleLiftTouchStart(e: WechatMiniprogram.TouchEvent) {
      if (e.mark?.memoCardControl === 'more' || e.mark?.memoCardControl === 'tag') {
        this._cancelLift()
        return
      }
      const touch = e.touches[0]
      if (!touch) return
      ;(this as any)._menuGestureGateLocked = false
      ;(this as any)._liftSession = createTouchLiftSession(touch)
      ;(this as any)._liftTimer = setTimeout(() => {
        ;(this as any)._liftTimer = null
        this.setData({ pressing: true })
      }, TOUCH_LIFT_DELAY_MS)
      if (this.properties.menuGestureGate) {
        const gateTimer = (this as any)._menuGestureGateTimer as ReturnType<typeof setTimeout> | null
        if (gateTimer != null) {
          clearTimeout(gateTimer)
        }
        ;(this as any)._menuGestureGateTimer = setTimeout(() => {
          ;(this as any)._menuGestureGateTimer = null
          this._setMenuGestureGateActive(true)
        }, MENU_GESTURE_GATE_DELAY_MS)
      }
    },

    handleLiftTouchMove(e: WechatMiniprogram.TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      const session = (this as any)._liftSession as TouchLiftSession | undefined
      if (!session) return
      if (shouldCancelTouchLift(session, touch)) {
        if (!(this as any)._menuGestureGateLocked) {
          this._setMenuGestureGateActive(false)
        }
        this._cancelLift()
      }
    },

    handleLiftTouchEnd() {
      ;(this as any)._menuGestureGateLocked = false
      this._setMenuGestureGateActive(false)
      this._cancelLift()
    },

    _cancelLift() {
      const timer = (this as any)._liftTimer as number | null
      ;(this as any)._liftTimer = clearTouchLiftTimer(timer)
      const gateTimer = (this as any)._menuGestureGateTimer as ReturnType<typeof setTimeout> | null
      if (gateTimer != null) {
        clearTimeout(gateTimer)
        ;(this as any)._menuGestureGateTimer = null
      }
      ;(this as any)._liftSession = null
      if (this.data.pressing && !this.data.lifted) {
        this.setData({ pressing: false })
      }
      if (!(this as any)._menuGestureGateLocked) {
        this._setMenuGestureGateActive(false)
      }
    },

    handleTagTap(event: WechatMiniprogram.CustomEvent<{ value?: string }>) {
      const tag = String(event.detail?.value || '')
      if (!tag) return
      this.triggerEvent('tagtap', { tag })
    },

    handleTagTouchStart(e: WechatMiniprogram.TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      ;(this as any)._tagLiftSession = createTouchLiftSession(touch)
      const tagIdx = Number((e.currentTarget as any)?.dataset?.tagIdx)
      if (!Number.isFinite(tagIdx) || tagIdx < 0) return
      ;(this as any)._tagLiftTimer = setTimeout(() => {
        ;(this as any)._tagLiftTimer = null
        this.setData({ pressingTagIdx: tagIdx })
      }, TOUCH_LIFT_DELAY_MS)
    },

    handleTagTouchMove(e: WechatMiniprogram.TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      const session = (this as any)._tagLiftSession as TouchLiftSession | undefined
      if (!session) return
      if (shouldCancelTouchLift(session, touch)) {
        this._cancelTagLift()
      }
    },

    handleTagTouchEnd() {
      this._cancelTagLift()
    },

    _cancelTagLift() {
      const timer = (this as any)._tagLiftTimer as number | null
      ;(this as any)._tagLiftTimer = clearTouchLiftTimer(timer)
      ;(this as any)._tagLiftSession = null
      if (this.data.pressingTagIdx >= 0 && this.data.liftedTagIdx < 0) {
        this.setData({ pressingTagIdx: -1 })
      }
    },

    handleTagLongPress(event: WechatMiniprogram.BaseEvent) {
      this._cancelLift()
      const permissions = this.data._permissions as MemoPermissions
      if (
        this.data.menuReadonly ||
        (!permissions.canModifyTag && !permissions.canAddTag && !permissions.canRemoveTag)
      ) return
      const tag = String((event.currentTarget as any)?.dataset?.tag || '').trim()
      if (!tag) return
      const tagIdx = Number((event.currentTarget as any)?.dataset?.tagIdx)
      if (!Number.isFinite(tagIdx) || tagIdx < 0) return

      const query = this.createSelectorQuery().in(this)
      query.select(`#memo-card-tag-${this.data.memoId}-${tagIdx}`).boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        if (!rect) return
        hapticTap('light')
        const isNone = isTagNoneMemoPlaceholder(tag)
        const items = buildMemoCardTagPopoverItems(isNone)
        const estimatedHeight = estimateMemoCardMenuPopoverHeightPx(items)
        if (this.data.externalMenu) {
          this.setData({
            pressingTagIdx: -1,
            liftedTagIdx: tagIdx,
          })
          this.triggerEvent('menuopen', {
            memoId: this.data.memoId,
            ownerUsername: this.data.ownerUsername,
            mode: 'tag',
            tag,
            triggerRect: rect,
            items,
            estimatedHeight,
            placementPriority: 'up-first',
            horizontalAlign: 'start',
            scaleAnchor: 'start',
            header: tag,
          } as MemoCardMenuOpenDetail)
          return
        }
        this.setData({
          pressingTagIdx: -1,
          liftedTagIdx: tagIdx,
          popoverMode: 'tag',
          popoverMenuPlacementPriority: 'up-first',
          popoverMenuHorizontalAlign: 'start',
          popoverScaleAnchor: 'start',
          tagPopoverTarget: tag,
          menuPopoverHeader: tag,
          menuItems: items,
          menuPopoverEstimatedHeight: estimatedHeight,
          menuAnchorRect: rect,
          menuActive: true,
        })
        this.triggerEvent('menuchange', { active: true })
      })
    },

    handleReferenceTap() {
      if (this.data.referenceDisabled) return
      this.triggerEvent('referencetap', {
        memoId: this.data.memoId,
        ownerUsername: this.data.ownerUsername,
      })
    },

    handleMoreButtonTouchStart() {
      this._cancelLift()
    },

    handleMoreButtonTap() {
      this._openCardMenu({ liftCard: false })
    },

    handleMoreTap() {
      ;(this as any)._menuGestureGateLocked = true
      this._openCardMenu({ liftCard: true })
    },

    _openCardMenu(options: OpenCardMenuOptions) {
      const query = this.createSelectorQuery().in(this)
      if (!this.data.externalMenu) {
        this._emitMenuChange(true, 'open-card-menu')
      }
      query.select('.memo-card__more').boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        if (!rect) {
          ;(this as any)._menuGestureGateLocked = false
          this._setMenuGestureGateActive(false)
          if (!this.data.externalMenu) {
            this._emitMenuChange(false, 'card-menu-anchor-missing')
          }
          return
        }
        hapticTap('light')
        const tags = (this.data.tags as string[]) || []
        const menu = this._buildCardMenuState(tags)
        if (this.data.externalMenu) {
          this.setData({
            pressing: false,
            lifted: options.liftCard,
          })
          this.triggerEvent('menuopen', {
            memoId: this.data.memoId,
            ownerUsername: this.data.ownerUsername,
            mode: 'card',
            triggerRect: rect,
            items: menu.items,
            estimatedHeight: menu.estimatedHeight,
            placementPriority: 'down-first',
            horizontalAlign: 'end',
            scaleAnchor: 'end',
            header: '',
          } as MemoCardMenuOpenDetail)
          return
        }
        this.setData({
          pressing: false,
          lifted: options.liftCard,
          popoverMode: 'card',
          popoverMenuPlacementPriority: 'down-first',
          popoverMenuHorizontalAlign: 'end',
          popoverScaleAnchor: 'end',
          tagPopoverTarget: '',
          menuPopoverHeader: '',
          menuItems: menu.items,
          menuPopoverEstimatedHeight: menu.estimatedHeight,
          menuAnchorRect: rect,
          menuActive: true,
        })
      })
    },

    closeMenu() {
      ;(this as any)._menuGestureGateLocked = false
      if (!this.data.menuActive) return

      if (this.data.popoverMode === 'tag') {
        this.setData({
          menuActive: false,
          liftedTagIdx: -1,
        })
        this._emitMenuChange(false, 'close-menu-tag')
        return
      }

      const tags = (this.data.tags as string[]) || []
      this._syncMenuItems(tags)
      this.setData({
        menuActive: false,
        lifted: false,
        popoverMode: 'card',
        tagPopoverTarget: '',
        menuPopoverHeader: '',
        popoverScaleAnchor: 'end',
      })
      this._emitMenuChange(false, 'close-menu-card')
    },

    handleMenuClose() {
      this.closeMenu()
    },

    handleMenuSelect(event: WechatMiniprogram.CustomEvent<{ id: string; item?: MemoCardMenuItem }>) {
      const id = event.detail && event.detail.id
      if (!id) return
      if (event.detail?.item?.disabled) return
      const permissions = this.data._permissions as MemoPermissions
      const action = MENU_ID_TO_ACTION[id]
      if (action && !permissions.menuActions.has(action)) return

      const memoId = this.data.memoId
      const popoverMode = this.data.popoverMode

      if (popoverMode === 'tag') {
        const targetTag = String(this.data.tagPopoverTarget || '')
        this.closeMenu()
        if (id === 'tag-edit') {
          if (!permissions.canModifyTag) return
          if (!targetTag || isTagNoneMemoPlaceholder(targetTag)) return
          this.triggerEvent('modifytag', { memoId, tag: targetTag, allowMultiTag: true })
        } else if (id === 'tag-add') {
          if (!permissions.canAddTag) return
          this.triggerEvent('tagadd', { memoId })
        } else if (id === 'tag-remove') {
          if (!permissions.canRemoveTag) return
          if (!targetTag || isTagNoneMemoPlaceholder(targetTag)) return
          this.triggerEvent('tagremove', { memoId, tag: targetTag })
        }
        return
      }

      this.closeMenu()
      if (id === 'edit') {
        this.triggerEvent('edit', { memoId })
      } else if (id === 'quote') {
        this.triggerEvent('quote', { memoId })
      } else if (id === 'memo-detail') {
        this.triggerEvent('referencetap', { memoId, ownerUsername: this.data.ownerUsername })
      } else if (id === 'delete') {
        this.triggerEvent('delete', { memoId })
      } else if (id === 'share') {
        this.triggerEvent('share', { memoId, ownerUsername: this.data.ownerUsername })
      } else if (id === 'copy') {
        this.triggerEvent('copy', { memoId, ownerUsername: this.data.ownerUsername })
      }
    },

    _syncMenuItems(tags: string[]) {
      const menu = this._buildCardMenuState(tags)
      this.setData({
        menuItems: menu.items,
        menuPopoverEstimatedHeight: menu.estimatedHeight,
      })
    },

    _buildCardMenuState(tags: string[]) {
      const showBar = !!this.data.showReferenceBar
      const ref = this.data.referencePreview
      const by = (this.data.referencedByPreviews as unknown[]) || []
      const showMemoDetailPage = showBar && (ref != null || by.length > 0)
      const readonly = !!this.data.menuReadonly
      const menuItems = buildMemoCardMenuItems(tags, {
        permissions: this.data._permissions as MemoPermissions,
        showMemoDetailPage,
        menuReadonly: readonly,
      })
      return {
        items: menuItems,
        estimatedHeight: estimateMemoCardMenuPopoverHeightPx(menuItems),
      }
    },

    _startExitAnimation() {
      const query = this.createSelectorQuery().in(this)
      query.select('.memo-card-host').boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        if (!rect || rect.height <= 0) return
        const h = rect.height
        this.setData({
          exitHostStyle: `transform:translateX(0);opacity:1;max-height:${h}px`,
        })
        ;(this as any)._exitTimer = setTimeout(() => {
          ;(this as any)._exitTimer = null
          this.setData({
            exitHostStyle: `transform:translateX(-100%);opacity:0;max-height:0px;margin-bottom:0`,
          })
        }, EXIT_PHASE_GAP_MS)
      })
    },

    _cancelExitAnimation(options?: { immediate?: boolean }) {
      const timer = (this as any)._exitTimer as number | null
      if (timer != null) {
        clearTimeout(timer)
        ;(this as any)._exitTimer = null
      }
      this._snapClearExitHostStyle(options?.immediate ?? false)
    },

  },
})
