import type { FormHTMLAttributes } from 'react'

import './form-controls.css'

export type FormProps = FormHTMLAttributes<HTMLFormElement>

export function Form({ className, ...props }: FormProps) {
  return (
    <form
      className={['coss-form', className].filter(Boolean).join(' ')}
      data-slot="form"
      {...props}
    />
  )
}
