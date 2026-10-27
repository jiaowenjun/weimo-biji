import { createContext } from 'react'

import type { AuthStatus, UserLoginInput, UserProfile } from './auth-types'

export type AuthContextValue = {
  displayName: string
  login: (input: UserLoginInput) => Promise<void>
  logout: () => void
  status: AuthStatus
  token: string | null
  user: UserProfile | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
