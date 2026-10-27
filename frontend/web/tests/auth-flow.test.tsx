import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/auth-context'
import { LoginScreen } from '@/features/auth/login-screen'
import { AUTH_STORAGE_KEY } from '@/features/auth/session-storage'
import { useAuth } from '@/features/auth/use-auth'

import { API_ORIGIN, server } from './test-server'

function AuthStateProbe() {
  const { displayName, status, token } = useAuth()

  return (
    <dl>
      <dt>Status</dt>
      <dd aria-label="status">{status}</dd>
      <dt>Token</dt>
      <dd aria-label="token">{token ?? 'none'}</dd>
      <dt>User</dt>
      <dd aria-label="display name">{displayName || 'none'}</dd>
    </dl>
  )
}

describe('Biji authentication flow', () => {
  it('restores a stored session and reacts to cross-tab logout', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'stored-token')
    server.use(
      http.get(`${API_ORIGIN}/api/me`, () => HttpResponse.json({
        username: 'alice',
        nickname: 'Alice',
        login_name: 'alice',
        has_login_password: true,
      })),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthStateProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('status')).toHaveTextContent('checking')
    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByLabelText('display name')).toHaveTextContent('Alice')

    window.dispatchEvent(new StorageEvent('storage', {
      key: AUTH_STORAGE_KEY,
      newValue: null,
    }))

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('unauthenticated')
    })
    expect(screen.getByLabelText('token')).toHaveTextContent('none')
  })

  it('validates the form, logs in, and returns to the requested route', async () => {
    const user = userEvent.setup()

    server.use(
      http.post(`${API_ORIGIN}/api/auth/login`, () => HttpResponse.json({
        token: 'access-1',
        token_type: 'bearer',
      })),
      http.get(`${API_ORIGIN}/api/me`, () => HttpResponse.json({
        username: 'alice',
        nickname: 'Alice',
        login_name: 'alice',
        has_login_password: true,
      })),
    )

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/',
        state: { from: { pathname: '/requested' } },
      }]}>
        <AuthProvider>
          <Routes>
            <Route element={<LoginScreen />} path="/" />
            <Route element={<h1>请求的笔记页</h1>} path="/requested" />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByText('请填写登录名')).toBeVisible()
    expect(screen.getByText('请填写密码')).toBeVisible()

    await user.type(screen.getByLabelText('登录名'), '  alice  ')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByRole('heading', { name: '请求的笔记页' })).toBeVisible()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('access-1')
  })
})
