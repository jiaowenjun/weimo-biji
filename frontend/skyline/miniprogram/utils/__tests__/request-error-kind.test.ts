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
})
