import { describe, expect, it } from 'vitest'
import { memoListKeyFromQuery } from '../workspace-keys'

describe('memoListKeyFromQuery', () => {
  it('produces stable key regardless of property order', () => {
    const k1 = memoListKeyFromQuery({ tag: 'A', text: { contains: 'x' } }, 8)
    const k2 = memoListKeyFromQuery({ text: { contains: 'x' }, tag: 'A' }, 8)
    expect(k1).toBe(k2)
  })
  it('encodes empty filters distinctly from non-empty', () => {
    expect(memoListKeyFromQuery({}, 8)).not.toBe(
      memoListKeyFromQuery({ tag: 'A' }, 8),
    )
  })
  it('encodes pageSize', () => {
    expect(memoListKeyFromQuery({}, 8)).not.toBe(
      memoListKeyFromQuery({}, 16),
    )
  })
})
