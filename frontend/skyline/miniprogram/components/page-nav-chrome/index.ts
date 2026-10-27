Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    extClass: {
      type: String,
      value: '',
    },
    title: {
      type: String,
      value: '',
    },
    titleLeadingIcon: {
      type: String,
      value: '',
    },
    titleMenuItems: {
      type: Array,
      value: [],
    },
    back: {
      type: Boolean,
      value: true,
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    menu: {
      type: Boolean,
      value: false,
    },
    transparent: {
      type: Boolean,
      value: false,
    },
    statusMaskHeight: {
      type: Number,
      value: 0,
    },
  },
  methods: {
    handleBack(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('back', event.detail, {})
    },
    handleHome(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('home', event.detail, {})
    },
    handleMenu(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('menu', event.detail, {})
    },
    handleTitleMenuSelect(
      event: WechatMiniprogram.CustomEvent<{ id: string; item?: unknown }>,
    ) {
      this.triggerEvent('titlemenuselect', event.detail, {})
    },
  },
})
