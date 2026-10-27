import { describe, expect, it } from 'vitest'
import { buildMemoCardsPatch } from '../store-bindings/memo-cards-patch'

type Card = { id: number }

const c = (id: number): Card => ({ id })

describe('buildMemoCardsPatch', () => {
  it('returns empty patch when references are identical', () => {
    const arr = [c(1), c(2)]
    expect(buildMemoCardsPatch(arr, arr)).toEqual({})
  })

  it('returns full memoCards when last is null (initial render)', () => {
    const next = [c(1), c(2)]
    expect(buildMemoCardsPatch(null, next)).toEqual({ memoCards: next })
  })

  it('returns field-path append when next is a reference superset of last (loadMore)', () => {
    const a = c(1)
    const b = c(2)
    const cc = c(3)
    const dd = c(4)
    const last = [a, b]
    const next = [a, b, cc, dd]
    expect(buildMemoCardsPatch(last, next)).toEqual({
      'memoCards[2]': cc,
      'memoCards[3]': dd,
    })
  })

  it('uses field-path update when same length but all items differ (refresh)', () => {
    const last = [c(1), c(2), c(3)]
    const n0 = c(99)
    const n1 = c(100)
    const n2 = c(101)
    const next = [n0, n1, n2]
    expect(buildMemoCardsPatch(last, next)).toEqual({
      'memoCards[0]': n0,
      'memoCards[1]': n1,
      'memoCards[2]': n2,
    })
  })

  it('uses field-path splice when deleting a single middle item', () => {
    const a = c(1)
    const b = c(2)
    const cc = c(3)
    const d = c(4)
    const last = [a, b, cc, d]
    const next = [a, cc, d]
    expect(buildMemoCardsPatch(last, next)).toEqual({
      'memoCards[1]': cc,
      'memoCards[2]': d,
      memoCards: next,
    })
  })

  it('uses field-path splice when deleting the first item', () => {
    const a = c(1)
    const b = c(2)
    const cc = c(3)
    const last = [a, b, cc]
    const next = [b, cc]
    expect(buildMemoCardsPatch(last, next)).toEqual({
      'memoCards[0]': b,
      'memoCards[1]': cc,
      memoCards: next,
    })
  })

  it('uses field-path splice when deleting the last item with stable prefix', () => {
    const a = c(1)
    const b = c(2)
    const last = [a, b, c(3)]
    const next = [a, b]
    expect(buildMemoCardsPatch(last, next)).toEqual({ memoCards: next })
  })

  it('falls back to full memoCards replacement when shorter but not a single delete', () => {
    const last = [c(1), c(2), c(3)]
    const next = [c(99)]
    expect(buildMemoCardsPatch(last, next)).toEqual({ memoCards: next })
  })

  it('falls back to full memoCards replacement when delete shift references differ', () => {
    const a = c(1)
    const b = c(2)
    const c3 = c(3)
    const c3Copy = c(3)
    const last = [a, b, c3]
    const next = [a, c3Copy]
    expect(buildMemoCardsPatch(last, next)).toEqual({ memoCards: next })
  })

  it('uses field-path update when same length but item differs (in-place edit)', () => {
    const a = c(1)
    const b = c(2)
    const last = [a, b]
    const next_b = c(2)
    const next = [a, next_b]
    expect(buildMemoCardsPatch(last, next)).toEqual({ 'memoCards[1]': next_b })
  })

  it('returns empty patch when same length and all items reference-equal (redundant setData)', () => {
    const a = c(1)
    const b = c(2)
    const last = [a, b]
    const next = [a, b]
    expect(buildMemoCardsPatch(last, next)).toEqual({})
  })

  it('uses field-path update for multiple changed items at same length', () => {
    const a = c(1)
    const b = c(2)
    const shared = c(3)
    const d = c(4)
    const b2 = c(2)
    const d2 = c(4)
    const last = [a, b, shared, d]
    const next = [a, b2, shared, d2]
    expect(buildMemoCardsPatch(last, next)).toEqual({
      'memoCards[1]': b2,
      'memoCards[3]': d2,
    })
  })
})
