import { useWorkspaceTagActions as useWorkspaceTagActionController } from '@weimo/workspace-core/use-workspace-tag-actions'

import { isSidebarActionableTag } from './sidebar-data'
import {
  useDeleteTagMutation,
  useRenameTagMutation,
} from './workspace-queries'

type UseWorkspaceTagActionsOptions = {
  selectedTag: string
  selectTag: (tag: string) => void
  showAllNotes: () => void
}

export function useWorkspaceTagActions({
  selectedTag,
  selectTag,
  showAllNotes,
}: UseWorkspaceTagActionsOptions) {
  const deleteTagMutation = useDeleteTagMutation()
  const renameTagMutation = useRenameTagMutation()

  return useWorkspaceTagActionController({
    canManageTag: isSidebarActionableTag,
    confirmDelete: (tag) => window.confirm(
      `确定删除标签「${tag}」吗？该标签将从所有笔记中移除。`,
    ),
    deleteTag: (tag) => deleteTagMutation.mutateAsync({ tag }),
    mode: 'authenticated',
    onError: (action, error) => {
      const fallback = action === 'rename' ? '重命名标签失败' : '删除标签失败'
      window.alert(error instanceof Error ? error.message : fallback)
    },
    renameTag: (oldTag, newTag) =>
      renameTagMutation.mutateAsync({ oldTag, newTag }),
    selectedTag,
    selectTag,
    showAllItems: showAllNotes,
  })
}
