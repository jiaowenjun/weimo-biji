import { describe, expect, it } from 'vitest'
import {
  appendMemoRefId,
  ownMemoIdFromRef,
  parseFriendMemoRef,
  removeMemoRefId,
  uniqueOwnMemoIds,
} from '../memo-ref-id'

describe('ownMemoIdFromRef', () => {
  it('accepts positive local memo ids', () => {
    expect(ownMemoIdFromRef('42')).toBe(42)
  })

  it('rejects friend refs and invalid local ids', () => {
    expect(ownMemoIdFromRef('bob/42')).toBeNull()
    expect(ownMemoIdFromRef('0')).toBeNull()
    expect(ownMemoIdFromRef('not-a-number')).toBeNull()
  })
})

describe('parseFriendMemoRef', () => {
  it('parses friend username and positive memo id', () => {
    expect(parseFriendMemoRef('bob/42')).toEqual({
      username: 'bob',
      memoId: 42,
    })
  })

  it('rejects local refs, empty owners, nested paths, and invalid ids', () => {
    expect(parseFriendMemoRef('42')).toBeNull()
    expect(parseFriendMemoRef('/42')).toBeNull()
    expect(parseFriendMemoRef('bob/0')).toBeNull()
    expect(parseFriendMemoRef('bob/not-a-number')).toBeNull()
    expect(parseFriendMemoRef('bob/team/42')).toBeNull()
  })
})

describe('uniqueOwnMemoIds', () => {
  it('deduplicates local refs while ignoring friend refs', () => {
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
