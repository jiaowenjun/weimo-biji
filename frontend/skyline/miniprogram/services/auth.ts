import type {
  MiniWechatAuthDto,
  MiniWechatCheckInput,
  MiniWechatCheckResult,
  MiniWechatLoginInput,
  MiniWechatRegisterInput,
  UserProfile,
} from '../models/auth'
import { request } from '../utils/request'

export interface NicknameUpdateInput {
  nickname: string
}

export interface LoginNameUpdateInput {
  login_name: string
}

export interface LoginPasswordUpdateInput {
  password: string
  confirm_password: string
}

export function loginWechatMini(input: MiniWechatLoginInput) {
  return request<MiniWechatAuthDto, MiniWechatLoginInput>({
    url: '/auth/mini/wechat',
    method: 'POST',
    data: input,
    auth: false,
    retryOnUnauthorized: false,
    redirectOnUnauthorized: false,
  })
}

export function checkWechatMini(input: MiniWechatCheckInput) {
  return request<MiniWechatCheckResult, MiniWechatCheckInput>({
    url: '/auth/mini/wechat/check',
    method: 'POST',
    data: input,
    auth: false,
    retryOnUnauthorized: false,
    redirectOnUnauthorized: false,
  })
}

export function registerWechatMini(input: MiniWechatRegisterInput) {
  return request<MiniWechatAuthDto, MiniWechatRegisterInput>({
    url: '/auth/mini/wechat/register',
    method: 'POST',
    data: input,
    auth: false,
    retryOnUnauthorized: false,
    redirectOnUnauthorized: false,
  })
}

export function getCurrentUser() {
  return request<UserProfile>({
    url: '/me',
  })
}

export function updateCurrentUserNickname(input: NicknameUpdateInput) {
  return request<void, NicknameUpdateInput>({
    url: '/me/nickname',
    method: 'POST',
    data: input,
  })
}

export function updateCurrentUserLoginName(input: LoginNameUpdateInput) {
  return request<UserProfile, LoginNameUpdateInput>({
    url: '/me/login-name',
    method: 'POST',
    data: input,
  })
}

export function updateCurrentUserLoginPassword(input: LoginPasswordUpdateInput) {
  return request<UserProfile, LoginPasswordUpdateInput>({
    url: '/me/login-password',
    method: 'POST',
    data: input,
  })
}
