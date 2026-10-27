import { normalizeEnumValue } from '../utils/normalize-enum'
import { hapticTap } from '../../utils/haptic'

type ChipVariant = 'soft' | 'outline' | 'glass'
type ChipTone = 'brand' | 'neutral'
type ChipSize = 'xs' | 'sm' | 'md'

const CHIP_VALID_VARIANTS: ChipVariant[] = ['soft', 'outline', 'glass']
const CHIP_VALID_TONES: ChipTone[] = ['brand', 'neutral']
const CHIP_VALID_SIZES: ChipSize[] = ['xs', 'sm', 'md']

Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    prefix: {
      type: String,
      value: '',
    },
    icon: {
      type: String,
      value: '',
    },
    actionValue: {
      type: String,
      value: '',
    },
    variant: {
      type: String,
      value: 'soft',
    },
    tone: {
      type: String,
      value: 'brand',
    },
    size: {
      type: String,
      value: 'xs',
    },
    closable: {
      type: Boolean,
      value: false,
    },
    selected: {
      type: Boolean,
      value: false,
    },
    captureTap: {
      type: Boolean,
      value: true,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    haptic: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    rootClass: 'weimo-chip weimo-chip--variant-soft weimo-chip--tone-brand weimo-chip--size-xs',
    hoverClass: 'none',
  },
  lifetimes: {
    attached() {
      this.syncPresentation()
    },
  },
  observers: {
    'variant, tone, size, closable, selected, disabled'() {
      this.syncPresentation()
    },
  },
  methods: {
    syncPresentation() {
      const resolvedVariant = normalizeEnumValue<ChipVariant>(
        String(this.data.variant || 'soft'),
        CHIP_VALID_VARIANTS,
        'soft',
      )
      const resolvedTone = normalizeEnumValue<ChipTone>(
        String(this.data.tone || 'brand'),
        CHIP_VALID_TONES,
        'brand',
      )
      const resolvedSize = normalizeEnumValue<ChipSize>(
        String(this.data.size || 'xs'),
        CHIP_VALID_SIZES,
        'xs',
      )

      const classes = [
        'weimo-chip',
        `weimo-chip--variant-${resolvedVariant}`,
        `weimo-chip--tone-${resolvedTone}`,
        `weimo-chip--size-${resolvedSize}`,
      ]

      if (resolvedVariant === 'glass') classes.push('ds-surface-floating', 'ds-surface-frosted')
      if (this.data.closable) classes.push('weimo-chip--closable')
      if (this.data.selected) classes.push('weimo-chip--selected')
      if (this.data.disabled) classes.push('weimo-chip--disabled')

      this.setData({
        rootClass: classes.join(' '),
      })
    },

    getEventDetail() {
      return {
        value: String(this.data.value || ''),
        actionValue: String(this.data.actionValue || this.data.value || ''),
        prefix: String(this.data.prefix || ''),
        icon: String(this.data.icon || ''),
        selected: !!this.data.selected,
      }
    },

    onTap() {
      if (this.data.disabled) return
      if (this.data.haptic) hapticTap('light')
      this.triggerEvent('tap', this.getEventDetail())
    },

    onClose() {
      if (this.data.disabled) return
      if (this.data.haptic) hapticTap('light')
      const detail = this.getEventDetail()
      this.triggerEvent('close', detail)
      this.triggerEvent('clear', detail)
    },
  },
})
