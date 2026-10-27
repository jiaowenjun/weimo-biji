import { create } from 'zustand'

import { UNTAGGED_TAG } from './sidebar-data.ts'
import type { MemoSearchQuery } from './workspace-types'

type MemoCreatedAtSort = NonNullable<MemoSearchQuery['created_at_sort']>

export type WorkspaceNavigationFacet =
  | 'none'
  | 'annotation'
  | 'markdown-quote'
  | 'heading'
  | 'unordered-list'

export type WorkspaceNavigationSelection = 'all' | 'today' | 'date' | 'tag' | 'facet'

type WorkspaceNavigationState = {
  activeDate: string
  filters: MemoSearchQuery
  memoCreatedAtSort: MemoCreatedAtSort
  selectedFacet: WorkspaceNavigationFacet
  selectedNav: WorkspaceNavigationSelection
  selectedTag: string
  clearDateFilter: () => void
  clearFacetFilter: () => void
  selectDate: (date: string) => void
  selectFacet: (facet: string) => void
  selectTag: (tag: string) => void
  setMemoCreatedAtSort: (sort: string) => void
  showAllNotes: () => void
  showTodayReview: (date?: Date) => void
}

const initialNavigationState = {
  activeDate: '',
  filters: {},
  memoCreatedAtSort: 'desc' as const,
  selectedFacet: 'none' as const,
  selectedNav: 'all' as const,
  selectedTag: '',
}

export function formatLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function buildDayMemoFilter(dateValue: string) {
  const match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return {
    created_at: {
      kind: 'day' as const,
      year,
      month,
      day,
    },
  }
}

function buildTagMemoFilter(tag: string): MemoSearchQuery {
  if (tag === UNTAGGED_TAG) {
    return { has_no_tag: true }
  }

  return { tag }
}

function normalizeFacet(facet: string): WorkspaceNavigationFacet {
  if (
    facet === 'annotation' ||
    facet === 'markdown-quote' ||
    facet === 'heading' ||
    facet === 'unordered-list'
  ) {
    return facet
  }

  return 'none'
}

function buildFacetMemoFilter(facet: WorkspaceNavigationFacet): MemoSearchQuery | undefined {
  switch (facet) {
    case 'annotation':
      return { has_annotation: true }
    case 'markdown-quote':
      return { has_markdown_quote: true }
    case 'heading':
      return { has_heading: true }
    case 'unordered-list':
      return { has_unordered_list: true }
    default:
      return undefined
  }
}

function buildSortMemoFilter(sort: MemoCreatedAtSort): MemoSearchQuery | undefined {
  if (sort === 'asc') {
    return { created_at_sort: 'asc' }
  }

  return undefined
}

function combineFilters(
  options: {
    date?: MemoSearchQuery
    facet?: MemoSearchQuery
    sort?: MemoSearchQuery
    tag?: MemoSearchQuery
  },
): MemoSearchQuery {
  return {
    ...options.date,
    ...options.sort,
    ...options.tag,
    ...options.facet,
  }
}

function buildNavigationFilters({
  activeDate,
  memoCreatedAtSort,
  selectedFacet,
  selectedTag,
}: {
  activeDate: string
  memoCreatedAtSort: MemoCreatedAtSort
  selectedFacet: WorkspaceNavigationFacet
  selectedTag: string
}): MemoSearchQuery {
  return combineFilters({
    date: activeDate ? buildDayMemoFilter(activeDate) ?? undefined : undefined,
    sort: buildSortMemoFilter(memoCreatedAtSort),
    tag: selectedTag ? buildTagMemoFilter(selectedTag) : undefined,
    facet: buildFacetMemoFilter(selectedFacet),
  })
}

function resolveSelectedNav({
  activeDate,
  selectedFacet,
  selectedTag,
}: {
  activeDate: string
  selectedFacet: WorkspaceNavigationFacet
  selectedTag: string
}): WorkspaceNavigationSelection {
  if (selectedFacet !== 'none') return 'facet'
  if (activeDate) return 'date'
  if (selectedTag) return 'tag'

  return 'all'
}

export const useWorkspaceNavigationStore = create<WorkspaceNavigationState>(
  (set) => ({
    ...initialNavigationState,
    clearDateFilter() {
      set((state) => {
        const activeDate = ''

        return {
          activeDate,
          filters: combineFilters({
            sort: buildSortMemoFilter(state.memoCreatedAtSort),
            tag: state.selectedTag
              ? buildTagMemoFilter(state.selectedTag)
              : undefined,
            facet: buildFacetMemoFilter(state.selectedFacet),
          }),
          selectedNav: resolveSelectedNav({
            activeDate,
            selectedFacet: state.selectedFacet,
            selectedTag: state.selectedTag,
          }),
        }
      })
    },
    clearFacetFilter() {
      set((state) => {
        const selectedFacet = 'none' as const

        return {
          filters: combineFilters({
            date: state.activeDate
              ? buildDayMemoFilter(state.activeDate) ?? undefined
              : undefined,
            sort: buildSortMemoFilter(state.memoCreatedAtSort),
            tag: state.selectedTag
              ? buildTagMemoFilter(state.selectedTag)
              : undefined,
          }),
          selectedFacet,
          selectedNav: resolveSelectedNav({
            activeDate: state.activeDate,
            selectedFacet,
            selectedTag: state.selectedTag,
          }),
        }
      })
    },
    selectDate(dateValue) {
      const filters = buildDayMemoFilter(dateValue)
      if (!filters) return

      set((state) => ({
        activeDate: dateValue,
        filters: combineFilters({
          date: filters,
          sort: buildSortMemoFilter(state.memoCreatedAtSort),
          tag: state.selectedTag
            ? buildTagMemoFilter(state.selectedTag)
            : undefined,
          facet: buildFacetMemoFilter(state.selectedFacet),
        }),
        selectedNav: 'date',
      }))
    },
    selectFacet(facet) {
      const normalizedFacet = normalizeFacet(facet)
      if (normalizedFacet === 'none') return

      set((state) => ({
        filters: combineFilters({
          date: state.activeDate
            ? buildDayMemoFilter(state.activeDate) ?? undefined
            : undefined,
          sort: buildSortMemoFilter(state.memoCreatedAtSort),
          tag: state.selectedTag
            ? buildTagMemoFilter(state.selectedTag)
            : undefined,
          facet: buildFacetMemoFilter(normalizedFacet),
        }),
        selectedFacet: normalizedFacet,
        selectedNav: 'facet',
      }))
    },
    selectTag(tag) {
      const normalizedTag = tag.trim()
      if (!normalizedTag) return

      set((state) => ({
        filters: combineFilters({
          date: state.activeDate
            ? buildDayMemoFilter(state.activeDate) ?? undefined
            : undefined,
          sort: buildSortMemoFilter(state.memoCreatedAtSort),
          tag: buildTagMemoFilter(normalizedTag),
          facet: buildFacetMemoFilter(state.selectedFacet),
        }),
        selectedNav: 'tag',
        selectedTag: normalizedTag,
      }))
    },
    setMemoCreatedAtSort(sort) {
      if (sort !== 'asc' && sort !== 'desc') return

      set((state) => ({
        filters: buildNavigationFilters({
          activeDate: state.activeDate,
          memoCreatedAtSort: sort,
          selectedFacet: state.selectedFacet,
          selectedTag: state.selectedTag,
        }),
        memoCreatedAtSort: sort,
      }))
    },
    showAllNotes() {
      set((state) => {
        const activeDate = ''
        const selectedFacet = 'none' as const
        const selectedTag = ''

        return {
          activeDate,
          filters: buildNavigationFilters({
            activeDate,
            memoCreatedAtSort: state.memoCreatedAtSort,
            selectedFacet,
            selectedTag,
          }),
          selectedFacet,
          selectedNav: 'all' as const,
          selectedTag,
        }
      })
    },
    showTodayReview(date = new Date()) {
      const dateValue = formatLocalDateInputValue(date)
      const filters = buildDayMemoFilter(dateValue)
      if (!filters) return

      set((state) => ({
        activeDate: dateValue,
        filters: combineFilters({
          date: filters,
          sort: buildSortMemoFilter(state.memoCreatedAtSort),
        }),
        selectedFacet: 'none',
        selectedNav: 'today',
        selectedTag: '',
      }))
    },
  }),
)

export function getWorkspaceNavigationFilters() {
  return useWorkspaceNavigationStore.getState().filters
}

export function resetWorkspaceNavigation() {
  useWorkspaceNavigationStore.setState(initialNavigationState)
}
