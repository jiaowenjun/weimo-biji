import { describe, expect, it, vi } from 'vitest'
import {
  createRelationTabState,
  reduceRelationTabExitComplete,
  reduceRelationTabOnCardsChange,
  reduceRelationTabOnSelect,
  RELATION_TAB_EXIT_TRANSITION_MS,
  resolveRelationTabDesired,
} from '../memo-reference-relation-tab'

const emptyCards = {
  referenceCards: [] as unknown[],
  referencedByCards: [] as unknown[],
}

describe('memo-reference-relation-tab util', () => {
  it('createRelationTabState returns hidden defaults', () => {
    expect(createRelationTabState()).toEqual({
      selectedRelationTab: 'reference',
      tabRenderState: 'hidden',
      tabSliderAnimated: false,
    })
  })

  describe('resolveRelationTabDesired', () => {
    it('requires both sides to show tab', () => {
      expect(resolveRelationTabDesired(emptyCards)).toBe('hide')
      expect(resolveRelationTabDesired({
        ...emptyCards,
        referenceCards: [{ id: 1 }],
      })).toBe('hide')
      expect(resolveRelationTabDesired({
        ...emptyCards,
        referencedByCards: [{ id: 1 }],
      })).toBe('hide')
      expect(resolveRelationTabDesired({
        ...emptyCards,
        referenceCards: [{ id: 1 }],
        referencedByCards: [{ id: 2 }],
      })).toBe('show')
    })
  })

  describe('reduceRelationTabOnSelect', () => {
    it('switches tab and enables slider animation', () => {
      expect(reduceRelationTabOnSelect('referencedBy')).toEqual({
        selectedRelationTab: 'referencedBy',
        tabSliderAnimated: true,
      })
    })

    it('ignores unknown tab', () => {
      expect(reduceRelationTabOnSelect('bogus')).toBeNull()
    })
  })

  describe('reduceRelationTabOnCardsChange — visible trigger', () => {
    it('mode != detail forces hidden', () => {
      const prev = createRelationTabState()
      const result = reduceRelationTabOnCardsChange(
        { ...prev, tabRenderState: 'visible' },
        { ...emptyCards, referenceCards: [{ id: 1 }], referencedByCards: [{ id: 2 }] },
        'references',
      )
      expect(result.patch).toEqual({ tabRenderState: 'hidden', tabSliderAnimated: false })
    })

    it('both sides populated enters visible from hidden', () => {
      const prev = createRelationTabState()
      const result = reduceRelationTabOnCardsChange(prev, {
        ...emptyCards,
        referenceCards: [{ id: 1 }],
        referencedByCards: [{ id: 2 }],
      }, 'detail')
      expect(result.patch).toEqual({ tabRenderState: 'visible' })
    })

    it('single side stays hidden', () => {
      const prev = createRelationTabState()
      const result = reduceRelationTabOnCardsChange(prev, {
        ...emptyCards,
        referenceCards: [{ id: 1 }],
      }, 'detail')
      expect(result.patch).toEqual({})
    })
  })

  describe('reduceRelationTabOnCardsChange — visible → exiting', () => {
    const visible = {
      ...createRelationTabState(),
      tabRenderState: 'visible' as const,
    }

    it('reference tab + reference side empty → auto referencedBy + exiting', () => {
      const result = reduceRelationTabOnCardsChange(visible, {
        ...emptyCards,
        referencedByCards: [{ id: 2 }],
      }, 'detail')
      expect(result.patch).toEqual({
        tabRenderState: 'exiting',
        selectedRelationTab: 'referencedBy',
        tabSliderAnimated: true,
      })
      expect(result.scheduleExit).toBe(true)
    })

    it('referencedBy tab + referencedBy side empty → auto reference + exiting', () => {
      const result = reduceRelationTabOnCardsChange({
        ...visible,
        selectedRelationTab: 'referencedBy',
      }, {
        ...emptyCards,
        referenceCards: [{ id: 1 }],
      }, 'detail')
      expect(result.patch).toEqual({
        tabRenderState: 'exiting',
        selectedRelationTab: 'reference',
        tabSliderAnimated: true,
      })
      expect(result.scheduleExit).toBe(true)
    })

    it('reference tab + referencedBy side empty → exiting without tab switch', () => {
      const result = reduceRelationTabOnCardsChange(visible, {
        ...emptyCards,
        referenceCards: [{ id: 1 }],
      }, 'detail')
      expect(result.patch).toEqual({ tabRenderState: 'exiting' })
      expect(result.scheduleExit).toBe(true)
    })
  })

  describe('reduceRelationTabOnCardsChange — exiting recovery', () => {
    it('exiting + both sides again → visible + cancelExit', () => {
      const result = reduceRelationTabOnCardsChange({
        ...createRelationTabState(),
        tabRenderState: 'exiting',
      }, {
        ...emptyCards,
        referenceCards: [{ id: 1 }],
        referencedByCards: [{ id: 2 }],
      }, 'detail')
      expect(result.patch).toEqual({ tabRenderState: 'visible' })
      expect(result.cancelExit).toBe(true)
    })
  })

  describe('reduceRelationTabExitComplete', () => {
    it('completes exit transition', () => {
      expect(reduceRelationTabExitComplete()).toEqual({
        tabRenderState: 'hidden',
        tabSliderAnimated: false,
      })
    })
  })

  it('RELATION_TAB_EXIT_TRANSITION_MS stays 260', () => {
    expect(RELATION_TAB_EXIT_TRANSITION_MS).toBe(260)
  })
})

describe('memo-reference-relation-tab exit timer semantics', () => {
  it('exiting completes after 260ms when scheduled manually', () => {
    vi.useFakeTimers()
    try {
      let state = {
        ...createRelationTabState(),
        tabRenderState: 'visible' as const,
        tabSliderAnimated: true,
      }
      const result = reduceRelationTabOnCardsChange(state, emptyCards, 'detail')
      state = { ...state, ...result.patch }

      expect(state.tabRenderState).toBe('exiting')

      const timer = setTimeout(() => {
        state = { ...state, ...reduceRelationTabExitComplete() }
      }, RELATION_TAB_EXIT_TRANSITION_MS)

      vi.advanceTimersByTime(259)
      expect(state.tabRenderState).toBe('exiting')

      vi.advanceTimersByTime(1)
      clearTimeout(timer)
      expect(state.tabRenderState).toBe('hidden')
      expect(state.tabSliderAnimated).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
