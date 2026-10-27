import { createWorkspaceStore } from '../workspace-store'
import { resolveWorkspaceRuntime } from '../workspace-runtime'
import {
  clearWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspaceRuntimeMode,
} from '../workspace-storage'

const SNAPSHOT_WRITE_DELAY_MS = 50

const initialRuntime = resolveWorkspaceRuntime()
let currentMode: WorkspaceRuntimeMode = initialRuntime.mode
let pendingSnapshotTimer: ReturnType<typeof setTimeout> | null = null

export const workspaceStore = createWorkspaceStore({
  services: initialRuntime.services,
  initialState: initialRuntime.state,
})

function scheduleSnapshotSave() {
  if (pendingSnapshotTimer) return

  pendingSnapshotTimer = setTimeout(() => {
    pendingSnapshotTimer = null
    saveWorkspaceSnapshot(currentMode, workspaceStore.getState())
  }, SNAPSHOT_WRITE_DELAY_MS)
}

workspaceStore.subscribe(() => {
  scheduleSnapshotSave()
})

export function syncWorkspaceStoreRuntime(force = false) {
  const nextRuntime = resolveWorkspaceRuntime()
  if (!force && nextRuntime.mode === currentMode) {
    return
  }

  currentMode = nextRuntime.mode
  workspaceStore.replaceRuntime({
    services: nextRuntime.services,
    state: nextRuntime.state,
  })
}

export function clearVisitorWorkspaceData() {
  clearWorkspaceSnapshot('visitor')
}
