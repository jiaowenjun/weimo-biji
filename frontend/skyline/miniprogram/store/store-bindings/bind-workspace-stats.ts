import { workspaceStore as defaultStore } from './workspace-store.instance'
import { createSelectorBinding } from './create-selector-binding'
import type { CacheEntryBase } from '../memo-cache-types'
import type { WorkspaceStore } from '../workspace-store'
import type { WorkspaceStats } from '../../models/workspace'

export type WorkspaceStatsEntry = CacheEntryBase & { data: WorkspaceStats | null }

export interface WorkspaceStatsBinding {
  selectEntry(): WorkspaceStatsEntry
  unsubscribe(): void
}

export function bindWorkspaceStats(
  onChange: (entry: WorkspaceStatsEntry) => void,
  store: WorkspaceStore = defaultStore,
): WorkspaceStatsBinding {
  const select = () => store.getState().stats
  const binding = createSelectorBinding(select, store.subscribe, onChange)
  return { selectEntry: binding.selectValue, unsubscribe: binding.unsubscribe }
}
