import { useMemo } from 'react'

import { useWorkspaceNavigationStore } from './workspace-navigation-store'

export function useWorkspacePageNavigation() {
  const filters = useWorkspaceNavigationStore((state) => state.filters)
  const activeDate = useWorkspaceNavigationStore((state) => state.activeDate)
  const selectedFacet = useWorkspaceNavigationStore((state) => state.selectedFacet)
  const selectedTag = useWorkspaceNavigationStore((state) => state.selectedTag)
  const memoCreatedAtSort = useWorkspaceNavigationStore(
    (state) => state.memoCreatedAtSort,
  )
  const clearDateFilter = useWorkspaceNavigationStore((state) => state.clearDateFilter)
  const clearFacetFilter = useWorkspaceNavigationStore((state) => state.clearFacetFilter)
  const selectDate = useWorkspaceNavigationStore((state) => state.selectDate)
  const selectFacet = useWorkspaceNavigationStore((state) => state.selectFacet)
  const selectTag = useWorkspaceNavigationStore((state) => state.selectTag)
  const setMemoCreatedAtSort = useWorkspaceNavigationStore(
    (state) => state.setMemoCreatedAtSort,
  )
  const showAllNotes = useWorkspaceNavigationStore((state) => state.showAllNotes)
  const showTodayReview = useWorkspaceNavigationStore(
    (state) => state.showTodayReview,
  )

  const navigation = useMemo(
    () => ({
      activeDate,
      clearDateFilter,
      clearFacetFilter,
      memoCreatedAtSort,
      selectDate,
      selectFacet,
      selectTag,
      setMemoCreatedAtSort,
      selectedFacet,
      selectedTag,
      showAllNotes,
      showTodayReview,
    }),
    [
      activeDate,
      clearDateFilter,
      clearFacetFilter,
      memoCreatedAtSort,
      selectDate,
      selectFacet,
      selectTag,
      setMemoCreatedAtSort,
      selectedFacet,
      selectedTag,
      showAllNotes,
      showTodayReview,
    ],
  )

  return { filters, navigation }
}
