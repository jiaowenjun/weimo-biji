import { describe, expect, it } from 'vitest'
import {
  appendMemoRefId,
  ownMemoIdFromRef,
  removeMemoRefId,
  uniqueOwnMemoIds,
} from '../memo-ref-id'

describe('ownMemoIdFromRef', () => {
  it('accepts positive local memo ids', () => {
    expect(ownMemoIdFromRef('42')).toBe(42)
  })

  it('rejects slash refs and invalid local ids', () => {
    expect(ownMemoIdFromRef('bob/42')).toBeNull()
    expect(ownMemoIdFromRef('0')).toBeNull()
    expect(ownMemoIdFromRef('not-a-number')).toBeNull()
  })
})

describe('uniqueOwnMemoIds', () => {
  it('deduplicates local refs while ignoring non-local refs', () => {
    expect(uniqueOwnMemoIds(['1', 'bob/2', '2', '1'])).toEqual([1, 2])
  })
})

describe('memo ref array helpers', () => {
  it('appends only missing refs', () => {
    expect(appendMemoRefId(['1'], '2')).toEqual(['1', '2'])
    expect(appendMemoRefId(['1'], '1')).toEqual(['1'])
  })

  it('removes existing refs without changing arrays that do not contain the ref', () => {
    const refs = ['1', '2']

    expect(removeMemoRefId(refs, '1')).toEqual(['2'])
    expect(removeMemoRefId(refs, '3')).toBe(refs)
  })
})
