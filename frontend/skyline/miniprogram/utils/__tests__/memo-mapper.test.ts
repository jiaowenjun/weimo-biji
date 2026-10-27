import { describe, expect, it } from 'vitest'
import type { MemoDto } from '../../models/memo'
import { mapMemo } from '../memo-mapper'

function makeDto(overrides: Partial<MemoDto> = {}): MemoDto {
  return {
    id: 1,
    ct_utc: [2026, 119, 8, 0, 0, 0, 0, 0, 0],
    mt_utc: [2026, 119, 8, 0, 0, 0, 0, 0, 0],
    tags: ['Work'],
    content: 'hello',
    refs: [],
    referenced_by: [],
    ...overrides,
  }
}

describe('mapMemo refs', () => {
  it('maps backend refs into the local memo model', () => {
    const memo = mapMemo(makeDto({ refs: ['7'] }))

    expect(memo.refs).toEqual(['7'])
  })

  it('maps string refs into MemoRefId arrays', () => {
    const memo = mapMemo(makeDto({
      id: 3,
      refs: ['7', 'bob/12'],
      referenced_by: ['9'],
    }))

    expect(memo.refs).toEqual(['7', 'bob/12'])
    expect(memo.referencedBy).toEqual(['9'])
  })

  it('normalizes legacy numeric refs to strings', () => {
    const memo = mapMemo(makeDto({
      id: 3,
      refs: [7] as unknown as string[],
      referenced_by: [9] as unknown as string[],
    }))

    expect(memo.refs).toEqual(['7'])
    expect(memo.referencedBy).toEqual(['9'])
  })

  it('normalizes missing refs to an empty array for older responses', () => {
    const dto = makeDto()
    delete (dto as Partial<MemoDto>).refs

    const memo = mapMemo(dto)

    expect(memo.refs).toEqual([])
  })

  it('maps backend referenced_by into the local memo model', () => {
    const memo = mapMemo(makeDto({ referenced_by: ['9', '10'] }))

    expect(memo.referencedBy).toEqual(['9', '10'])
  })

  it('normalizes missing referenced_by to an empty array for older responses', () => {
    const dto = makeDto()
    delete (dto as Partial<MemoDto>).referenced_by

    const memo = mapMemo(dto)

    expect(memo.referencedBy).toEqual([])
  })
})
