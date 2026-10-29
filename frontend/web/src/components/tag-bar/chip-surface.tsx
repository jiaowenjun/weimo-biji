import type { ComponentPropsWithoutRef } from 'react'

import {
  getChipSurfaceAttributes,
  getChipSurfaceClassName,
  type ChipSurfaceOptions,
} from './chip-surface-model'

import './chip-surface.css'

export type {
  ChipSurfaceOptions,
  ChipSurfaceTextSize,
  ChipSurfaceVariant,
} from './chip-surface-model'

export type ChipSurfaceProps = Omit<ComponentPropsWithoutRef<'span'>, 'prefix'> &
  ChipSurfaceOptions

export function ChipSurface({
  className,
  variant = 'default',
  textSize = 'sm',
  interactive = false,
  ...props
}: ChipSurfaceProps) {
  return (
    <span
      className={getChipSurfaceClassName(className)}
      {...getChipSurfaceAttributes({ variant, textSize, interactive })}
      {...props}
    />
  )
}
