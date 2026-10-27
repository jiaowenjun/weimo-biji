export function remapSelectedTagPath(
  selectedTag: string,
  oldTag: string,
  newTag: string,
) {
  const current = selectedTag.trim()
  const from = oldTag.trim()
  const to = newTag.trim()

  if (!current || !from || !to) return current
  if (current === from) return to

  const prefix = `${from}/`
  if (current.startsWith(prefix)) {
    return `${to}${current.slice(from.length)}`
  }

  return current
}

function isTagPathWithin(tag: string, rootTag: string) {
  const current = tag.trim()
  const root = rootTag.trim()

  return Boolean(current && root) && (
    current === root || current.startsWith(`${root}/`)
  )
}

export function removeDeletedTagSelection(selectedTag: string, deletedTag: string) {
  const current = selectedTag.trim()

  return isTagPathWithin(current, deletedTag) ? '' : current
}

export function remapExpandedTagPaths(
  expandedTags: string[],
  oldTag: string,
  newTag: string,
) {
  return Array.from(
    new Set(expandedTags.map((tag) => remapSelectedTagPath(tag, oldTag, newTag))),
  )
}

export function removeDeletedExpandedTagPaths(
  expandedTags: string[],
  deletedTag: string,
) {
  return expandedTags.filter((tag) => !isTagPathWithin(tag, deletedTag))
}

export type WorkspaceTagUiState = {
  expandedTags: string[]
  renameRevision: number
  renamingTag: string | null
}

export type WorkspaceTagUiAction =
  | { type: 'set-expanded'; tags: string[] }
  | { type: 'start-renaming'; tag: string }
  | { type: 'stop-renaming' }
  | { type: 'rename-succeeded'; oldTag: string; newTag: string; revision: number }
  | { type: 'delete-succeeded'; tag: string }

export const INITIAL_TAG_UI_STATE: WorkspaceTagUiState = {
  expandedTags: [],
  renameRevision: 0,
  renamingTag: null,
}

export function workspaceTagUiReducer(
  state: WorkspaceTagUiState,
  action: WorkspaceTagUiAction,
): WorkspaceTagUiState {
  if (action.type === 'set-expanded') {
    return { ...state, expandedTags: action.tags }
  }
  if (action.type === 'start-renaming') {
    return {
      ...state,
      renameRevision: state.renameRevision + 1,
      renamingTag: action.tag,
    }
  }
  if (action.type === 'stop-renaming') {
    return {
      ...state,
      renameRevision: state.renameRevision + 1,
      renamingTag: null,
    }
  }
  if (action.type === 'rename-succeeded') {
    return {
      expandedTags: remapExpandedTagPaths(
        state.expandedTags,
        action.oldTag,
        action.newTag,
      ),
      renameRevision: state.renameRevision,
      renamingTag: action.revision === state.renameRevision
        ? null
        : state.renamingTag,
    }
  }

  return {
    expandedTags: removeDeletedExpandedTagPaths(state.expandedTags, action.tag),
    renameRevision: state.renameRevision,
    renamingTag: removeDeletedTagSelection(state.renamingTag ?? '', action.tag) || null,
  }
}
