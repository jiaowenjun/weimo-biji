export type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated'

export interface TokenDto {
  token: string
  token_type: string
}

export interface UserLoginInput {
  login_name: string
  password: string
}

export interface UserProfile {
  username: string
  nickname: string
  login_name: string
  has_login_password: boolean
}
