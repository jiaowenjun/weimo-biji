import { ENVIRONMENT_CONFIG } from '../config/env'
import type { MiniRefreshRequest, TokenDto } from '../models/auth'
import { isRecord } from './guards'
import { reLaunchToAuth } from './navigation'
import { AppPagePaths } from './routes'
import { clearSession, getSession, patchSession } from './session'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type RequestPayload = WechatMiniprogram.IAnyObject | string | ArrayBuffer | unknown[]

interface RequestOptions<TData extends RequestPayload | undefined> {
  url: string
  method?: RequestMethod
  data?: TData
  auth?: boolean
  retryOnUnauthorized?: boolean
  redirectOnUnauthorized?: boolean
  timeout?: number
  headers?: WechatMiniprogram.IAnyObject
}

export class ApiError extends Error {
  statusCode: number
  responseData: unknown

  constructor(message: string, statusCode: number, responseData: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.responseData = responseData
  }
}

export type ApiErrorKind = 'forbidden' | 'notFound' | 'transient' | 'unknown'

export function classifyApiError(error: unknown): ApiErrorKind {
  if (!(error instanceof ApiError)) return 'unknown'
  if (error.statusCode === 401 || error.statusCode === 403) return 'forbidden'
  if (error.statusCode === 404) return 'notFound'
  if (error.statusCode === 0 || error.statusCode >= 500) return 'transient'
  return 'unknown'
}

let refreshPromise: Promise<string | null> | null = null
let authRedirectScheduled = false

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${ENVIRONMENT_CONFIG.apiBaseUrl}${normalizedPath}`
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data) && typeof data.error === 'string' && data.error.trim()) {
    return data.error
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return fallback
}

function redirectToAuth() {
  if (authRedirectScheduled) {
    return
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]

  if (currentPage && currentPage.route === AppPagePaths.auth) {
    return
  }

  authRedirectScheduled = true
  void reLaunchToAuth().finally(() => {
    setTimeout(() => {
      authRedirectScheduled = false
    }, 300)
  })
}

function rawRequest<TResponse, TData extends RequestPayload | undefined>(
  options: RequestOptions<TData>,
) {
  return new Promise<TResponse>((resolve, reject) => {
    wx.request({
      url: buildUrl(options.url),
      method: options.method != null ? options.method : 'GET',
      data: options.data as WechatMiniprogram.IAnyObject | string | ArrayBuffer | undefined,
      timeout: options.timeout != null ? options.timeout : 15000,
      header: {
        'content-type': 'application/json',
        ...options.headers,
      },
      success: response => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as TResponse)
          return
        }

        reject(
          new ApiError(
            extractErrorMessage(response.data, '请求失败'),
            response.statusCode,
            response.data,
          ),
        )
      },
      fail: error => {
        reject(new ApiError(error.errMsg || '网络请求失败', 0, error))
      },
    })
  })
}

async function refreshAccessToken() {
  const session = getSession()

  if (!session.refreshToken) {
    return null
  }

  if (!refreshPromise) {
    refreshPromise = rawRequest<TokenDto, MiniRefreshRequest>({
      url: '/auth/mini/refresh',
      method: 'POST',
      data: {
        refresh_token: session.refreshToken,
      },
      auth: false,
      retryOnUnauthorized: false,
      redirectOnUnauthorized: false,
    })
      .then(response => {
        patchSession({ accessToken: response.token })
        return response.token
      })
      .catch(() => {
        clearSession()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function request<
  TResponse,
  TData extends RequestPayload | undefined = undefined,
>(options: RequestOptions<TData>): Promise<TResponse> {
  const session = getSession()
  const shouldAttachToken = options.auth !== false && Boolean(session.accessToken)
  const headers = {
    ...options.headers,
    ...(shouldAttachToken
      ? {
          Authorization: `Bearer ${session.accessToken}`,
        }
      : {}),
  }

  try {
    return await rawRequest<TResponse, TData>({
      ...options,
      headers,
    })
  } catch (error) {
    const resolvedError =
      error instanceof ApiError ? error : new ApiError('请求失败', 0, error)

    if (
      resolvedError.statusCode === 401 &&
      options.auth !== false &&
      options.retryOnUnauthorized !== false
    ) {
      const refreshedToken = await refreshAccessToken()

      if (refreshedToken) {
        return rawRequest<TResponse, TData>({
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${refreshedToken}`,
          },
        })
      }
    }

    if (resolvedError.statusCode === 401 && options.redirectOnUnauthorized !== false) {
      clearSession()
      redirectToAuth()
    }

    throw resolvedError
  }
}

export function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function getApiErrorResponseData(error: unknown) {
  return error instanceof ApiError ? error.responseData : null
}
