import { normalizeEnumValue } from '../utils/normalize-enum'

type ButtonVariant = 'solid' | 'outline' | 'soft' | 'text' | 'card'
type ButtonTone = 'brand' | 'neutral' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type ButtonShape = 'pill' | 'rounded' | 'square'

const VALID_VARIANTS: ButtonVariant[] = ['solid', 'outline', 'soft', 'text', 'card']
const VALID_TONES: ButtonTone[] = ['brand', 'neutral', 'danger']
const VALID_SIZES: ButtonSize[] = ['xs', 'sm', 'md', 'lg']
const VALID_SHAPES: ButtonShape[] = ['pill', 'rounded', 'square']

Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    variant: {
      type: String,
      value: 'solid',
    },
    tone: {
      type: String,
      value: 'brand',
    },
    size: {
      type: String,
      value: 'lg',
    },
    shape: {
      type: String,
      value: 'rounded',
    },
    block: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    openType: {
      type: String,
      value: '',
    },
  },
  data: {
    rootClass: 'weimo-btn weimo-btn--variant-solid weimo-btn--tone-brand weimo-btn--size-lg weimo-btn--shape-rounded',
    hoverClass: 'none',
    spinnerClass: 'weimo-btn__spinner weimo-btn__spinner--light',
  },
  lifetimes: {
    attached() {
      this.syncPresentation()
    },
  },
  observers: {
    'variant, tone, size, shape, block, loading, disabled'() {
      this.syncPresentation()
    },
  },
  methods: {
    syncPresentation() {
      const rawVariant = String(this.data.variant ?? 'solid').trim()
      const rawTone = String(this.data.tone ?? 'brand').trim()

      const resolvedVariant = normalizeEnumValue<ButtonVariant>(
        rawVariant || 'solid',
        VALID_VARIANTS,
        'solid',
      )
      const resolvedTone = normalizeEnumValue<ButtonTone>(
        rawTone || 'brand',
        VALID_TONES,
        'brand',
      )
      const resolvedSize = normalizeEnumValue<ButtonSize>(
        String(this.data.size || 'lg'),
        VALID_SIZES,
        'lg',
      )
      const resolvedShape = normalizeEnumValue<ButtonShape>(
        String(this.data.shape || 'rounded'),
        VALID_SHAPES,
        'rounded',
      )

      const classes = [
        'weimo-btn',
        `weimo-btn--variant-${resolvedVariant}`,
        `weimo-btn--tone-${resolvedTone}`,
        `weimo-btn--size-${resolvedSize}`,
        `weimo-btn--shape-${resolvedShape}`,
      ]
      if (this.data.block) classes.push('weimo-btn--block')
      if (this.data.disabled || this.data.loading) classes.push('weimo-btn--disabled')

      const spinnerClass =
        resolvedVariant === 'solid' && resolvedTone !== 'neutral'
          ? 'weimo-btn__spinner weimo-btn__spinner--light'
          : 'weimo-btn__spinner weimo-btn__spinner--dark'

      const hoverClass =
        this.data.disabled || this.data.loading || resolvedVariant === 'card'
          ? 'none'
          : 'weimo-btn--hover'

      this.setData({
        rootClass: classes.join(' '),
        hoverClass,
        spinnerClass,
      })
    },
    onTap(e: WechatMiniprogram.CustomEvent) {
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('tap', e.detail)
    },
    onGetUserInfo(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('getuserinfo', e.detail)
    },
    onGetPhoneNumber(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('getphonenumber', e.detail)
    },
  },
})
