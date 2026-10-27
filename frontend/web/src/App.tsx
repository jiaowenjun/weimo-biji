import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import {
  loadGuestWorkspacePage,
  loadWorkspaceDemoPage,
} from '@/app-route-loaders'
import { AuthProvider } from '@/features/auth/auth-context'
import { LoginScreen } from '@/features/auth/login-screen'
import {
  AuthFallbackRedirect,
  ProtectedRoute,
  PublicOnlyRoute,
} from '@/features/auth/route-guards'

const GuestWorkspacePage = lazy(() =>
  loadGuestWorkspacePage().then((module) => ({
    default: module.GuestWorkspacePage,
  })),
)
const WorkspaceDemoPage = lazy(() =>
  loadWorkspaceDemoPage().then((module) => ({
    default: module.WorkspaceDemoPage,
  })),
)

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '')

function WorkspaceRouteFallback() {
  return (
    <main className="auth-checking" aria-live="polite">
      正在加载工作区...
    </main>
  )
}

function App() {
  return (
    <BrowserRouter basename={routerBasename || undefined}>
      <Routes>
        <Route element={<AuthProvider />}>
          <Route element={<PublicOnlyRoute />}>
            <Route element={<LoginScreen />} path="/" />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route
              element={(
                <Suspense fallback={<WorkspaceRouteFallback />}>
                  <WorkspaceDemoPage />
                </Suspense>
              )}
              path="/me"
            />
          </Route>
          <Route
            element={(
              <Suspense fallback={<WorkspaceRouteFallback />}>
                <GuestWorkspacePage />
              </Suspense>
            )}
            path="/guest"
          />
          <Route element={<Navigate replace to="/" />} path="/login" />
          <Route element={<AuthFallbackRedirect />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
