import { workspaceStore as defaultStore } from './workspace-store.instance'
import { createSelectorBinding } from './create-selector-binding'
import type { CacheEntryBase } from '../memo-cache-types'
import type { WorkspaceStore } from '../workspace-store'
import type { TagTreeMeta } from '../../models/tag'

export type TagTreeEntry = CacheEntryBase & { data: TagTreeMeta[] | null; untaggedCount: number }

export interface TagTreeBinding {
  selectEntry(): TagTreeEntry
  unsubscribe(): void
}

export function bindTagTree(
  onChange: (entry: TagTreeEntry) => void,
  store: WorkspaceStore = defaultStore,
): TagTreeBinding {
  const select = () => store.getState().tagTree
  const binding = createSelectorBinding(select, store.subscribe, onChange)
  return { selectEntry: binding.selectValue, unsubscribe: binding.unsubscribe }
}
