import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from './use-auth'
import './auth.css'

export function AuthCheckingScreen() {
  return (
    <main className="auth-checking" aria-live="polite">
      正在确认登录状态...
    </main>
  )
}

export function ProtectedRoute() {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'checking') {
    return <AuthCheckingScreen />
  }

  if (status === 'unauthenticated') {
    return <Navigate replace state={{ from: location }} to="/" />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'checking') {
    return <AuthCheckingScreen />
  }

  if (status === 'authenticated') {
    return <Navigate replace to="/me" />
  }

  return <Outlet />
}

export function AuthFallbackRedirect() {
  const { status } = useAuth()

  if (status === 'checking') {
    return <AuthCheckingScreen />
  }

  return <Navigate replace to={status === 'authenticated' ? '/me' : '/'} />
}
