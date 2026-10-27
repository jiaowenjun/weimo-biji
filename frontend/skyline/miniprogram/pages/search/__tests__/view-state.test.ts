import { describe, expect, it } from 'vitest'
import {
  deriveSearchPageViewState,
  shouldHoldSearchRenderTransition,
} from '../view-state'

describe('deriveSearchPageViewState', () => {
  it('disables apply when the current draft matches the opener draft', () => {
    const state = deriveSearchPageViewState(
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
    )

    expect(state).toEqual({
      dateLabel: '',
      hasActiveQuery: false,
      canApply: false,
      shouldSearch: false,
    })
  })

  it('enables apply when clearing an initially active query back to empty', () => {
    const state = deriveSearchPageViewState(
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
      { keyword: 'milk', selectedTag: '', dateMode: 'day', dateValue: '' },
    )

    expect(state.canApply).toBe(true)
    expect(state.hasActiveQuery).toBe(false)
    expect(state.shouldSearch).toBe(false)
  })

  it('derives date label and apply state from the normalized draft', () => {
    const state = deriveSearchPageViewState(
      { keyword: '  abc  ', selectedTag: 'x/y', dateMode: 'day', dateValue: '2026-04-25' },
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
    )

    expect(state.hasActiveQuery).toBe(true)
    expect(state.canApply).toBe(true)
    expect(state.shouldSearch).toBe(true)
    expect(state.dateLabel).toContain('2026')
  })

  it('does not search when keyword is empty even if tag or date filters exist', () => {
    const state = deriveSearchPageViewState(
      { keyword: '   ', selectedTag: '工作/项目', dateMode: 'day', dateValue: '2026-04-25' },
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
    )

    expect(state.hasActiveQuery).toBe(true)
    expect(state.shouldSearch).toBe(false)
  })
})

describe('shouldHoldSearchRenderTransition', () => {
  it('holds the settled search view when both current and next drafts should search', () => {
    expect(
      shouldHoldSearchRenderTransition({
        currentDraft: {
          keyword: '不存在关键词',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        nextDraft: {
          keyword: '不存在关键词条',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        memoListInitialized: true,
      }),
    ).toBe(true)
  })

  it('does not hold when the next draft clears keyword', () => {
    expect(
      shouldHoldSearchRenderTransition({
        currentDraft: {
          keyword: 'milk',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        nextDraft: {
          keyword: '',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        memoListInitialized: true,
      }),
    ).toBe(false)
  })

  it('does not hold when transitioning from keyword-empty filters to keyword search', () => {
    expect(
      shouldHoldSearchRenderTransition({
        currentDraft: {
          keyword: '',
          selectedTag: '工作/项目',
          dateMode: 'day',
          dateValue: '',
        },
        nextDraft: {
          keyword: 'milk',
          selectedTag: '工作/项目',
          dateMode: 'day',
          dateValue: '',
        },
        memoListInitialized: true,
      }),
    ).toBe(false)
  })

  it('does not hold before the memo list has initialized', () => {
    expect(
      shouldHoldSearchRenderTransition({
        currentDraft: {
          keyword: 'milk',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        nextDraft: {
          keyword: 'milk tea',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        memoListInitialized: false,
      }),
    ).toBe(false)
  })
})
