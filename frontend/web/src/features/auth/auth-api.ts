import {
  ApiContractError,
  parseApiContract,
  type ApiContract,
} from '@/lib/api-contract'

import { tokenDtoSchema, userProfileSchema } from './auth-contracts'
import type { UserLoginInput } from './auth-types'
import { clearSessionToken, writeSessionToken } from './session-storage'

const DEV_API_BASE_URL = `${import.meta.env.BASE_URL}api`
const PRODUCTION_API_BASE_URL = 'https://weimo.ink/api'
const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? DEV_API_BASE_URL
  : PRODUCTION_API_BASE_URL

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, '')

type JsonRecord = Record<string, unknown>

export class ApiError extends Error {
  data: unknown
  status: number

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

async function parseResponseBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function resolveErrorMessage(status: number, data: unknown) {
  if (isRecord(data)) {
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim()
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim()
    }
  }

  if (status === 401) return '登录状态已失效，请重新登录'
  if (status === 403) return '没有权限执行此操作'
  if (status === 404) return '请求的资源不存在'
  if (status === 409) return '与现有数据冲突'
  if (status === 422) return '提交的数据无效'
  if (status >= 500) return '服务器异常，请稍后重试'
  return '登录失败，请稍后重试'
}

async function requestJson<T>(
  path: string,
  contract: ApiContract<T>,
  init: RequestInit & { token?: string } = {},
) {
  const { headers, token, ...rest } = init
  const requestHeaders = new Headers(headers)

  requestHeaders.set('Accept', 'application/json')
  if (rest.body) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: requestHeaders,
  })
  const data = await parseResponseBody(response)

  if (!response.ok) {
    throw new ApiError(resolveErrorMessage(response.status, data), response.status, data)
  }

  return parseApiContract(path, contract, data)
}

let refreshPromise: Promise<string | null> | null = null

export async function loginUser(input: UserLoginInput) {
  const data = await requestJson('/auth/login', tokenDtoSchema, {
    body: JSON.stringify(input),
    method: 'POST',
  })

  return data.token
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = requestJson('/auth/refresh', tokenDtoSchema, { method: 'POST' })
      .then((data) => {
        writeSessionToken(data.token)

        return data.token
      })
      .catch(() => {
        clearSessionToken()

        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function requestProtectedJson<T>(
  path: string,
  token: string,
  contract: ApiContract<T>,
  init: RequestInit = {},
): Promise<{ data: T; token: string }> {
  try {
    return {
      data: await requestJson(path, contract, { ...init, token }),
      token,
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error
    }

    if (error.status !== 401) {
      throw error
    }

    const refreshedToken = await refreshAccessToken()
    if (!refreshedToken) {
      throw error
    }

    return {
      data: await requestJson(path, contract, { ...init, token: refreshedToken }),
      token: refreshedToken,
    }
  }
}

export async function getCurrentUser(token: string) {
  return requestProtectedJson('/me', token, userProfileSchema)
}

export function toUserMessage(error: unknown, fallback = '登录失败，请稍后重试') {
  if (error instanceof ApiError) {
    return error.message || fallback
  }

  if (error instanceof ApiContractError) {
    return '服务器返回的数据无效，请稍后重试'
  }

  if (error instanceof TypeError) {
    return '网络不可用，请检查后端服务'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
