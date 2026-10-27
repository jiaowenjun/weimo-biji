import { describe, expect, it } from 'vitest'
import { resolveViewerRole } from '../viewer-role'

describe('resolveViewerRole', () => {
  it('returns denied when ownerUsername is empty', () => {
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: '',
      friendUsername: 'alice',
    })).toBe('denied')
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: '   ',
      friendUsername: 'alice',
    })).toBe('denied')
  })

  it('returns denied when sessionUsername is missing', () => {
    expect(resolveViewerRole({
      sessionUsername: undefined,
      ownerUsername: 'alice',
      friendUsername: 'alice',
    })).toBe('denied')
  })

  it('returns self when session username equals ownerUsername', () => {
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: 'alice',
      friendUsername: undefined,
    })).toBe('self')
  })

  it('prefers self when session and friend both equal ownerUsername', () => {
    expect(resolveViewerRole({
      sessionUsername: 'alice',
      ownerUsername: 'alice',
      friendUsername: 'alice',
    })).toBe('self')
  })

  it('returns friend when friend username equals ownerUsername and session does not', () => {
    expect(resolveViewerRole({
      sessionUsername: 'bob',
      ownerUsername: 'alice',
      friendUsername: 'alice',
    })).toBe('friend')
  })

  it('returns denied when owner matches neither session nor friend', () => {
    expect(resolveViewerRole({
      sessionUsername: 'bob',
      ownerUsername: 'alice',
      friendUsername: undefined,
    })).toBe('denied')
    expect(resolveViewerRole({
      sessionUsername: 'bob',
      ownerUsername: 'alice',
      friendUsername: 'carol',
    })).toBe('denied')
  })
})
