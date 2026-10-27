import { Link, useLocation, useNavigate } from 'react-router'
import { getCardSurfaceClassName } from 'weimo-ui/components/card-surface'

import { preloadGuestWorkspacePage } from '@/app-route-loaders'
import { LoginForm } from './login-form'
import './auth.css'

type LocationState = {
  from?: {
    pathname?: string
  }
}

function resolvePostLoginDestination(state: unknown) {
  const from = (state as LocationState | null)?.from?.pathname

  if (from && from !== '/') {
    return from
  }

  return '/me'
}

export function LoginScreen() {
  const location = useLocation()
  const navigate = useNavigate()

  function handleSuccess() {
    const destination = resolvePostLoginDestination(location.state)
    navigate(destination, { replace: true })
  }

  return (
    <main className="login-screen">
      <section className={getCardSurfaceClassName('login-screen__panel')} aria-labelledby="login-title">
        <div className="login-screen__heading">
          <p className="login-screen__eyebrow">weimo · 维摩</p>
          <h1 id="login-title">登录笔记</h1>
        </div>
        <LoginForm onSuccess={handleSuccess} />
        <Link
          className="login-screen__guest-link"
          onFocus={preloadGuestWorkspacePage}
          onMouseEnter={preloadGuestWorkspacePage}
          to="/guest"
        >
          游客模式
        </Link>
      </section>
    </main>
  )
}
