export function computeEnteringCardIds(
  prevIds: Set<number>,
  nextCards: { id: number }[],
): number[] {
  if (prevIds.size === 0 || nextCards.length === 0) {
    return nextCards.map((c) => c.id)
  }
  const entering: number[] = []
  for (const card of nextCards) {
    if (!prevIds.has(card.id)) {
      entering.push(card.id)
    }
  }
  return entering
}

export function buildEnteringCardMap(
  enteringIds: number[],
): Record<string, true> | null {
  if (enteringIds.length === 0) return null
  const map: Record<string, true> = {}
  for (const id of enteringIds) {
    map[String(id)] = true
  }
  return map
}
