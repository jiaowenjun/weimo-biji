import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo } from '../../models/memo'
import {
  createEmptyWorkspaceState,
  type WorkspaceState,
} from '../workspace-store'
import { createVisitorWorkspaceServices } from '../visitor-workspace-services'

function makeMemo(id: number, overrides: Partial<Memo> = {}): Memo {
  const day = String(Math.max(id, 1)).padStart(2, '0')
  const createdAt = `2026-04-${day}T10:00:00.000Z`
  return {
    id,
    content: `memo-${id}`,
    tags: [],
    createdAt,
    updatedAt: createdAt,
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

function createSeedState(memos: Memo[]): WorkspaceState {
  const state = createEmptyWorkspaceState()
  for (const memo of memos) {
    state.memos.detail.set(memo.id, {
      status: 'success',
      error: null,
      dataUpdatedAt: 1,
      memo,
    })
  }
  return state
}

describe('createVisitorWorkspaceServices.searchMemos', () => {
  it('paginates local memos newest-first using numeric offset cursors', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(1, { createdAt: '2026-04-01T08:00:00.000Z', updatedAt: '2026-04-01T08:00:00.000Z' }),
      makeMemo(2, { createdAt: '2026-04-03T08:00:00.000Z', updatedAt: '2026-04-03T08:00:00.000Z' }),
      makeMemo(3, { createdAt: '2026-04-02T08:00:00.000Z', updatedAt: '2026-04-02T08:00:00.000Z' }),
    ]))

    const firstPage = await services.searchMemos({}, null, 2)
    expect(firstPage).toEqual({
      items: [expect.objectContaining({ id: 2 }), expect.objectContaining({ id: 3 })],
      nextCursor: '2',
      hasMore: true,
      totalCount: 3,
    })

    const secondPage = await services.searchMemos({}, firstPage.nextCursor, 2)
    expect(secondPage).toEqual({
      items: [expect.objectContaining({ id: 1 })],
      nextCursor: null,
      hasMore: false,
      totalCount: 3,
    })
  })

  it('filters local memos by descendant tag and text content', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(1, { tags: ['Work/project'], content: 'ship alpha today' }),
      makeMemo(2, { tags: ['Work/admin'], content: 'expense sheet' }),
      makeMemo(3, { tags: ['Life/reading'], content: 'alpha notes from book' }),
    ]))

    const page = await services.searchMemos({
      tag: 'Work',
      text: { contains: 'alpha' },
    }, null, 10)

    expect(page.items.map((memo) => memo.id)).toEqual([1])
    expect(page.totalCount).toBe(1)
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBe(null)
  })
})

describe('createVisitorWorkspaceServices.createMemo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T12:34:56.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a negative id and refreshes local stats and tag tree', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(10, {
        tags: ['Work/project'],
        content: 'alpha beta',
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      }),
    ]))

    const newId = await services.createMemo({
      content: 'new visitor memo',
      tags: ['Ideas/brainstorm'],
    })

    expect(newId).toBeLessThan(0)

    const stats = await services.getWorkspaceStats()
    expect(stats).toEqual({
      note_count: 2,
      tag_count: 2,
      word_count: 5,
      daily_note_count: [[20260421, 1], [20260423, 1]],
    })

    const tagTree = await services.getTagTree()
    expect(tagTree).toEqual({
      label: 'root',
      tag: '',
      item_count: 2,
      children: [
        {
          label: 'Ideas',
          tag: 'Ideas',
          item_count: 1,
          children: [
            {
              label: 'brainstorm',
              tag: 'Ideas/brainstorm',
              item_count: 1,
              children: [],
            },
          ],
        },
        {
          label: 'Work',
          tag: 'Work',
          item_count: 1,
          children: [
            {
              label: 'project',
              tag: 'Work/project',
              item_count: 1,
              children: [],
            },
          ],
        },
      ],
    })
  })

  it('persists refs for visitor-created and visitor-updated memos', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(1, {
        tags: ['Source'],
        content: 'A',
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      }),
    ]))

    const id = await services.createMemo({
      content: 'B',
      tags: ['Reply'],
      refs: ['1'],
    })

    let page = await services.searchMemos({}, null, 10)
    expect(page.items.find((memo) => memo.id === id)?.refs).toEqual(['1'])

    await services.updateMemo(id, {
      content: 'B updated',
      tags: ['Reply'],
      refs: ['1'],
    })

    page = await services.searchMemos({}, null, 10)
    expect(page.items.find((memo) => memo.id === id)?.refs).toEqual(['1'])
  })

  it('maintains referencedBy for visitor-created and visitor-updated refs', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(1, { content: 'A' }),
      makeMemo(2, { content: 'C' }),
    ]))

    const id = await services.createMemo({ content: 'B', tags: [], refs: ['1'] })

    let page = await services.searchMemos({}, null, 10)
    expect(page.items.find((memo) => memo.id === 1)?.referencedBy).toEqual([String(id)])
    expect(page.items.find((memo) => memo.id === id)?.referencedBy).toEqual([])

    await services.updateMemo(id, { content: 'B retargeted', tags: [], refs: ['2'] })

    page = await services.searchMemos({}, null, 10)
    expect(page.items.find((memo) => memo.id === 1)?.referencedBy).toEqual([])
    expect(page.items.find((memo) => memo.id === 2)?.referencedBy).toEqual([String(id)])
  })
})

describe('createVisitorWorkspaceServices.renameTag', () => {
  it('rejects because visitor mode does not support tag rename', async () => {
    const services = createVisitorWorkspaceServices(createSeedState([
      makeMemo(1, { tags: ['Work/project'] }),
    ]))

    await expect(services.renameTag('Work', 'Archive')).rejects.toThrow('游客模式不支持标签重命名')
  })
})
