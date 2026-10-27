export type PendingCreateStatus = 'editing' | 'creating' | 'failed' | 'closing'

export type PendingCreateState<Draft extends object> = Draft & {
  clientId: string
  createSettled: boolean
  status: PendingCreateStatus
  viewTransitionEnded: boolean
}

export type PendingCreateAction<Draft extends object> =
  | { type: 'cancel' }
  | { type: 'exit-animation-end' }
  | { type: 'submit'; changes: Partial<Draft> }
  | { type: 'succeed'; changes?: Partial<Draft> }
  | { type: 'fail'; changes?: Partial<Draft> }
  | { type: 'view-transition-end' }

export function createPendingCreateState<Draft extends object>(
  clientId: string,
  draft: Draft,
): PendingCreateState<Draft> {
  return {
    ...draft,
    clientId,
    createSettled: false,
    status: 'editing',
    viewTransitionEnded: false,
  }
}

export function pendingCreateReducer<Draft extends object>(
  state: PendingCreateState<Draft> | null,
  action: PendingCreateAction<Draft>,
): PendingCreateState<Draft> | null {
  if (!state) return null

  if (action.type === 'cancel') {
    return { ...state, status: 'closing' }
  }
  if (action.type === 'exit-animation-end') {
    return null
  }
  if (action.type === 'submit') {
    return {
      ...state,
      ...action.changes,
      createSettled: false,
      status: 'creating',
      viewTransitionEnded: false,
    }
  }
  if (action.type === 'succeed') {
    if (state.status !== 'creating') return state
    if (state.viewTransitionEnded) return null

    return { ...state, ...action.changes, createSettled: true }
  }
  if (action.type === 'fail') {
    return {
      ...state,
      ...action.changes,
      createSettled: false,
      status: 'failed',
      viewTransitionEnded: false,
    }
  }
  if (state.status !== 'creating') return state
  if (state.createSettled) return null

  return { ...state, viewTransitionEnded: true }
}
