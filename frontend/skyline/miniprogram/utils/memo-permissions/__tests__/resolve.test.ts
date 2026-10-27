import { describe, expect, it } from 'vitest'
import { resolvePermissions } from '../resolve'
import type { MemoAction, ViewerRole } from '../types'

const MATRIX: Record<ViewerRole, {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canModifyTag: boolean
  canRemoveTag: boolean
  canAddTag: boolean
  canQuote: boolean
  canShare: boolean
  canCopy: boolean
  canSeeDetailEntry: boolean
  quoteMode: 'self' | 'friend' | 'none'
  menuActions: MemoAction[]
  doubleTapPreferred: 'edit' | 'quote' | 'preview' | 'none'
}> = {
  self: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canModifyTag: true,
    canRemoveTag: true,
    canAddTag: true,
    canQuote: true,
    canShare: true,
    canCopy: true,
    canSeeDetailEntry: true,
    quoteMode: 'self',
    menuActions: ['edit', 'quote', 'delete', 'share', 'copy', 'memoDetail'],
    doubleTapPreferred: 'edit',
  },
  friend: {
    canView: true,
    canEdit: false,
    canDelete: false,
    canModifyTag: false,
    canRemoveTag: false,
    canAddTag: false,
    canQuote: true,
    canShare: true,
    canCopy: true,
    canSeeDetailEntry: true,
    quoteMode: 'friend',
    menuActions: ['quote', 'share', 'copy', 'memoDetail'],
    doubleTapPreferred: 'quote',
  },
  visitor: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canModifyTag: true,
    canRemoveTag: true,
    canAddTag: true,
    canQuote: false,
    canShare: false,
    canCopy: false,
    canSeeDetailEntry: false,
    quoteMode: 'none',
    menuActions: ['edit', 'delete'],
    doubleTapPreferred: 'edit',
  },
  denied: {
    canView: false,
    canEdit: false,
    canDelete: false,
    canModifyTag: false,
    canRemoveTag: false,
    canAddTag: false,
    canQuote: false,
    canShare: false,
    canCopy: false,
    canSeeDetailEntry: false,
    quoteMode: 'none',
    menuActions: [],
    doubleTapPreferred: 'none',
  },
}

describe('resolvePermissions', () => {
  Object.entries(MATRIX).forEach(([role, expected]) => {
    it(`resolves ${role} permissions from the matrix`, () => {
      const permissions = resolvePermissions(role as ViewerRole)

      expect(permissions.role).toBe(role)
      expect(permissions.canView).toBe(expected.canView)
      expect(permissions.canEdit).toBe(expected.canEdit)
      expect(permissions.canDelete).toBe(expected.canDelete)
      expect(permissions.canModifyTag).toBe(expected.canModifyTag)
      expect(permissions.canRemoveTag).toBe(expected.canRemoveTag)
      expect(permissions.canAddTag).toBe(expected.canAddTag)
      expect(permissions.canQuote).toBe(expected.canQuote)
      expect(permissions.canShare).toBe(expected.canShare)
      expect(permissions.canCopy).toBe(expected.canCopy)
      expect(permissions.canSeeDetailEntry).toBe(expected.canSeeDetailEntry)
      expect(permissions.quoteMode).toBe(expected.quoteMode)
      expect(Array.from(permissions.menuActions)).toEqual(expected.menuActions)
      expect(permissions.doubleTapPreferred).toBe(expected.doubleTapPreferred)
    })
  })

  it('returns the same frozen object for the same role', () => {
    const first = resolvePermissions('self')
    const second = resolvePermissions('self')

    expect(second).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('returns denied permissions for an unknown runtime role', () => {
    const denied = resolvePermissions('public' as ViewerRole)

    expect(denied).toBe(resolvePermissions('denied'))
    expect(denied.canView).toBe(false)
    expect(denied.canCopy).toBe(false)
    expect(Array.from(denied.menuActions)).toEqual([])
  })
})
