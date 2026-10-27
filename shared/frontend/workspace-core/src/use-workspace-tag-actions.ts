import { useCallback, useLayoutEffect, useReducer, useRef } from 'react'

import {
  renameGuestWorkspaceTag,
  type GuestWorkspaceTaggedItem,
  type GuestWorkspaceTagTree,
} from './guest-workspace.ts'
import {
  INITIAL_TAG_UI_STATE,
  remapSelectedTagPath,
  removeDeletedTagSelection,
  workspaceTagUiReducer,
} from './tag-state.ts'

export type WorkspaceTagApplyPayload = {
  draft: string
  selectedTags: string[]
}

type WorkspaceTagActionBase = {
  selectTag: (tag: string) => void
  selectedTag: string
}

type AuthenticatedWorkspaceTagActions = {
  canManageTag: (tag: string) => boolean
  confirmDelete: (tag: string) => boolean
  deleteTag: (tag: string) => Promise<unknown>
  mode: 'authenticated'
  onError: (action: 'delete' | 'rename', error: unknown) => void
  renameTag: (oldTag: string, newTag: string) => Promise<unknown>
  showAllItems: () => void
}

type GuestWorkspaceTagActions<Item extends GuestWorkspaceTaggedItem> = {
  items: Item[]
  mode: 'guest'
  setItems: (items: Item[]) => void
  setTagTree: (tagTree: GuestWorkspaceTagTree) => void
  tagTree: GuestWorkspaceTagTree
}

export function useWorkspaceTagActions<
  Item extends GuestWorkspaceTaggedItem = GuestWorkspaceTaggedItem,
>(
  options: WorkspaceTagActionBase & (
    AuthenticatedWorkspaceTagActions | GuestWorkspaceTagActions<Item>
  ),
) {
  const [state, dispatch] = useReducer(workspaceTagUiReducer, INITIAL_TAG_UI_STATE)
  const optionsRef = useRef(options)

  useLayoutEffect(() => {
    optionsRef.current = options
  }, [options])

  const setExpandedTags = useCallback((tags: string[]) => {
    dispatch({ type: 'set-expanded', tags })
  }, [])

  const handleRenameTag = useCallback((tag: string) => {
    const nextTag = tag.trim()
    if (!nextTag) return

    dispatch({ type: 'start-renaming', tag: nextTag })
  }, [])

  const handleRenameTagOpenChange = useCallback((open: boolean) => {
    if (!open) dispatch({ type: 'stop-renaming' })
  }, [])

  const handleRenameTagApply = useCallback((payload: WorkspaceTagApplyPayload) => {
    const currentTag = state.renamingTag?.trim()
    const nextTag = payload.selectedTags[0]?.trim() ?? payload.draft.trim()
    if (!currentTag || !nextTag || nextTag === currentTag) return

    const currentOptions = optionsRef.current
    if (currentOptions.mode === 'guest') {
      const result = renameGuestWorkspaceTag({
        expandedTags: state.expandedTags,
        items: currentOptions.items,
        newTag: nextTag,
        oldTag: currentTag,
        selectedTag: currentOptions.selectedTag,
        tagTree: currentOptions.tagTree,
      })
      if (!result) return

      currentOptions.setItems(result.items)
      currentOptions.setTagTree(result.tagTree)
      dispatch({ type: 'set-expanded', tags: result.expandedTags })
      dispatch({ type: 'stop-renaming' })
      if (result.selectedTag !== currentOptions.selectedTag) {
        currentOptions.selectTag(result.selectedTag)
      }
      return
    }

    const revision = state.renameRevision
    void Promise.resolve()
      .then(() => currentOptions.renameTag(currentTag, nextTag))
      .then(
        () => {
          dispatch({
            type: 'rename-succeeded',
            oldTag: currentTag,
            newTag: nextTag,
            revision,
          })
          const latestOptions = optionsRef.current
          const latestSelectedTag = latestOptions.selectedTag
          const nextSelectedTag = remapSelectedTagPath(
            latestSelectedTag,
            currentTag,
            nextTag,
          )

          if (nextSelectedTag && nextSelectedTag !== latestSelectedTag) {
            latestOptions.selectTag(nextSelectedTag)
          }
        },
        (error: unknown) => currentOptions.onError('rename', error),
      )
  }, [state.expandedTags, state.renameRevision, state.renamingTag])

  const handleDeleteTag = useCallback((tag: string) => {
    const currentOptions = optionsRef.current
    if (currentOptions.mode !== 'authenticated') return

    const nextTag = tag.trim()
    if (!currentOptions.canManageTag(nextTag) || !currentOptions.confirmDelete(nextTag)) {
      return
    }

    void Promise.resolve()
      .then(() => currentOptions.deleteTag(nextTag))
      .then(
        () => {
          dispatch({ type: 'delete-succeeded', tag: nextTag })
          const latestOptions = optionsRef.current
          if (latestOptions.mode !== 'authenticated') return

          const latestSelectedTag = latestOptions.selectedTag
          const nextSelectedTag = removeDeletedTagSelection(latestSelectedTag, nextTag)

          if (latestSelectedTag && !nextSelectedTag) latestOptions.showAllItems()
        },
        (error: unknown) => currentOptions.onError('delete', error),
      )
  }, [])

  return {
    expandedTags: state.expandedTags,
    handleDeleteTag,
    handleRenameTag,
    handleRenameTagApply,
    handleRenameTagOpenChange,
    renamingTag: state.renamingTag,
    setExpandedTags,
  }
}
