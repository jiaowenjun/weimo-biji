import { normalizeEnumValue } from '../utils/normalize-enum'

type IconButtonVariant = 'plain' | 'ghost' | 'solid' | 'glass'
type IconButtonTone = 'brand' | 'neutral'
type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type IconButtonFeedbackStyle = 'default' | 'brand-soft' | 'nav-glass'

const ICON_BUTTON_VALID_VARIANTS: IconButtonVariant[] = ['plain', 'ghost', 'solid', 'glass']
const ICON_BUTTON_VALID_TONES: IconButtonTone[] = ['brand', 'neutral']
const ICON_BUTTON_VALID_SIZES: IconButtonSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
const ICON_BUTTON_VALID_FEEDBACK_STYLES: IconButtonFeedbackStyle[] = ['default', 'brand-soft', 'nav-glass']

Component({
  properties: {
    icon: {
      type: String,
      value: '',
    },
    variant: {
      type: String,
      value: 'plain',
    },
    tone: {
      type: String,
      value: 'neutral',
    },
    size: {
      type: String,
      value: 'sm',
    },
    iconSize: {
      type: String,
      value: '',
    },
    iconColor: {
      type: String,
      value: '',
    },
    customStyle: {
      type: String,
      value: '',
    },
    captureTap: {
      type: Boolean,
      value: true,
    },
    feedbackStyle: {
      type: String,
      value: 'default',
    },
    hoverable: {
      type: Boolean,
      value: true,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    pressed: {
      type: Boolean,
      value: false,
    },
    ariaLabel: {
      type: String,
      value: '',
    },
  },
  data: {
    rootClass:
      'weimo-icon-button weimo-icon-button--variant-plain weimo-icon-button--tone-neutral weimo-icon-button--size-sm weimo-icon-button--feedback-default',
    hoverClass: 'weimo-icon-button--hover',
    iconStyle: '',
  },
  lifetimes: {
    attached() {
      this.syncPresentation()
    },
  },
  observers: {
    'variant, tone, size, iconSize, iconColor, feedbackStyle, hoverable, disabled, loading, pressed'() {
      this.syncPresentation()
    },
  },
  methods: {
    syncPresentation() {
      const resolvedVariant = normalizeEnumValue<IconButtonVariant>(
        String(this.data.variant || 'plain'),
        ICON_BUTTON_VALID_VARIANTS,
        'plain',
      )
      const resolvedTone = normalizeEnumValue<IconButtonTone>(
        String(this.data.tone || 'neutral'),
        ICON_BUTTON_VALID_TONES,
        'neutral',
      )
      const resolvedSize = normalizeEnumValue<IconButtonSize>(
        String(this.data.size || 'sm'),
        ICON_BUTTON_VALID_SIZES,
        'sm',
      )
      const resolvedFeedbackStyle = normalizeEnumValue<IconButtonFeedbackStyle>(
        String(this.data.feedbackStyle || 'default'),
        ICON_BUTTON_VALID_FEEDBACK_STYLES,
        'default',
      )

      const classes = [
        'weimo-icon-button',
        `weimo-icon-button--variant-${resolvedVariant}`,
        `weimo-icon-button--tone-${resolvedTone}`,
        `weimo-icon-button--size-${resolvedSize}`,
        `weimo-icon-button--feedback-${resolvedFeedbackStyle}`,
      ]

      if (resolvedVariant === 'glass') classes.push('ds-surface-floating', 'ds-surface-frosted')
      if (this.data.disabled) classes.push('weimo-icon-button--disabled')
      if (this.data.loading) classes.push('weimo-icon-button--loading')
      if (this.data.pressed) classes.push('weimo-icon-button--pressed')

      const rawIconSize = String(this.data.iconSize || '').trim()
      const rawIconColor = String(this.data.iconColor || '').trim()
      const iconStyleParts: string[] = []

      if (rawIconSize) iconStyleParts.push(`font-size: ${rawIconSize};`)
      if (rawIconColor) iconStyleParts.push(`color: ${rawIconColor};`)

      this.setData({
        rootClass: classes.join(' '),
        hoverClass:
          this.data.disabled || this.data.loading || !this.data.hoverable
            ? 'none'
            : 'weimo-icon-button--hover',
        iconStyle: iconStyleParts.join(' '),
      })
    },

    getEventDetail() {
      return {
        icon: String(this.data.icon || ''),
      }
    },

    onTap() {
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('tap', this.getEventDetail())
    },
  },
})
