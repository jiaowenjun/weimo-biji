import { render, screen } from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router'
import { describe, expect, it } from 'vitest'

import {
  AuthContext,
  type AuthContextValue,
} from '@/features/auth/auth-context-value'
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from '@/features/auth/route-guards'
import type { AuthStatus } from '@/features/auth/auth-types'

function authValue(status: AuthStatus): AuthContextValue {
  return {
    displayName: '',
    login: async () => {},
    logout: () => {},
    status,
    token: status === 'authenticated' ? 'access-1' : null,
    user: null,
  }
}

function LoginDestination() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from

  return <p>登录入口:{from?.pathname ?? 'none'}</p>
}

function renderRoutes(status: AuthStatus, initialPath: string) {
  return render(
    <AuthContext.Provider value={authValue(status)}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route element={<LoginDestination />} path="/" />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<h1>私有笔记页</h1>} path="/me" />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Biji route guards', () => {
  it('shows a checking state before the session decision', () => {
    renderRoutes('checking', '/me')
    expect(screen.getByText('正在确认登录状态...')).toBeVisible()
  })

  it('redirects anonymous visitors and preserves the requested location', () => {
    renderRoutes('unauthenticated', '/me')
    expect(screen.getByText('登录入口:/me')).toBeVisible()
  })

  it('allows authenticated visitors into protected routes', () => {
    renderRoutes('authenticated', '/me')
    expect(screen.getByRole('heading', { name: '私有笔记页' })).toBeVisible()
  })

  it('redirects authenticated visitors away from the login route', () => {
    renderRoutes('authenticated', '/')
    expect(screen.getByRole('heading', { name: '私有笔记页' })).toBeVisible()
  })
})
