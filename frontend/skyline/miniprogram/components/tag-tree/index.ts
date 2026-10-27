import type { TagTreeMeta } from '../../models/tag'
import { reorderTagTreeSiblingsNoneLast } from '../../utils/tag-sort'
import { buildVisibleTagTreeRows, type VisibleTagTreeRow } from '../../utils/tag-tree'
import { TAG_NONE_LITERAL } from '../../utils/tag-none'
import {
  clearTouchLiftTimer,
  createTouchLiftSession,
  hapticTap,
  shouldCancelTouchLift,
  TOUCH_LIFT_DELAY_MS,
  type TouchLiftSession,
} from '../../utils/haptic'
import { buildTagTreeMenuItems } from './menu-items'

const MAX_VISUAL_DEPTH = 4
const ANIM_DURATION = 200
/** 在真正 longpress 前提前拉起门禁，避免同触点续滑带动侧边栏滚动。 */
const MENU_GESTURE_GATE_DELAY_MS = 240

function formatTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface GuideSlot {
  d: number
  g: number
}

type TagTreeRowWithGuides = VisibleTagTreeRow & {
  guideSlots: GuideSlot[]
  enter?: boolean
}

function attachGuideSlots(rows: VisibleTagTreeRow[]): TagTreeRowWithGuides[] {
  return rows.map((row) => {
    const cappedDepth = Math.min(row.depth, MAX_VISUAL_DEPTH)
    const guideSlots: GuideSlot[] = []
    for (let d = 0; d < cappedDepth; d++) {
      guideSlots.push({ d, g: 1 })
    }
    return { ...row, guideSlots }
  })
}

interface StagedRowsResult {
  stagedRows: TagTreeRowWithGuides[]
  enteringTags: Set<string>
  removingTags: Set<string>
}

interface OpenTagMenuOptions {
  liftRow: boolean
}

interface MenuGateCandidate {
  tag: string
  index: number
}

function computeStagedRows(
  nextRows: TagTreeRowWithGuides[],
  oldRows: TagTreeRowWithGuides[],
  pendingRemovals: Map<string, number>,
): StagedRowsResult {
  const oldByTag = new Map<string, TagTreeRowWithGuides>()
  oldRows.forEach((r) => oldByTag.set(r.tag, r))
  const nextTags = new Set(nextRows.map((r) => r.tag))

  nextRows.forEach((r) => {
    const timer = pendingRemovals.get(r.tag)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingRemovals.delete(r.tag)
    }
  })

  const stagedRows: TagTreeRowWithGuides[] = nextRows.map((r) => {
    const existed = oldByTag.get(r.tag)
    const visibleAlready = existed && !existed.enter
    return { ...r, enter: !visibleAlready }
  })

  const removingTags = new Set<string>()
  const inserts: { at: number; row: TagTreeRowWithGuides }[] = []
  const survivorIndex = new Map<string, number>()
  stagedRows.forEach((r, i) => survivorIndex.set(r.tag, i))

  let lastSurvivor = -1
  for (const old of oldRows) {
    if (nextTags.has(old.tag)) {
      lastSurvivor = survivorIndex.get(old.tag)!
      continue
    }
    if (pendingRemovals.has(old.tag)) continue
    inserts.push({ at: lastSurvivor + 1, row: { ...old, enter: false } })
    removingTags.add(old.tag)
  }

  let finalRows: TagTreeRowWithGuides[] = stagedRows
  if (inserts.length > 0) {
    inserts.sort((a, b) => a.at - b.at)
    finalRows = []
    let insIdx = 0
    for (let i = 0; i <= stagedRows.length; i++) {
      while (insIdx < inserts.length && inserts[insIdx].at === i) {
        finalRows.push(inserts[insIdx].row)
        insIdx++
      }
      if (i < stagedRows.length) finalRows.push(stagedRows[i])
    }
  }

  const enteringTags = new Set(stagedRows.filter((r) => r.enter).map((r) => r.tag))
  return { stagedRows: finalRows, enteringTags, removingTags }
}

Component({
  properties: {
    nodes: { type: Array, value: [] },
    untaggedCount: { type: Number, value: 0 },
    loading: { type: Boolean, value: false },
    initialized: { type: Boolean, value: false },
    loadFailed: { type: Boolean, value: false },
    selectedTag: { type: String, value: '' },
    hasDateFilter: { type: Boolean, value: false },
    activeDate: { type: String, value: '' },
    authenticated: { type: Boolean, value: false },
    tagMenuEnabled: { type: Boolean, value: true },
    listFacet: { type: String, value: 'none' },
  },

  data: {
    expandedTags: [] as string[],
    visibleRows: [] as TagTreeRowWithGuides[],
    allNotesSelected: false,
    allNotesExpanded: false,
    todayReviewSelected: false,
    menuActive: false,
    liftedIndex: -1,
    pressingIndex: -1,
    menuAnchorRect: null as WechatMiniprogram.BoundingClientRectCallbackResult | null,
    menuTag: '',
    menuHeaderLabel: '',
    menuItems: [] as ReturnType<typeof buildTagTreeMenuItems>,
  },

  observers: {
    'nodes, selectedTag, untaggedCount'() {
      this.rebuildVisibleRows()
    },

    'selectedTag, hasDateFilter, activeDate, listFacet'(
      selectedTag: string,
      hasDateFilter: boolean,
      activeDate: string,
      listFacet: string,
    ) {
      const todayKey = formatTodayKey()
      this.setData({
        allNotesSelected: selectedTag === '' && !hasDateFilter && listFacet === 'none',
        todayReviewSelected: selectedTag === '' && activeDate === todayKey,
      })
    },

    'authenticated, tagMenuEnabled'(authenticated: boolean, tagMenuEnabled: boolean) {
      const enabled = !!authenticated && !!tagMenuEnabled
      this.setData({
        menuItems: buildTagTreeMenuItems(enabled),
      })
      if (!enabled && this.data.menuActive) {
        this.closeMenu()
      }
    },
  },

  lifetimes: {
    attached() {
      this.setData({
        menuItems: buildTagTreeMenuItems(
          !!this.properties.authenticated && !!this.properties.tagMenuEnabled,
        ),
      })
    },

    detached() {
      const removals = (this as any)._pendingRemovals as Map<string, number> | undefined
      if (removals) {
        removals.forEach((id) => clearTimeout(id))
        removals.clear()
      }
      const gateTimer = (this as any)._menuGestureGateTimer as ReturnType<typeof setTimeout> | null
      if (gateTimer != null) {
        clearTimeout(gateTimer)
        ;(this as any)._menuGestureGateTimer = null
      }
      ;(this as any)._menuGestureGateLocked = false
      this._setMenuGestureGateActive(false)
    },
  },

  methods: {
    _resolveMenuGateCandidate(event: WechatMiniprogram.BaseEvent): MenuGateCandidate | null {
      if (!this.data.tagMenuEnabled) return null
      if (!this.data.menuItems.length) return null

      const tag = String((event.currentTarget as any)?.dataset?.tag || '')
      const index = Number((event.currentTarget as any)?.dataset?.index)
      if (!tag || Number.isNaN(index) || index < 0) return null
      if (tag === TAG_NONE_LITERAL) return null

      const row = (this.data.visibleRows as TagTreeRowWithGuides[]).find((item) => item.tag === tag)
      if (!row) return null

      return { tag, index }
    },

    _setMenuGestureGateActive(active: boolean) {
      const self = this as any
      if (!!self._menuGestureGateActive === active) return
      self._menuGestureGateActive = active
      this.triggerEvent('gesturegatechange', { active })
    },

    rebuildVisibleRows() {
      const expandedSet = new Set(this.data.expandedTags)
      const propsNodes =
        (this as unknown as { properties?: { nodes?: TagTreeMeta[] } }).properties?.nodes
      const dataNodes =
        (this.data as unknown as { nodes?: TagTreeMeta[] } | undefined)?.nodes
      const rawNodes = (propsNodes ?? dataNodes ?? []) as TagTreeMeta[]
      const orderedNodes = reorderTagTreeSiblingsNoneLast(rawNodes)
      const rows = buildVisibleTagTreeRows(orderedNodes, expandedSet, this.data.selectedTag)
      if ((this.data as any).untaggedCount > 0) {
        rows.push({
          tag: TAG_NONE_LITERAL,
          label: TAG_NONE_LITERAL,
          depth: 0,
          hasChildren: false,
          expanded: false,
          selected: this.data.selectedTag === TAG_NONE_LITERAL,
          itemCount: 0,
        })
      }
      const rowViews = attachGuideSlots(rows)
      this.commitVisibleRows(rowViews)
    },

    commitVisibleRows(nextRows: TagTreeRowWithGuides[]) {
      const self = this as any
      const pendingRemovals: Map<string, number> =
        self._pendingRemovals || (self._pendingRemovals = new Map())

      const oldRows = this.data.visibleRows as TagTreeRowWithGuides[]
      const { stagedRows: finalRows, enteringTags, removingTags } =
        computeStagedRows(nextRows, oldRows, pendingRemovals)

      this.setData({ visibleRows: finalRows })

      if (enteringTags.size > 0 || removingTags.size > 0) {
        wx.nextTick(() => {
          const current = this.data.visibleRows as TagTreeRowWithGuides[]
          const updated = current.map((r) => {
            if (enteringTags.has(r.tag)) return { ...r, enter: false }
            if (removingTags.has(r.tag)) return { ...r, enter: true }
            return r
          })
          this.setData({ visibleRows: updated })
        })
      }

      removingTags.forEach((tag) => {
        const timer = setTimeout(() => {
          pendingRemovals.delete(tag)
          const current = this.data.visibleRows as TagTreeRowWithGuides[]
          const filtered = current.filter((r) => r.tag !== tag)
          if (filtered.length !== current.length) {
            this.setData({ visibleRows: filtered })
          }
        }, ANIM_DURATION + 20) as unknown as number
        pendingRemovals.set(tag, timer)
      })
    },

    handleToggle(event: WechatMiniprogram.BaseEvent) {
      const tag = String(event.currentTarget.dataset.tag || '')
      if (!tag) return
      const row = (this.data.visibleRows as TagTreeRowWithGuides[]).find((r) => r.tag === tag)
      if (!row) return

      const expandedTags = [...this.data.expandedTags]
      const index = expandedTags.indexOf(tag)
      if (index >= 0) {
        expandedTags.splice(index, 1)
      } else {
        expandedTags.push(tag)
      }
      this.setData({ expandedTags })
      this.rebuildVisibleRows()
    },

    handleTagSelect(event: WechatMiniprogram.BaseEvent) {
      const tag = String(event.currentTarget.dataset.tag || '')
      if (!tag) return

      const row = (this.data.visibleRows as TagTreeRowWithGuides[]).find((r) => r.tag === tag)
      if (!row) return
      if (row?.hasChildren && !row.expanded) {
        const expandedTags = [...this.data.expandedTags]
        if (!expandedTags.includes(tag)) {
          expandedTags.push(tag)
        }
        this.setData({ expandedTags })
      }

      this.triggerEvent('select', { tag })
    },

    handleShowAll() {
      this.triggerEvent('showall')
    },

    handleToggleAllNotes() {
      this.setData({ allNotesExpanded: !this.data.allNotesExpanded })
    },

    handleSelectFacet(e: WechatMiniprogram.BaseEvent) {
      const facet = e.currentTarget.dataset.facet as string
      this.triggerEvent('selectfacet', { facet })
    },

    handleTodayReview() {
      this.triggerEvent('todayreview', { date: formatTodayKey() })
    },

    handleRetry() {
      this.triggerEvent('retry')
    },

    handleRowTouchStart(e: WechatMiniprogram.TouchEvent) {
      if (e.mark?.tagTreeControl === 'menu') {
        this._cancelLift()
        return
      }
      const touch = e.touches[0]
      if (!touch) return
      ;(this as any)._menuGestureGateLocked = false
      ;(this as any)._liftSession = createTouchLiftSession(touch)
      const index = Number((e.currentTarget as any)?.dataset?.index)
      if (!Number.isFinite(index) || index < 0) return
      ;(this as any)._liftTimer = setTimeout(() => {
        ;(this as any)._liftTimer = null
        this.setData({ pressingIndex: index })
      }, TOUCH_LIFT_DELAY_MS)
      if (this._resolveMenuGateCandidate(e)) {
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

    handleRowTouchMove(e: WechatMiniprogram.TouchEvent) {
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

    handleRowTouchEnd() {
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
      if (this.data.pressingIndex >= 0 && this.data.liftedIndex < 0) {
        this.setData({ pressingIndex: -1 })
      }
      if (!(this as any)._menuGestureGateLocked) {
        this._setMenuGestureGateActive(false)
      }
    },

    handleMenuButtonTouchStart() {
      this._cancelLift()
    },

    handleMenuButtonTap(event: WechatMiniprogram.BaseEvent) {
      this._openTagMenu(event, { liftRow: false })
    },

    handleRowMenuLongPress(event: WechatMiniprogram.BaseEvent) {
      this._openTagMenu(event, { liftRow: true })
    },

    _openTagMenu(event: WechatMiniprogram.BaseEvent, options: OpenTagMenuOptions) {
      const candidate = this._resolveMenuGateCandidate(event)
      if (!candidate) return
      const { tag, index } = candidate
      const row = (this.data.visibleRows as TagTreeRowWithGuides[]).find((r) => r.tag === tag)
      if (!row) return
      if (options.liftRow) {
        ;(this as any)._menuGestureGateLocked = true
      }

      const query = this.createSelectorQuery().in(this)
      this.triggerEvent('menuchange', { active: true })
      query.select(`#tag-tree-menu-${index}`).boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        if (!rect) {
          ;(this as any)._menuGestureGateLocked = false
          this._setMenuGestureGateActive(false)
          this.triggerEvent('menuchange', { active: false })
          return
        }
        hapticTap('light')
        const menuHeaderLabel = row?.label ? String(row.label).trim() : ''
        const offsetRect = { ...rect, top: rect.top - 8, bottom: rect.bottom + 8 }
        this.setData({
          pressingIndex: -1,
          liftedIndex: options.liftRow ? index : -1,
          menuTag: tag,
          menuHeaderLabel,
          menuAnchorRect: offsetRect,
          menuActive: true,
        })
      })
    },

    closeMenu() {
      ;(this as any)._menuGestureGateLocked = false
      this._setMenuGestureGateActive(false)
      if (!this.data.menuActive) return
      this.setData({
        menuActive: false,
        liftedIndex: -1,
        menuTag: '',
        menuHeaderLabel: '',
        menuAnchorRect: null,
      })
      this.triggerEvent('menuchange', { active: false })
    },

    handleMenuClose() {
      this.closeMenu()
    },

    handleMenuSelect(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
      const id = String(event.detail?.id || '')
      const tag = this.data.menuTag
      this.closeMenu()
      if (id === 'edit' && tag) {
        this.triggerEvent('edittag', { tag })
      }
      if (id === 'delete' && tag) {
        this.triggerEvent('deletetag', { tag })
      }
    },
  },
})
