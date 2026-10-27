import type { MemoAction, MemoPermissions, ViewerRole } from './types'

function makePermissions(
  role: ViewerRole,
  options: Omit<MemoPermissions, 'role' | 'menuActions'> & {
    menuActions: readonly MemoAction[]
  },
): MemoPermissions {
  return Object.freeze({
    ...options,
    role,
    menuActions: new Set(options.menuActions),
  })
}

const SELF = makePermissions('self', {
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
})

const VISITOR = makePermissions('visitor', {
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
})

const DENIED = makePermissions('denied', {
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
})

export function resolvePermissions(role: ViewerRole): MemoPermissions {
  switch (role) {
    case 'self':
      return SELF
    case 'visitor':
      return VISITOR
    case 'denied':
    default:
      return DENIED
  }
}
