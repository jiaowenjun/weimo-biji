export type ViewerRole = 'self' | 'friend' | 'visitor' | 'denied'

export type QuoteMode = 'self' | 'friend' | 'none'

export type DoubleTapTarget = 'edit' | 'quote' | 'preview' | 'none'

export type MemoAction =
  | 'edit'
  | 'delete'
  | 'modifyTag'
  | 'removeTag'
  | 'addTag'
  | 'quote'
  | 'share'
  | 'copy'
  | 'memoDetail'

export interface MemoPermissions {
  readonly role: ViewerRole
  readonly canView: boolean
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly canModifyTag: boolean
  readonly canRemoveTag: boolean
  readonly canAddTag: boolean
  readonly canQuote: boolean
  readonly canShare: boolean
  readonly canCopy: boolean
  readonly canSeeDetailEntry: boolean
  readonly quoteMode: QuoteMode
  readonly menuActions: ReadonlySet<MemoAction>
  readonly doubleTapPreferred: DoubleTapTarget
}
