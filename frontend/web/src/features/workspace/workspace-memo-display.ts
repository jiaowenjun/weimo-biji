import { useCallback, useMemo, useReducer } from 'react'
import {
  applyDisplayOverrides,
  clearDisplayOverrideWhenSettled,
  createScopedDisplayOverridesReducer,
  getScopedDisplayOverrides,
  removeDisplayOverride,
  removeScopedDisplayOverride,
  setScopedDisplayOverride,
  trackScopedDisplayOverrideOperation,
  type DisplayOverrides,
  type ScopedDisplayOverrides,
  type ScopedDisplayOverridesAction,
} from '@weimo/workspace-core/display-overrides'

import type { CardDraft } from '@/components/note-card'

import type { Memo } from './workspace-types'

export type MemoDisplayOverrides = DisplayOverrides<CardDraft>
export type ScopedMemoDisplayOverrides = ScopedDisplayOverrides<CardDraft>
type MemoDisplayOverridesAction = ScopedDisplayOverridesAction<CardDraft>

export function getMemoDisplayOverridesForScope(
  overrides: ScopedMemoDisplayOverrides,
  scope: string,
) {
  return getScopedDisplayOverrides(overrides, scope)
}

export function setScopedMemoDisplayOverride(
  overrides: ScopedMemoDisplayOverrides,
  scope: string,
  id: number,
  draft: CardDraft,
): ScopedMemoDisplayOverrides {
  return setScopedDisplayOverride(overrides, scope, id, draft)
}

export function clearMemoDisplayOverrideWhenSettled<T>(
  operation: Promise<T>,
  clear: () => void,
): Promise<void> {
  return clearDisplayOverrideWhenSettled(operation, clear)
}

function sameDraft(left: CardDraft, right: CardDraft) {
  return (
    left.content === right.content &&
    left.tags.join('\u0000') === right.tags.join('\u0000')
  )
}

export function applyMemoDisplayOverrides(
  memos: Memo[],
  overrides: MemoDisplayOverrides,
): Memo[] {
  return applyDisplayOverrides(memos, overrides, (memo, override) => {
    return {
      ...memo,
      content: override.content,
      tags: [...override.tags],
    }
  })
}

export function removeMemoDisplayOverride(
  overrides: MemoDisplayOverrides,
  id: number,
  expected?: CardDraft,
): MemoDisplayOverrides {
  return removeDisplayOverride(overrides, id, sameDraft, expected)
}

export function removeScopedMemoDisplayOverride(
  overrides: ScopedMemoDisplayOverrides,
  scope: string,
  id: number,
  expected?: CardDraft,
): ScopedMemoDisplayOverrides {
  return removeScopedDisplayOverride(overrides, scope, id, sameDraft, expected)
}

const memoDisplayOverridesReducerCore = createScopedDisplayOverridesReducer(sameDraft)

export function memoDisplayOverridesReducer(
  overrides: ScopedMemoDisplayOverrides,
  action: MemoDisplayOverridesAction,
): ScopedMemoDisplayOverrides {
  return memoDisplayOverridesReducerCore(overrides, action)
}

export function trackMemoDisplayOverrideOperation<T>(
  dispatch: (action: MemoDisplayOverridesAction) => void,
  scope: string,
  id: number,
  draft: CardDraft,
  operation: () => Promise<T>,
) {
  return trackScopedDisplayOverrideOperation(
    dispatch,
    scope,
    id,
    draft,
    operation,
  )
}

export function useMemoDisplayOverrides(memos: Memo[], scope: string) {
  const [overrides, dispatch] = useReducer(memoDisplayOverridesReducer, {})
  const activeOverrides = getMemoDisplayOverridesForScope(overrides, scope)
  const displayedMemos = useMemo(
    () => applyMemoDisplayOverrides(memos, activeOverrides),
    [activeOverrides, memos],
  )
  const clear = useCallback(() => {
    dispatch({ type: 'clear' })
  }, [])
  const remove = useCallback((id: number) => {
    dispatch({ type: 'remove', scope, id })
  }, [scope])
  const track = useCallback(function track<T>(
    id: number,
    draft: CardDraft,
    operation: () => Promise<T>,
  ) {
    return trackMemoDisplayOverrideOperation(dispatch, scope, id, draft, operation)
  }, [scope])

  return { clear, displayedMemos, remove, track }
}
