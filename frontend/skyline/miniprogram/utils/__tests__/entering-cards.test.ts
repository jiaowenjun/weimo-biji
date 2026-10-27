import { describe, expect, it } from 'vitest'
import { buildEnteringCardMap, computeEnteringCardIds } from '../entering-cards'

describe('computeEnteringCardIds', () => {
  it('returns ids present in next but not in prev', () => {
    const prev = new Set([1, 2, 3])
    const next = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    expect(computeEnteringCardIds(prev, next)).toEqual([4, 5])
  })

  it('returns all ids when prev is empty', () => {
    const prev = new Set<number>()
    const next = [{ id: 1 }, { id: 2 }]
    expect(computeEnteringCardIds(prev, next)).toEqual([1, 2])
  })

  it('returns empty when all ids are shared', () => {
    const prev = new Set([1, 2])
    const next = [{ id: 1 }, { id: 2 }]
    expect(computeEnteringCardIds(prev, next)).toEqual([])
  })

  it('returns empty when next is empty', () => {
    const prev = new Set([1, 2])
    expect(computeEnteringCardIds(prev, [])).toEqual([])
  })
})

describe('buildEnteringCardMap', () => {
  it('builds a Record<string, true> from entering ids', () => {
    expect(buildEnteringCardMap([4, 5])).toEqual({ '4': true, '5': true })
  })

  it('returns null when no entering ids', () => {
    expect(buildEnteringCardMap([])).toBeNull()
  })
})
