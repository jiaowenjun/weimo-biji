export interface SelectorBinding<T> {
  selectValue(): T
  unsubscribe(): void
}

export function createSelectorBinding<T>(
  select: () => T,
  subscribe: (listener: () => void) => () => void,
  onChange: (selected: T) => void,
): SelectorBinding<T> {
  let lastSelected = select()
  onChange(lastSelected)

  const unsubscribe = subscribe(() => {
    const nextSelected = select()
    if (nextSelected === lastSelected) return
    lastSelected = nextSelected
    onChange(nextSelected)
  })

  return {
    selectValue: select,
    unsubscribe,
  }
}
