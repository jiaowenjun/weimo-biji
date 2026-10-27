import {
  computePopoverPlacement,
  DEFAULT_POPOVER_PLACEMENT_PRIORITY,
  type FixedLayerRect,
  type TriggerRect,
} from './placement'

/**
 * 菜单项；`icon` 为全局 iconfont 名（如 `weimo-icon-button` 的 `icon`），
 * 须与 `miniprogram/styles/iconfont.wxss` 中已收录的 `iconfont--*` 类一致（例如 edit、tag、delete）。
 */
export interface PopoverMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  /** 分组标题行：无 `collapseGroupId` 时不响应点击；有折叠组时整行用于展开/收起 */
  sectionHeader?: boolean
  /** 左侧图标，与 `iconfont--${icon}` 对应；不传则仅显示文字。 */
  icon?: string
  /** 追加到图标节点上的样式类（如定向旋转），须定义在 `weimo-popover-menu` 的 wxss。 */
  iconExtraClass?: string
  /**
   * 是否在本项前绘制分割线。
   * - `true`：显示；
   * - `false`：不显示（用于同组连续多项）；
   * - 未设置：保留旧行为——非首项前默认显示。
   */
  dividerBefore?: boolean
  /** 主标题下的辅助说明（小号 placeholder 色）；不传不展示。 */
  description?: string
  /** 折叠组领衔行：整行可点切换展开/收起；右侧 chevron 仅作提示 */
  collapseGroupId?: string
  /** 折叠组子项：属于指定组，折叠时隐藏 */
  collapseMemberOf?: string
}

const DEFAULT_GAP_PX = 6
const DEFAULT_ESTIMATED_HEIGHT_PX = 124
/** 有顶部标题时计入定位的高度增量（约一行 xs + padding），避免贴边裁剪 */
const HEADER_EXTRA_HEIGHT_PX = 44
const DEFAULT_VIEWPORT_MARGIN_PX = 8
Component({
  properties: {
    visible: { type: Boolean, value: false },
    triggerRect: { type: Object, value: undefined },
    items: { type: Array, value: [] },
    /** 可选顶部提示文案（非菜单项）；空则不展示 */
    header: { type: String, value: '' },
    /**
     * 入场 `scale` 动画的水平锚点：`end`=右上/右下（沿用早期习惯）；`start`=左上/左下（适于标签从左对齐展开）。
     */
    scaleAnchor: { type: String, value: 'end' },
    gap: { type: Number, value: DEFAULT_GAP_PX },
    estimatedHeight: { type: Number, value: DEFAULT_ESTIMATED_HEIGHT_PX },
    estimatedWidth: { type: Number, value: 0 },
    viewportMargin: { type: Number, value: DEFAULT_VIEWPORT_MARGIN_PX },
    placementPriority: { type: String, value: DEFAULT_POPOVER_PLACEMENT_PRIORITY },
    horizontalAlign: { type: String, value: 'end' },
  },

  data: {
    menuStyle: '',
    menuPlacement: 'down' as 'down' | 'up',
    expandedGroups: [] as string[],
    renderItems: [] as (PopoverMenuItem & { _showDivider: boolean; _expanded: boolean; _collapsed: boolean })[],
    collapseGroupMembers: {} as Record<string, (PopoverMenuItem & { _collapsed: boolean })[]>,
    collapseGroupStyles: {} as Record<string, string>,
  },

  observers: {
    'visible, triggerRect, gap, estimatedHeight, estimatedWidth, viewportMargin, placementPriority, horizontalAlign, header'(
      visible: boolean,
      triggerRect: TriggerRect | null,
    ) {
      if (!visible) return
      if (!triggerRect || typeof triggerRect.top !== 'number') return
      this.recomputePlacement(triggerRect)
    },

    visible(visible: boolean) {
      if (!visible && this.data.expandedGroups.length > 0) {
        this.setData({ expandedGroups: [] })
      }
    },

    'items, expandedGroups'() {
      this.rebuildRenderItems()
    },
  },

  methods: {
    rebuildRenderItems() {
      const items = this.data.items as PopoverMenuItem[]
      const expanded = new Set(this.data.expandedGroups)
      const result: (PopoverMenuItem & { _showDivider: boolean; _expanded: boolean; _collapsed: boolean })[] = []
      const groupMembers: Record<string, (PopoverMenuItem & { _collapsed: boolean })[]> = {}

      for (const item of items) {
        if (item.collapseMemberOf) {
          const group = item.collapseMemberOf
          if (!groupMembers[group]) groupMembers[group] = []
          groupMembers[group].push({ ...item, _collapsed: !expanded.has(group) })
          continue
        }
        const idx = result.length
        const showDivider = item.dividerBefore === true ||
          (item.dividerBefore == null && idx > 0)
        result.push({
          ...item,
          _showDivider: showDivider,
          _expanded: item.collapseGroupId ? expanded.has(item.collapseGroupId) : false,
          _collapsed: false,
        })
      }
      this.setData({ renderItems: result, collapseGroupMembers: groupMembers, collapseGroupStyles: this.computeCollapseStyles(groupMembers, expanded) })
    },

    computeCollapseStyles(
      groupMembers: Record<string, (PopoverMenuItem & { _collapsed: boolean })[]>,
      expanded: Set<string>,
    ): Record<string, string> {
      /**
       * 与 index.wxss 菜单行一致：纵向 padding 40rpx + 一行 --font-size-base 文字约 45rpx。
       * 过小会导致 overflow hidden 裁掉末行下边距，看起来像「末项与下一条分割线过近」。
       */
      const ITEM_HEIGHT_RPX = 88
      const styles: Record<string, string> = {}
      for (const group of Object.keys(groupMembers)) {
        if (expanded.has(group)) {
          styles[group] = `height: ${groupMembers[group].length * ITEM_HEIGHT_RPX}rpx`
        } else {
          styles[group] = ''
        }
      }
      return styles
    },

    recomputePlacement(rect: TriggerRect) {
      const gap = this.data.gap || DEFAULT_GAP_PX
      const baseHeight = this.data.estimatedHeight || DEFAULT_ESTIMATED_HEIGHT_PX
      const headerStr = String(this.data.header || '').trim()
      const estimatedHeight =
        baseHeight + (headerStr ? HEADER_EXTRA_HEIGHT_PX : 0)
      const estimatedWidth = this.data.estimatedWidth || 0
      const margin = this.data.viewportMargin || DEFAULT_VIEWPORT_MARGIN_PX

      let windowWidth = 375
      let windowHeight = 667
      let safeAreaTop = 0
      let safeAreaBottom = windowHeight
      try {
        const win = wx.getWindowInfo()
        if (win) {
          if (win.windowWidth) windowWidth = win.windowWidth
          if (win.windowHeight) windowHeight = win.windowHeight
          safeAreaBottom = windowHeight
          if (win.safeArea) {
            if (typeof win.safeArea.top === 'number') {
              safeAreaTop = win.safeArea.top
            }
            if (typeof win.safeArea.bottom === 'number') {
              safeAreaBottom = win.safeArea.bottom
            } else {
              safeAreaBottom = windowHeight
            }
          }
        }
      } catch {
        // keep defaults
      }

      this.measureFixedLayerRect((fixedLayerRect) => {
        if (!this.data.visible) return

        const { placement, style } = computePopoverPlacement({
          rect,
          windowWidth,
          windowHeight,
          safeAreaTop,
          safeAreaBottom,
          gap,
          estimatedHeight,
          estimatedWidth,
          margin,
          placementPriority: this.data.placementPriority,
          horizontalAlign: this.data.horizontalAlign,
          fixedLayerRect,
        })

        this.setData({
          menuStyle: style,
          menuPlacement: placement,
        })
      })
    },

    measureFixedLayerRect(callback: (rect: FixedLayerRect | null) => void) {
      try {
        const query = this.createSelectorQuery().in(this)
        query.select('.weimo-popover-menu__overlay').boundingClientRect()
        query.exec((res) => {
          const rect = res && res[0]
          if (
            rect
            && typeof rect.top === 'number'
            && typeof rect.left === 'number'
            && typeof rect.width === 'number'
            && typeof rect.height === 'number'
            && rect.width > 0
            && rect.height > 0
          ) {
            callback({
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            })
            return
          }
          callback(null)
        })
      } catch {
        callback(null)
      }
    },

    handleOverlayTap() {
      this.triggerEvent('close', {})
    },

    handleTouchBlock() {},

    handleItemTap(event: WechatMiniprogram.BaseEvent) {
      const id = String(event.currentTarget.dataset.id || '')
      if (!id) return
      const item = (this.data.items as PopoverMenuItem[]).find((i) => i.id === id)
      if (!item) return
      if (item.disabled) return
      if (item.collapseGroupId) {
        this.toggleCollapseGroup(item.collapseGroupId)
        return
      }
      if (item.sectionHeader) return
      this.triggerEvent('select', { id, item })
    },

    toggleCollapseGroup(group: string) {
      if (!group) return
      const groups = this.data.expandedGroups.slice()
      const idx = groups.indexOf(group)
      if (idx >= 0) {
        groups.splice(idx, 1)
      } else {
        groups.push(group)
      }
      this.setData({ expandedGroups: groups })
      if (this.data.visible && this.data.triggerRect) {
        this.recomputePlacement(this.data.triggerRect as TriggerRect)
      }
    },
  },
})
