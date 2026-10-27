import { useCallback, useRef, useState } from 'react'

import {
  createPendingCreateState,
  pendingCreateReducer,
  type PendingCreateState,
} from './pending-create.ts'

type MaybePromise<Result> = PromiseLike<Result> | Result

export type PendingCreateSubmission<Draft extends object, Result> = {
  changes: Partial<Draft>
  getResultChanges?: (result: Result) => Partial<Draft>
  run: () => MaybePromise<Result>
}

export type UsePendingCreateOptions<Draft extends object, Input, Result> = {
  blocked?: boolean
  createClientId: () => string
  createDraft: () => Draft
  onError?: (error: unknown) => void
  onReadyToCommit?: (state: PendingCreateState<Draft>) => void
  prepareSubmission: (
    input: Input,
    state: PendingCreateState<Draft>,
  ) => PendingCreateSubmission<Draft, Result> | null
}

function isPromiseLike<Result>(value: MaybePromise<Result>): value is PromiseLike<Result> {
  return typeof value === 'object' && value !== null && 'then' in value
}

export function usePendingCreate<Draft extends object, Input, Result>({
  blocked = false,
  createClientId,
  createDraft,
  onError,
  onReadyToCommit,
  prepareSubmission,
}: UsePendingCreateOptions<Draft, Input, Result>) {
  const [pending, setPending] = useState<PendingCreateState<Draft> | null>(null)
  const committedClientIdRef = useRef<string | null>(null)
  const transitionEndedClientIdRef = useRef<string | null>(null)

  const start = useCallback(() => {
    if (blocked || pending) return

    committedClientIdRef.current = null
    transitionEndedClientIdRef.current = null
    setPending(createPendingCreateState(createClientId(), createDraft()))
  }, [blocked, createClientId, createDraft, pending])

  const cancel = useCallback(() => {
    committedClientIdRef.current = null
    transitionEndedClientIdRef.current = null
    setPending((current) => pendingCreateReducer(current, { type: 'cancel' }))
  }, [])

  const finishExitAnimation = useCallback(() => {
    committedClientIdRef.current = null
    transitionEndedClientIdRef.current = null
    setPending((current) =>
      pendingCreateReducer(current, { type: 'exit-animation-end' }),
    )
  }, [])

  const reset = useCallback(() => {
    committedClientIdRef.current = null
    transitionEndedClientIdRef.current = null
    setPending(null)
  }, [])

  const submit = useCallback((input: Input) => {
    if (!pending || pending.status === 'closing' || pending.status === 'creating') return

    const submission = prepareSubmission(input, pending)
    if (!submission) return

    const clientId = pending.clientId
    committedClientIdRef.current = null
    transitionEndedClientIdRef.current = null
    const succeed = (result: Result) => {
      const changes = submission.getResultChanges?.(result)

      if (
        transitionEndedClientIdRef.current === clientId &&
        committedClientIdRef.current !== clientId
      ) {
        committedClientIdRef.current = clientId
        onReadyToCommit?.({
          ...pending,
          ...submission.changes,
          ...changes,
          createSettled: true,
          status: 'creating',
          viewTransitionEnded: true,
        })
      }

      setPending((current) =>
        current?.clientId === clientId
          ? pendingCreateReducer(current, { type: 'succeed', changes })
          : current,
      )
    }
    const fail = (error: unknown) => {
      transitionEndedClientIdRef.current = null
      setPending((current) =>
        current?.clientId === clientId
          ? pendingCreateReducer(current, {
              type: 'fail',
              changes: submission.changes,
            })
          : current,
      )
      onError?.(error)
    }

    setPending((current) =>
      current?.clientId === clientId
        ? pendingCreateReducer(current, {
            type: 'submit',
            changes: submission.changes,
          })
        : current,
    )

    try {
      const result = submission.run()

      if (isPromiseLike(result)) {
        void Promise.resolve(result).then(succeed, fail)
      } else {
        succeed(result)
      }
    } catch (error) {
      fail(error)
    }
  }, [onError, onReadyToCommit, pending, prepareSubmission])

  const finishViewTransition = useCallback(() => {
    if (!pending || pending.status !== 'creating') return

    transitionEndedClientIdRef.current = pending.clientId
    if (pending.createSettled && committedClientIdRef.current !== pending.clientId) {
      committedClientIdRef.current = pending.clientId
      onReadyToCommit?.(pending)
    }
    setPending((current) =>
      current?.clientId === pending.clientId
        ? pendingCreateReducer(current, { type: 'view-transition-end' })
        : current,
    )
  }, [onReadyToCommit, pending])

  return {
    cancel,
    finishExitAnimation,
    finishViewTransition,
    isBlocked: blocked || Boolean(pending),
    pending,
    reset,
    start,
    submit,
  }
}
