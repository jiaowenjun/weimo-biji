import type { Dispatch, SetStateAction } from 'react'
import { useWorkspaceTagActions } from '@weimo/workspace-core/use-workspace-tag-actions'

import type { Memo, TagTreeMeta } from './workspace-types'

type UseGuestWorkspaceTagActionsOptions = {
  memos: Memo[]
  selectTag: (tag: string) => void
  selectedTag: string
  setMemos: Dispatch<SetStateAction<Memo[]>>
  setTagTreeMeta: Dispatch<SetStateAction<TagTreeMeta>>
  tagTreeMeta: TagTreeMeta
}

export function useGuestWorkspaceTagActions({
  memos,
  selectTag,
  selectedTag,
  setMemos,
  setTagTreeMeta,
  tagTreeMeta,
}: UseGuestWorkspaceTagActionsOptions) {
  return useWorkspaceTagActions({
    items: memos,
    mode: 'guest',
    selectedTag,
    selectTag,
    setItems: setMemos,
    setTagTree: setTagTreeMeta,
    tagTree: tagTreeMeta,
  })
}
