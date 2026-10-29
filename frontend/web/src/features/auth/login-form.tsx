import { useId, useState, type FormEvent } from 'react'

import { TextButton } from 'weimo-ui-core/components/text-button'
import {
  Field,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { useAuth } from './use-auth'

type LoginFormProps = {
  onSuccess: () => void
}

type FieldErrors = {
  loginName?: string
  password?: string
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const loginNameId = useId()
  const passwordId = useId()
  const loginNameErrorId = useId()
  const passwordErrorId = useId()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    const normalizedLoginName = loginName.trim()

    if (!normalizedLoginName) {
      nextErrors.loginName = '请填写登录名'
    }

    if (!password) {
      nextErrors.password = '请填写密码'
    }

    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      await login({
        login_name: normalizedLoginName,
        password,
      })
      onSuccess()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form className="auth-form" onSubmit={handleSubmit}>
      {formError ? (
        <div className="auth-form__error" role="alert">
          {formError}
        </div>
      ) : null}

      <Field>
        <FieldLabel htmlFor={loginNameId}>登录名</FieldLabel>
        <Input
          aria-describedby={errors.loginName ? loginNameErrorId : undefined}
          aria-invalid={Boolean(errors.loginName)}
          autoComplete="username"
          autoFocus
          id={loginNameId}
          name="login_name"
          onChange={(event) => setLoginName(event.target.value)}
          placeholder="test"
          type="text"
          value={loginName}
        />
        {errors.loginName ? (
          <FieldError id={loginNameErrorId}>{errors.loginName}</FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor={passwordId}>密码</FieldLabel>
        <Input
          aria-describedby={errors.password ? passwordErrorId : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id={passwordId}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="test"
          type="password"
          value={password}
        />
        {errors.password ? (
          <FieldError id={passwordErrorId}>{errors.password}</FieldError>
        ) : null}
      </Field>

      <TextButton disabled={submitting} type="submit">
        {submitting ? '登录中...' : '登录'}
      </TextButton>
    </Form>
  )
}
