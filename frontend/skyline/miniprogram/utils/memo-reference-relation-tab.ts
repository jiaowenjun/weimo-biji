export type RelationTabKey = 'reference' | 'referencedBy'
export type RelationTabRenderState = 'hidden' | 'visible' | 'exiting'

export interface RelationTabState {
  selectedRelationTab: RelationTabKey
  tabRenderState: RelationTabRenderState
  tabSliderAnimated: boolean
}

export interface RelationTabCards {
  ownReferenceCards: readonly unknown[]
  friendReferenceCards: readonly unknown[]
  ownReferencedByCards: readonly unknown[]
  friendReferencedByCards: readonly unknown[]
}

export const RELATION_TAB_EXIT_TRANSITION_MS = 260

export function createRelationTabState(): RelationTabState {
  return {
    selectedRelationTab: 'reference',
    tabRenderState: 'hidden',
    tabSliderAnimated: false,
  }
}

export function resolveRelationTabDesired(cards: RelationTabCards): 'show' | 'hide' {
  const hasRef = cards.ownReferenceCards.length + cards.friendReferenceCards.length > 0
  const hasRby = cards.ownReferencedByCards.length + cards.friendReferencedByCards.length > 0
  return hasRef && hasRby ? 'show' : 'hide'
}

export interface RelationTabCardsChangeResult {
  patch: Partial<RelationTabState>
  scheduleExit?: boolean
  cancelExit?: boolean
}

export function reduceRelationTabOnCardsChange(
  prev: RelationTabState,
  cards: RelationTabCards,
  mode: string,
): RelationTabCardsChangeResult {
  if (mode !== 'detail') {
    if (prev.tabRenderState !== 'hidden' || prev.tabSliderAnimated) {
      return { patch: { tabRenderState: 'hidden', tabSliderAnimated: false } }
    }
    return { patch: {} }
  }

  const hasRef = cards.ownReferenceCards.length + cards.friendReferenceCards.length > 0
  const hasRby = cards.ownReferencedByCards.length + cards.friendReferencedByCards.length > 0
  const desired = hasRef && hasRby ? 'show' : 'hide'

  if (desired === 'show' && prev.tabRenderState === 'hidden') {
    return { patch: { tabRenderState: 'visible' } }
  }

  if (desired === 'show' && prev.tabRenderState === 'exiting') {
    return { patch: { tabRenderState: 'visible' }, cancelExit: true }
  }

  if (desired === 'hide' && prev.tabRenderState === 'visible') {
    const patch: Partial<RelationTabState> = { tabRenderState: 'exiting' }
    if (prev.selectedRelationTab === 'reference' && !hasRef && hasRby) {
      patch.selectedRelationTab = 'referencedBy'
      patch.tabSliderAnimated = true
    } else if (prev.selectedRelationTab === 'referencedBy' && !hasRby && hasRef) {
      patch.selectedRelationTab = 'reference'
      patch.tabSliderAnimated = true
    }
    return { patch, scheduleExit: true }
  }

  return { patch: {} }
}

export function reduceRelationTabOnSelect(tab: string): Partial<RelationTabState> | null {
  if (tab !== 'reference' && tab !== 'referencedBy') return null
  return { selectedRelationTab: tab, tabSliderAnimated: true }
}

export function reduceRelationTabExitComplete(): Partial<RelationTabState> {
  return { tabRenderState: 'hidden', tabSliderAnimated: false }
}
