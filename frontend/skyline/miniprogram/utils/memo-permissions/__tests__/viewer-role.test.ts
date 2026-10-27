import { describe, expect, it } from 'vitest'
import { resolveViewerRole } from '../viewer-role'

describe('resolveViewerRole', () => {
  it('returns denied when ownerUsername is empty', () => {
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: '',
    })).toBe('denied')
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: '   ',
    })).toBe('denied')
  })

  it('returns denied when sessionUsername is missing', () => {
    expect(resolveViewerRole({
      sessionUsername: undefined,
      ownerUsername: 'alice',
    })).toBe('denied')
  })

  it('returns self when session username equals ownerUsername', () => {
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: 'alice',
    })).toBe('self')
  })

  it('returns denied when owner does not match session', () => {
    expect(resolveViewerRole({
      sessionUsername: 'bob',
      ownerUsername: 'alice',
    })).toBe('denied')
  })
})
