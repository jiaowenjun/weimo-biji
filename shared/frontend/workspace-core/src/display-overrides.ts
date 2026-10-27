export type DisplayOverrides<Draft> = Record<number, Draft>
export type ScopedDisplayOverrides<Draft> = Record<string, DisplayOverrides<Draft>>

export type DisplayOverridesAction<Draft> =
  | { type: 'set'; id: number; draft: Draft }
  | { type: 'remove'; id: number; expected?: Draft }
  | { type: 'clear' }

export type ScopedDisplayOverridesAction<Draft> =
  | { type: 'set'; scope: string; id: number; draft: Draft }
  | { type: 'remove'; scope: string; id: number; expected?: Draft }
  | { type: 'clear' }

const EMPTY_DISPLAY_OVERRIDES = {}

export function applyDisplayOverrides<Item extends { id: number }, Draft>(
  items: Item[],
  overrides: DisplayOverrides<Draft>,
  applyDraft: (item: Item, draft: Draft) => Item,
): Item[] {
  if (Object.keys(overrides).length === 0) return items

  let changed = false
  const nextItems = items.map((item) => {
    if (!Object.hasOwn(overrides, item.id)) return item
    const override = overrides[item.id]

    changed = true
    return applyDraft(item, override)
  })

  return changed ? nextItems : items
}

export function removeDisplayOverride<Draft>(
  overrides: DisplayOverrides<Draft>,
  id: number,
  sameDraft: (left: Draft, right: Draft) => boolean,
  expected?: Draft,
): DisplayOverrides<Draft> {
  if (!Object.hasOwn(overrides, id)) return overrides
  const current = overrides[id]
  if (expected !== undefined && !sameDraft(current, expected)) return overrides

  const nextOverrides = { ...overrides }
  delete nextOverrides[id]

  return nextOverrides
}

export function createDisplayOverridesReducer<Draft>(
  sameDraft: (left: Draft, right: Draft) => boolean,
) {
  return (
    overrides: DisplayOverrides<Draft>,
    action: DisplayOverridesAction<Draft>,
  ): DisplayOverrides<Draft> => {
    if (action.type === 'clear') return {}
    if (action.type === 'remove') {
      return removeDisplayOverride(
        overrides,
        action.id,
        sameDraft,
        action.expected,
      )
    }

    return { ...overrides, [action.id]: action.draft }
  }
}

export function getScopedDisplayOverrides<Draft>(
  overrides: ScopedDisplayOverrides<Draft>,
  scope: string,
): DisplayOverrides<Draft> {
  return overrides[scope] ?? EMPTY_DISPLAY_OVERRIDES
}

export function setScopedDisplayOverride<Draft>(
  overrides: ScopedDisplayOverrides<Draft>,
  scope: string,
  id: number,
  draft: Draft,
): ScopedDisplayOverrides<Draft> {
  return {
    ...overrides,
    [scope]: {
      ...getScopedDisplayOverrides(overrides, scope),
      [id]: draft,
    },
  }
}

export function removeScopedDisplayOverride<Draft>(
  overrides: ScopedDisplayOverrides<Draft>,
  scope: string,
  id: number,
  sameDraft: (left: Draft, right: Draft) => boolean,
  expected?: Draft,
): ScopedDisplayOverrides<Draft> {
  const currentScope = getScopedDisplayOverrides(overrides, scope)
  const nextScope = removeDisplayOverride(currentScope, id, sameDraft, expected)
  if (nextScope === currentScope) return overrides

  const nextOverrides = { ...overrides }
  if (Object.keys(nextScope).length === 0) {
    delete nextOverrides[scope]
  } else {
    nextOverrides[scope] = nextScope
  }

  return nextOverrides
}

export function createScopedDisplayOverridesReducer<Draft>(
  sameDraft: (left: Draft, right: Draft) => boolean,
) {
  return (
    overrides: ScopedDisplayOverrides<Draft>,
    action: ScopedDisplayOverridesAction<Draft>,
  ): ScopedDisplayOverrides<Draft> => {
    if (action.type === 'clear') return {}
    if (action.type === 'remove') {
      return removeScopedDisplayOverride(
        overrides,
        action.scope,
        action.id,
        sameDraft,
        action.expected,
      )
    }

    return setScopedDisplayOverride(
      overrides,
      action.scope,
      action.id,
      action.draft,
    )
  }
}

export function clearDisplayOverrideWhenSettled<T>(
  operation: Promise<T>,
  clear: () => void,
) {
  return operation.then(clear, clear)
}

export function trackDisplayOverrideOperation<T, Draft>(
  dispatch: (action: DisplayOverridesAction<Draft>) => void,
  id: number,
  draft: Draft,
  operation: () => Promise<T>,
) {
  dispatch({ type: 'set', id, draft })

  return clearDisplayOverrideWhenSettled(Promise.resolve().then(operation), () => {
    dispatch({ type: 'remove', id, expected: draft })
  })
}

export function trackScopedDisplayOverrideOperation<T, Draft>(
  dispatch: (action: ScopedDisplayOverridesAction<Draft>) => void,
  scope: string,
  id: number,
  draft: Draft,
  operation: () => Promise<T>,
) {
  dispatch({ type: 'set', scope, id, draft })

  return clearDisplayOverrideWhenSettled(Promise.resolve().then(operation), () => {
    dispatch({ type: 'remove', scope, id, expected: draft })
  })
}
