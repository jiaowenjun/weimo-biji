import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Outlet, useNavigate } from 'react-router'

import { preloadWorkspaceDemoPage } from '@/app-route-loaders'
import { getCurrentUser, loginUser, toUserMessage } from './auth-api'
import type { AuthStatus, UserLoginInput, UserProfile } from './auth-types'
import { AuthContext, type AuthContextValue } from './auth-context-value'
import {
  clearSessionToken,
  readSessionToken,
  subscribeSessionToken,
  writeSessionToken,
} from './session-storage'

function resolveDisplayName(user: UserProfile | null) {
  if (!user) {
    return ''
  }

  return user.nickname?.trim() || user.login_name?.trim() || user.username
}

export function AuthProvider({ children }: { children?: ReactNode }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const storedToken = readSessionToken()

      if (!storedToken) {
        if (!cancelled) {
          setStatus('unauthenticated')
        }
        return
      }

      preloadWorkspaceDemoPage()

      try {
        const result = await getCurrentUser(storedToken)
        if (cancelled) return

        writeSessionToken(result.token)
        setToken(result.token)
        setUser(result.data)
        setStatus('authenticated')
      } catch {
        if (cancelled) return

        clearSessionToken()
        setToken(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      subscribeSessionToken((nextToken) => {
        if (!nextToken) {
          setToken(null)
          setUser(null)
          setStatus('unauthenticated')
          return
        }

        setToken(nextToken)
        setStatus('authenticated')
      }),
    [],
  )

  const login = useCallback(async (input: UserLoginInput) => {
    clearSessionToken()
    setToken(null)
    setUser(null)

    try {
      const nextToken = await loginUser(input)
      preloadWorkspaceDemoPage()
      const result = await getCurrentUser(nextToken)
      const token = result.token
      writeSessionToken(token)
      setToken(token)
      setUser(result.data)
      setStatus('authenticated')
    } catch (error) {
      clearSessionToken()
      setToken(null)
      setUser(null)
      setStatus('unauthenticated')
      throw new Error(toUserMessage(error), { cause: error })
    }
  }, [])

  const logout = useCallback(() => {
    clearSessionToken()
    setToken(null)
    setUser(null)
    setStatus('unauthenticated')
    navigate('/', { replace: true })
  }, [navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      displayName: resolveDisplayName(user),
      login,
      logout,
      status,
      token,
      user,
    }),
    [login, logout, status, token, user],
  )

  return (
    <AuthContext.Provider value={value}>
      {children ?? <Outlet />}
    </AuthContext.Provider>
  )
}
