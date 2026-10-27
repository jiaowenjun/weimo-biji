import { workspaceStore as defaultStore } from './workspace-store.instance'
import { createSelectorBinding } from './create-selector-binding'
import type { MemoListEntry } from '../memo-cache-types'
import type { WorkspaceStore } from '../workspace-store'

export interface MemoListBinding {
  listKey: string
  selectListEntry(): MemoListEntry | undefined
  unsubscribe(): void
}

export function bindMemoList(
  listKey: string,
  onChange: (entry: MemoListEntry | undefined) => void,
  store: WorkspaceStore = defaultStore,
): MemoListBinding {
  const select = () => store.getState().memos.list.get(listKey)
  const binding = createSelectorBinding(select, store.subscribe, onChange)

  return {
    listKey,
    selectListEntry: binding.selectValue,
    unsubscribe: binding.unsubscribe,
  }
}
