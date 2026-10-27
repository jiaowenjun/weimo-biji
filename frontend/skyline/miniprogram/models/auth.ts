export interface TokenDto {
  token: string
  token_type: string
}

export interface MiniTokenDto extends TokenDto {
  refresh_token: string
}

export interface MiniRefreshRequest {
  refresh_token: string
}

export interface MiniWechatLoginInput {
  code: string
  nickname?: string
}

export interface UserProfile {
  username: string
  nickname: string
  login_name: string
  has_login_password: boolean
}

export interface MiniWechatAuthDto extends MiniTokenDto {
  user: UserProfile
  is_new_user: boolean
}

export interface MiniWechatCheckInput {
  code: string
}

export interface MiniWechatCheckResult {
  is_registered: boolean
}

export interface MiniWechatRegisterInput {
  code: string
  nickname: string
}
