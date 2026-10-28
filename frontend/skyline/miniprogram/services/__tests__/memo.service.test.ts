import { wdfDoc } from '../../test-utils/wdf'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemoDto, MemoUtcArray } from '../../models/memo'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}))

import { getMemo, getMemos } from '../memo'

const utc: MemoUtcArray = [2026, 114, 10, 30, 0, 0, 0, 0, 0]

function dto(id: number, overrides: Partial<MemoDto> = {}): MemoDto {
  return {
    id,
    ct_utc: utc,
    mt_utc: utc,
    tags: [],
    content: `memo-${id}`,
    refs: [],
    referenced_by: [],
    ...overrides,
  }
}

describe('memo service detail APIs', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('fetches one memo by id and maps refs plus referenced_by', async () => {
    requestMock.mockResolvedValue(dto(7, {
      refs: ['1'],
      referenced_by: ['9'],
    }))

    const memo = await getMemo(7)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/memo/7',
      method: 'GET',
    })
    expect(memo).toMatchObject({
      id: 7,
      refs: ['1'],
      referencedBy: ['9'],
    })
  })

  it('fetches multiple memos by ids through the batch endpoint', async () => {
    requestMock.mockResolvedValue([
      dto(1, { content: wdfDoc('A') }),
      dto(2, { content: wdfDoc('B'), refs: ['1'] }),
    ])

    const memos = await getMemos([1, 2])

    expect(requestMock).toHaveBeenCalledWith({
      url: '/memo/batch',
      method: 'POST',
      data: [1, 2],
    })
    expect(memos.map((memo) => ({ id: memo.id, content: memo.content, refs: memo.refs }))).toEqual([
      { id: 1, content: wdfDoc('A'), refs: [] },
      { id: 2, content: wdfDoc('B'), refs: ['1'] },
    ])
  })
})
