import { describe, expect, it } from 'vitest'
import { invalidateWorkspace } from '../invalidate-workspace'

function makeState() {
  return {
    memos: { detail: new Map(), list: new Map() },
    stats: { status: 'success', error: null, dataUpdatedAt: 100, data: { note_count: 1 } as any },
    tagTree: { status: 'success', error: null, dataUpdatedAt: 100, data: [] as any },
  }
}

describe('invalidateWorkspace', () => {
  it('marks stats / tagTree as stale by zeroing dataUpdatedAt', () => {
    const s = makeState()
    invalidateWorkspace(s as any, { memos: false, stats: true, tagTree: true })
    expect(s.stats.dataUpdatedAt).toBe(0)
    expect(s.tagTree.dataUpdatedAt).toBe(0)
  })
  it('leaves data intact (only marks dirty)', () => {
    const s = makeState()
    invalidateWorkspace(s as any, { stats: true })
    expect(s.stats.data).toEqual({ note_count: 1 })
  })
})
