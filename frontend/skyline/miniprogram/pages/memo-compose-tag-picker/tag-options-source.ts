import type { WorkspaceStore } from '../../store/workspace-store'
import { isTagNoneTreeNodePath } from '../../utils/tag-none'
import { compareTagPathPinyin } from '../../utils/tag-sort'
import { flattenTagTreeToStrings } from '../../utils/tag-tree'

function sortFlatTagPathsNoneLast(paths: string[]): string[] {
  const sorted = [...paths].sort(compareTagPathPinyin)
  const rest = sorted.filter((p) => !isTagNoneTreeNodePath(p))
  const noneRows = sorted.filter((p) => isTagNoneTreeNodePath(p))
  return [...rest, ...noneRows]
}

export async function loadTagOptionsFromWorkspace(store: WorkspaceStore): Promise<string[]> {
  await store.ensureTagTree()
  const nodes = store.getState().tagTree.data ?? []
  return sortFlatTagPathsNoneLast(flattenTagTreeToStrings(nodes))
}
