import type { HTMLAttributes, LabelHTMLAttributes } from 'react'

import './form-controls.css'

export type FieldProps = HTMLAttributes<HTMLDivElement>
export type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>
export type FieldDescriptionProps = HTMLAttributes<HTMLParagraphElement>
export type FieldErrorProps = HTMLAttributes<HTMLParagraphElement>

export function Field({ className, ...props }: FieldProps) {
  return (
    <div
      className={['coss-field', className].filter(Boolean).join(' ')}
      data-slot="field"
      {...props}
    />
  )
}

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <label
      className={['coss-field__label', className].filter(Boolean).join(' ')}
      data-slot="field-label"
      {...props}
    />
  )
}

export function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <p
      className={['coss-field__description', className].filter(Boolean).join(' ')}
      data-slot="field-description"
      {...props}
    />
  )
}

export function FieldError({ className, ...props }: FieldErrorProps) {
  return (
    <p
      className={['coss-field__error', className].filter(Boolean).join(' ')}
      data-slot="field-error"
      role="alert"
      {...props}
    />
  )
}
