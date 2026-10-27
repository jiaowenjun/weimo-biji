import { describe, expect, it } from 'vitest'
import { isRecord } from '../guards'

describe('guards', () => {
  it('treats plain objects as records and excludes arrays/null', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ value: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('value')).toBe(false)
  })
})
