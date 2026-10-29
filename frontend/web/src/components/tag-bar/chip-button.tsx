import type { ButtonHTMLAttributes } from 'react'

import { AnimatedInlineSizeMeasure } from 'weimo-ui-core/components/animated-inline-size'
import {
  getChipSurfaceAttributes,
  getChipSurfaceClassName,
} from './chip-surface-model'
import {
  getAnimatedInlineSizeStyle,
  useAnimatedInlineSize,
} from 'weimo-ui-core/components/animated-inline-size-model'

import './chip-surface.css'
import './chip-button.css'

export type ChipButtonState = 'default' | 'glass'

export type ChipButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'prefix'> & {
  animateWidth?: boolean
  prefix?: string
  state?: ChipButtonState
}

export function ChipButton({
  animateWidth = false,
  children,
  className,
  prefix = '#',
  state = 'default',
  style,
  ...props
}: ChipButtonProps) {
  const renderedPrefix = prefix.slice(0, 1)
  const { measureRef, inlineSize } = useAnimatedInlineSize([
    renderedPrefix,
    children,
    state,
  ])
  const chipSurfaceAttributes = getChipSurfaceAttributes({ variant: state, interactive: true })
  const buttonContent = (
    <>
      <span className="chip-surface__slot chip-button__prefix">{renderedPrefix}</span>
      <span className="chip-surface__content chip-button__text">{children}</span>
    </>
  )
  const button = (
    <button
      className={getChipSurfaceClassName('chip-button', 'chip-button--button', className)}
      data-state={state}
      style={animateWidth ? getAnimatedInlineSizeStyle(style, inlineSize) : style}
      type="button"
      {...chipSurfaceAttributes}
      {...props}
    >
      {buttonContent}
    </button>
  )

  if (!animateWidth) {
    return button
  }

  return (
    <>
      {button}
      <AnimatedInlineSizeMeasure measureRef={measureRef}>
        <button
          className={getChipSurfaceClassName('chip-button', 'chip-button--button')}
          data-state={state}
          type="button"
          {...chipSurfaceAttributes}
        >
          {buttonContent}
        </button>
      </AnimatedInlineSizeMeasure>
    </>
  )
}
