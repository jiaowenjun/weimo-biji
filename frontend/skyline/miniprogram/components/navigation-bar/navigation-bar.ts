import { hapticTap } from '../../utils/haptic'
import {
  computeCompactNavigationBarLayout,
  computeStandardNavigationBarLayout,
} from '../../utils/navigation-bar-layout'
import type { PopoverMenuItem } from '../weimo-popover-menu/index'

/** 模态路由内导航栏不按全屏宽度为胶囊预留对称空白，数值与 WXSS `--left` 视觉对齐（16px）。 */
const MODAL_NAV_HORIZONTAL_GUTTER_PX = 16

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    /** 标题前导图标：`search` / `hashtag`；空字符串不显示 */
    titleLeadingIcon: {
      type: String,
      value: '',
    },
    background: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: true
    },
    loading: {
      type: Boolean,
      value: false
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    menu: {
      type: Boolean,
      value: false,
    },
    titleMenuItems: {
      type: Array,
      value: [],
    },
    animated: {
      // 显示隐藏的时候opacity动画效果
      type: Boolean,
      value: true
    },
    show: {
      // 显示隐藏导航，隐藏的时候navigation-bar的高度占位还在
      type: Boolean,
      value: true,
      observer: '_showChange'
    },
    // back为true的时候，返回的页面深度
    delta: {
      type: Number,
      value: 1
    },
    // 在 cupertino-modal 等模态路由内使用时，无需为系统状态栏预留高度
    modal: {
      type: Boolean,
      value: false,
    },
    // 紧凑模式：更小的标题字号与更低的栏高，仅作用于显式启用的页面
    compact: {
      type: Boolean,
      value: false,
    },
  },
  /**
   * 组件的初始数据
   */
  data: {
    displayStyle: '',
    titleMenuActive: false,
    titleMenuAnchorRect: null as WechatMiniprogram.BoundingClientRectCallbackResult | null,
  },
  lifetimes: {
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect()
      const windowInfo = wx.getWindowInfo()
      const statusBarHeight = windowInfo.statusBarHeight ?? rect.top
      const MODAL_EXTRA_TOP_PX = 8
      const standardLayout = !this.data.compact && !this.data.modal
        ? computeStandardNavigationBarLayout(windowInfo, {
            top: rect.top,
            left: rect.left,
            height: rect.height,
          })
        : null

      let safeTop: number
      let innerHeight: number
      if (this.data.compact) {
        // 紧凑模式：与系统胶囊脱钩，固定较低栏高。
        const compactLayout = computeCompactNavigationBarLayout({ height: rect.height })
        safeTop = compactLayout.safeTop
        innerHeight = compactLayout.innerHeight
      } else if (this.data.modal) {
        // 模态页（cupertino-modal）：保留垂直节奏，仅在非 compact 时继承全屏留白逻辑
        safeTop = MODAL_EXTRA_TOP_PX
        const navContentHeight = (rect.top - statusBarHeight) * 2 + rect.height
        innerHeight = safeTop + navContentHeight
      } else {
        // 普通页面：在胶囊垂直区间基础上、上下各扩展 NORMAL_BREATHING_PX，
        // 既保证子元素中线（align-items: center 后）严格落在胶囊中线，
        // 又恢复一段不依赖 statusBarHeight 的底部呼吸空间。
        const layout = standardLayout!
        safeTop = layout.safeTop
        innerHeight = layout.innerHeight
      }

      const capsuleSymmetricInsetPx = windowInfo.windowWidth - rect.left
      const innerPaddingRight = this.data.modal
        ? `padding-right: ${MODAL_NAV_HORIZONTAL_GUTTER_PX}px`
        : standardLayout
          ? `padding-right: ${standardLayout.innerPaddingRight}px`
          : `padding-right: ${capsuleSymmetricInsetPx}px`

      /** 模态栏左区按内容收窄，不按全屏「与胶囊镜像」的占位宽度固定，以避免右侧留白过大且操作区不靠右。 */
      const leftWidth = this.data.modal
        ? ''
        : standardLayout
          ? `width: ${standardLayout.leftWidth}px`
          : `width: ${capsuleSymmetricInsetPx}px`

      this.setData({
        ios: wx.getDeviceInfo().platform !== 'android',
        innerPaddingRight,
        leftWidth,
        safeAreaTop: `height: ${innerHeight}px; padding-top: ${safeTop}px`,
      })
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _showChange(show: boolean) {
      const animated = this.data.animated
      let displayStyle = ''
      if (animated) {
        displayStyle = `opacity: ${
          show ? '1' : '0'
        };transition:opacity 0.5s;`
      } else {
        displayStyle = `display: ${show ? '' : 'none'}`
      }
      this.setData({
        displayStyle
      })
    },
    back() {
      const data = this.data
      if (data.delta) {
        wx.navigateBack({
          delta: data.delta
        })
      }
      this.triggerEvent('back', { delta: data.delta }, {})
    },
    home() {
      this.triggerEvent('home', {}, {})
    },
    onMenuTap() {
      this.triggerEvent('menu', {}, {})
    },
    closeTitleMenu() {
      if (!this.data.titleMenuActive && !this.data.titleMenuAnchorRect) return
      this.setData({
        titleMenuActive: false,
        titleMenuAnchorRect: null,
      })
    },
    handleTitleTap() {
      const items = this.data.titleMenuItems as PopoverMenuItem[]
      if (!Array.isArray(items) || items.length === 0) return

      if (this.data.titleMenuActive) {
        this.closeTitleMenu()
        return
      }

      const query = this.createSelectorQuery().in(this)
      query.select('#navigation-bar-title-trigger').boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        if (!rect) return
        hapticTap('light')
        this.setData({
          titleMenuActive: true,
          titleMenuAnchorRect: rect,
        })
      })
    },
    handleTitleMenuClose() {
      this.closeTitleMenu()
    },
    handleTitleMenuSelect(
      event: WechatMiniprogram.CustomEvent<{ id: string; item?: PopoverMenuItem }>,
    ) {
      const id = String(event.detail?.id || '')
      const item = event.detail?.item
      this.closeTitleMenu()
      if (!id) return
      this.triggerEvent('titlemenuselect', { id, item }, {})
    }
  },
})
