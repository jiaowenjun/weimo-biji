import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getCurrentUser,
  loginUser,
} from '@/features/auth/auth-api'
import { AUTH_STORAGE_KEY } from '@/features/auth/session-storage'

import { API_ORIGIN, server } from './test-server'

// msw 3 重建的 Request 不保留 credentials 初始化项，
// 凭据契约改为在 fetch 入参上断言（spy 包住 msw 已补丁的 fetch）
function spyOnFetchCalls() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const originalFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    calls.push({ url: String(input), init })
    return originalFetch(input, init)
  })

  return calls
}

describe('Biji auth API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits login credentials as a first-party JSON request', async () => {
    const fetchCalls = spyOnFetchCalls()
    server.use(
      http.post(`${API_ORIGIN}/api/auth/login`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          login_name: 'alice',
          password: 'secret',
        })
        return HttpResponse.json({ token: 'access-1', token_type: 'bearer' })
      }),
    )

    await expect(loginUser({ login_name: 'alice', password: 'secret' }))
      .resolves.toBe('access-1')
    expect(fetchCalls.at(-1)?.init?.credentials).toBe('include')
  })

  it('refreshes an expired token once and retries the protected request', async () => {
    const authorizationHeaders: Array<string | null> = []
    const fetchCalls = spyOnFetchCalls()
    let refreshRequests = 0

    server.use(
      http.get(`${API_ORIGIN}/api/me`, ({ request }) => {
        const authorization = request.headers.get('Authorization')

        authorizationHeaders.push(authorization)
        if (authorization === 'Bearer expired-token') {
          return HttpResponse.json({ error: 'expired' }, { status: 401 })
        }

        return HttpResponse.json({
          username: 'alice',
          nickname: 'Alice',
          login_name: 'alice',
          has_login_password: true,
        })
      }),
      http.post(`${API_ORIGIN}/api/auth/refresh`, () => {
        refreshRequests += 1
        return HttpResponse.json({ token: 'fresh-token', token_type: 'bearer' })
      }),
    )

    await expect(getCurrentUser('expired-token')).resolves.toMatchObject({
      data: { username: 'alice' },
      token: 'fresh-token',
    })
    expect(authorizationHeaders).toEqual([
      'Bearer expired-token',
      'Bearer fresh-token',
    ])
    expect(refreshRequests).toBe(1)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('fresh-token')
    expect(
      fetchCalls.find(({ url }) => url.endsWith('/auth/refresh'))?.init?.credentials,
    ).toBe('include')
  })

  it('rejects a successful response that violates the user contract', async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/me`, () => HttpResponse.json({
        username: 'alice',
        nickname: 'Alice',
        login_name: 'alice',
        has_login_password: 'yes',
      })),
    )

    await expect(getCurrentUser('access-1')).rejects.toMatchObject({
      endpoint: '/me',
      issues: expect.arrayContaining([
        expect.objectContaining({ path: '$.has_login_password' }),
      ]),
      name: 'ApiContractError',
    })
  })
})
