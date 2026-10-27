import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ApiError, classifyApiError } from '../request'

describe('classifyApiError', () => {
  it('classifies protocol errors without embedding business fallback policy', () => {
    expect(classifyApiError(new ApiError('unauthorized', 401, null))).toBe('forbidden')
    expect(classifyApiError(new ApiError('forbidden', 403, null))).toBe('forbidden')
    expect(classifyApiError(new ApiError('not found', 404, null))).toBe('notFound')
    expect(classifyApiError(new ApiError('network', 0, null))).toBe('transient')
    expect(classifyApiError(new ApiError('server error', 503, null))).toBe('transient')
    expect(classifyApiError(new ApiError('bad request', 400, null))).toBe('unknown')
    expect(classifyApiError(new Error('plain'))).toBe('unknown')
  })

  it('keeps friend preview hydration on error kind checks instead of status codes', () => {
    const hydratorTs = fs.readFileSync(
      path.join(__dirname, '..', 'friend-reference-preview-hydrator.ts'),
      'utf8',
    )
    const start = hydratorTs.indexOf('function isUnavailableFriendMemoError')
    const end = hydratorTs.indexOf('function buildCachedEntryFromMemo', start)
    const section = hydratorTs.slice(start, end)

    expect(section).toContain('classifyApiError(error)')
    expect(section).toContain("'forbidden'")
    expect(section).toContain("'notFound'")
    expect(section).not.toContain('statusCode')
  })
})
