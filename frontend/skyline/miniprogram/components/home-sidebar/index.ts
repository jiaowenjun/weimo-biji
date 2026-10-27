import type { WorkspaceStats } from '../../models/workspace'
import { formatWordCountMetric } from '../../utils/format-word-count-metric'
import { hapticTap } from '../../utils/haptic'
import { buildHeatmapCells, buildHeatmapColumns, buildHeatmapMonthLabels } from '../../utils/heatmap'
import { computeStandardNavigationBarLayout } from '../../utils/navigation-bar-layout'

const { shared, spring, runOnUI, runOnJS } = wx.worklet

interface SidebarInstance {
  _progress?: SkylineSharedValue<number>
  _dragging?: SkylineSharedValue<boolean>
  _panelWidthPx: number
  // JS 侧自维护的目标态去重值；与 SharedValue 跨线程镜像解耦，避免镜像 stale
  // 导致 _animateToVisible 早退的 bug。
  // 0 = 已关闭/正在关闭目标，1 = 已打开/正在打开目标。
  _lastTarget: 0 | 1
  _fireOpenHaptic: () => void
  _fireVisibleChange: (open: boolean) => void
  _syncLastTarget: (open: boolean) => void
  applyAnimatedStyle: (
    selector: string,
    updater: () => Record<string, string | number>,
  ) => void
}

export interface SidebarAnimationContext {
  progress: SkylineSharedValue<number>
  dragging: SkylineSharedValue<boolean>
  panelWidthPx: number
  fireOpenHaptic: () => void
  fireVisibleChange: (open: boolean) => void
  syncLastTarget: (open: boolean) => void
}

interface HeatmapCellWithToday {
  date: string
  level: number
  isToday: boolean
}

interface HeatmapColumnWithMonth {
  index: number
  cells: HeatmapCellWithToday[]
  monthLabel: string
}

const SIDEBAR_WIDTH_RPX = 580
const HEATMAP_CELL_SIZE_RPX = 30
const HEATMAP_GAP_RPX = 8
// 13 列热力图：13 * 30rpx + 12 * 8rpx = 486rpx，面板 580rpx 下两侧各剩 47rpx。
const HEATMAP_VISIBLE_EDGE_INSET_RPX = 47
const SIDEBAR_HEADER_LEFT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX
const SIDEBAR_HEADER_RIGHT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 14
const TAG_TREE_LEFT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 32
const TAG_TREE_RIGHT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 30
const SPRING_CONFIG = { mass: 1, damping: 22, stiffness: 220 }

function formatTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    authenticated: { type: Boolean, value: false },
    authActionText: { type: String, value: '' },
    userNickname: { type: String, value: '' },
    stats: { type: Object, value: undefined },
    statsLoading: { type: Boolean, value: false },
    activeDate: { type: String, value: '' },
    tagTreeNodes: { type: Array, value: [] },
    tagTreeUntaggedCount: { type: Number, value: 0 },
    tagTreeLoading: { type: Boolean, value: false },
    tagTreeInitialized: { type: Boolean, value: false },
    tagTreeLoadFailed: { type: Boolean, value: false },
    selectedTag: { type: String, value: '' },
    tagMenuEnabled: { type: Boolean, value: true },
    listFacet: { type: String, value: 'none' },
  },

  data: {
    activeDays: 0,
    wordCountValue: '0',
    wordCountUnit: '字',
    heatmapColumns: [] as HeatmapColumnWithMonth[],
    heatmapContentWidth: 0,
    heatmapCellSizeRpx: HEATMAP_CELL_SIZE_RPX,
    heatmapGapRpx: HEATMAP_GAP_RPX,
    tagTreeStyle: '',
    headerStyle: '',
    tagMenuActive: false,
    tagMenuGestureGateActive: false,
  },

  lifetimes: {
    attached() {
      const windowInfo = wx.getWindowInfo()
      const rect = wx.getMenuButtonBoundingClientRect()
      const layout = computeStandardNavigationBarLayout(windowInfo, {
        top: rect.top,
        left: rect.left,
        height: rect.height,
      })
      this.setData({
        headerStyle:
          `padding-top: ${layout.safeTop}px; ` +
          `padding-left: ${SIDEBAR_HEADER_LEFT_INSET_RPX}rpx; ` +
          `padding-right: ${SIDEBAR_HEADER_RIGHT_INSET_RPX}rpx; ` +
          `height: ${layout.innerHeight}px`,
        tagTreeStyle:
          `--tag-tree-edge-left-rpx: ${TAG_TREE_LEFT_INSET_RPX}rpx; ` +
          `--tag-tree-edge-right-rpx: ${TAG_TREE_RIGHT_INSET_RPX}rpx;`,
      })

      this._setupSidebarAnimation()
    },
  },

  observers: {
    visible(next: boolean) {
      this._animateToVisible(next)
    },

    stats(stats: WorkspaceStats | null) {
      if (!stats) {
        this.setData({
          activeDays: 0,
          wordCountValue: '0',
          wordCountUnit: '字',
          heatmapColumns: [],
          heatmapContentWidth: 0,
        })
        return
      }

      const wordCountMetric = formatWordCountMetric(stats.word_count)
      const cells = buildHeatmapCells(stats.daily_note_count)
      const columns = buildHeatmapColumns(cells)
      const months = buildHeatmapMonthLabels(cells)
      const monthMap = new Map(months.map((m) => [m.columnIndex, m.name]))
      const todayKey = formatTodayKey()

      // 热力图实际渲染宽度（rpx）：列数 × 单元尺寸 + (列数-1) × 统一间距
      // 与 heatmap__column 的固定 width / margin-right 保持一致
      const heatmapContentWidth =
        columns.length > 0
          ? columns.length * HEATMAP_CELL_SIZE_RPX + (columns.length - 1) * HEATMAP_GAP_RPX
          : 0

      this.setData({
        activeDays: stats.daily_note_count.length,
        wordCountValue: wordCountMetric.value,
        wordCountUnit: wordCountMetric.unit,
        heatmapColumns: columns.map((col) => ({
          index: col.index,
          cells: col.cells.map((cell) => ({
            date: cell.date,
            level: cell.level,
            isToday: cell.date === todayKey,
          })),
          monthLabel: monthMap.get(col.index) || '',
        })),
        heatmapContentWidth,
      })
    },
  },

  methods: {
    _setupSidebarAnimation() {
      const winInfo = wx.getWindowInfo()
      // 580rpx → px：windowWidth(px) / 750(rpx) * 580(rpx)
      const panelWidthPx = (winInfo.windowWidth / 750) * SIDEBAR_WIDTH_RPX

      const initial = this.properties.visible ? 1 : 0
      const progress = shared(initial)
      const dragging = shared(false)

      const self = this as unknown as SidebarInstance
      self._progress = progress
      self._dragging = dragging
      self._panelWidthPx = panelWidthPx
      self._lastTarget = initial as 0 | 1

      self.applyAnimatedStyle('.sidebar-panel', () => {
        'worklet'
        return {
          transform: `translateX(${(progress.value - 1) * panelWidthPx}px)`,
        }
      })

      self.applyAnimatedStyle('.sidebar-overlay', () => {
        'worklet'
        return {
          opacity: progress.value,
        }
      })
    },

    _animateToVisible(next: boolean) {
      const self = this as unknown as SidebarInstance
      if (!self._progress) return
      // 手势进行中由页面侧的手势处理器自行收尾，避免与 observer 抢占动画
      if (self._dragging?.value) return
      const target: 0 | 1 = next ? 1 : 0
      // 不再读 self._progress.value 做早退（JS 侧 SharedValue 镜像在 menu-button
      // 路径下可能 stale），改用 JS 侧自管的 _lastTarget 去重。
      if (self._lastTarget === target) return
      self._lastTarget = target

      const progress = self._progress
      const haptic = (self._fireOpenHaptic as () => void).bind(self)

      runOnUI(() => {
        'worklet'
        progress.value = spring(target, SPRING_CONFIG, (finished) => {
          'worklet'
          if (finished && target === 1) {
            runOnJS(haptic)()
          }
        })
      })()
    },

    /**
     * 暴露给父页面的动画上下文，供页面级手势处理器在 worklet 中
     * 直接读写 progress / dragging，从而实现"手指拖到哪、面板到哪"的连续交互。
     */
    getAnimationContext(): SidebarAnimationContext | null {
      const self = this as unknown as SidebarInstance
      if (!self._progress || !self._dragging) return null
      return {
        progress: self._progress,
        dragging: self._dragging,
        panelWidthPx: self._panelWidthPx,
        fireOpenHaptic: (self._fireOpenHaptic as () => void).bind(self),
        fireVisibleChange: (self._fireVisibleChange as (open: boolean) => void).bind(self),
        syncLastTarget: (self._syncLastTarget as (open: boolean) => void).bind(self),
      }
    },

    /**
     * 由页面侧手势 END 完成回调（worklet → runOnJS）调用，把手势的最终目标态
     * 同步到 JS 侧 _lastTarget，避免后续 `visible` observer 误判为目标态变化
     * 而再跑一次 spring（会带来重复震动）。
     */
    _syncLastTarget(open: boolean) {
      const self = this as unknown as SidebarInstance
      self._lastTarget = open ? 1 : 0
    },

    _fireOpenHaptic() {
      hapticTap('light')
    },

    _fireVisibleChange(open: boolean) {
      this.triggerEvent('visiblechange', { visible: open })
    },

    handleOverlayTap() {
      this.triggerEvent('close')
    },

    handleAuthTap() {
      this.triggerEvent('auth')
    },

    handleHeatmapCellTap(event: WechatMiniprogram.BaseEvent) {
      const date = String(event.currentTarget.dataset.date || '')
      if (!date) return
      hapticTap('light')
      this.triggerEvent('heatmapselect', { date })
    },

    handleTagTreeSelect(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
      this.triggerEvent('tagselect', event.detail)
      this.triggerEvent('close')
    },

    handleTagTreeShowAll() {
      this.triggerEvent('showall')
      this.triggerEvent('close')
    },

    handleTagTreeSelectFacet(event: WechatMiniprogram.CustomEvent<{ facet: string }>) {
      this.triggerEvent('selectfacet', event.detail)
      this.triggerEvent('close')
    },

    handleTagTreeTodayReview(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
      this.triggerEvent('todayreview', event.detail)
      this.triggerEvent('close')
    },

    handleTagTreeRetry() {
      this.triggerEvent('tagretry')
    },

    handleTagTreeMenuChange(event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) {
      this.setData({ tagMenuActive: !!event.detail?.active })
    },

    handleTagTreeGestureGateChange(event: WechatMiniprogram.CustomEvent<{ active?: boolean }>) {
      this.setData({ tagMenuGestureGateActive: !!event.detail?.active })
    },

    handleTagTreeEditTag(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
      this.triggerEvent('close')
      this.triggerEvent('edittag', event.detail)
    },

    handleTagTreeDeleteTag(event: WechatMiniprogram.CustomEvent<{ tag: string }>) {
      this.triggerEvent('close')
      this.triggerEvent('deletetag', event.detail)
    },

    handleSettingsTap() {
      this.triggerEvent('settings')
    },

  },
})
