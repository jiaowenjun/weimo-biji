import type { ButtonHTMLAttributes, ReactNode } from 'react'

import './form-controls.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'ghost' | 'outline'
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size = 'default',
  type = 'button',
  variant = 'default',
  ...props
}: ButtonProps) {
  const content: ReactNode = loading ? '登录中...' : children

  return (
    <button
      className={[
        'coss-button',
        `coss-button--${variant}`,
        `coss-button--size-${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-loading={loading || undefined}
      data-slot="button"
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {content}
    </button>
  )
}
