import type { InputHTMLAttributes } from 'react'

import './form-controls.css'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      className={['coss-input', className].filter(Boolean).join(' ')}
      data-slot="input"
      type={type}
      {...props}
    />
  )
}
