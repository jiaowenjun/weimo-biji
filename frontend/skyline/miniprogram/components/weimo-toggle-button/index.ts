import { hapticTap } from '../../utils/haptic'

Component({
  properties: {
    icon: {
      type: String,
      value: '',
    },
    label: {
      type: String,
      value: '',
    },
    selected: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    ariaLabel: {
      type: String,
      value: '',
    },
    customStyle: {
      type: String,
      value: '',
    },
  },
  data: {
    rootClass: 'weimo-toggle-button',
  },
  lifetimes: {
    attached() {
      this.syncPresentation()
    },
    ready() {
      // Skyline / 部分基础库首帧后属性才与视图对齐，再同步一次避免误显 disabled
      this.syncPresentation()
    },
  },
  observers: {
    'selected, disabled'() {
      this.syncPresentation()
    },
  },
  methods: {
    syncPresentation() {
      const classes = ['weimo-toggle-button']
      const selected = !!this.properties.selected
      const disabled = !!this.properties.disabled

      if (selected) classes.push('weimo-toggle-button--selected')
      if (disabled) classes.push('weimo-toggle-button--disabled')

      this.setData({
        rootClass: classes.join(' '),
      })
    },

    getEventDetail() {
      return {
        icon: String(this.data.icon || ''),
        label: String(this.data.label || ''),
        selected: !!this.data.selected,
      }
    },

    onTap() {
      if (this.properties.disabled) return
      hapticTap('light')
      this.triggerEvent('tap', this.getEventDetail())
    },
  },
})
