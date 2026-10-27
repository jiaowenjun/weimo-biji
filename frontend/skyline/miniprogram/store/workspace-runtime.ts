import { createMemo, deleteMemo, getMemo, getMemos, searchMemos, updateMemo } from '../services/memo'
import { getTagTree, renameTag, deleteTag } from '../services/tag'
import { getWorkspaceStats } from '../services/workspace'
import { hasSession } from '../utils/session'
import type { WorkspaceRuntimeConfig, WorkspaceServices } from './workspace-store'
import { loadWorkspaceSnapshot, type WorkspaceRuntimeMode } from './workspace-storage'
import { createVisitorWorkspaceServices } from './visitor-workspace-services'

function createRemoteServices(): WorkspaceServices {
  return {
    searchMemos: (filters, cursor, pageSize) => searchMemos(filters, cursor, pageSize),
    getMemo,
    getMemos,
    createMemo,
    updateMemo,
    deleteMemo,
    getWorkspaceStats,
    getTagTree,
    renameTag,
    deleteTag,
  }
}

export interface ResolvedWorkspaceRuntime extends WorkspaceRuntimeConfig {
  mode: WorkspaceRuntimeMode
}

export function resolveWorkspaceRuntime(): ResolvedWorkspaceRuntime {
  const mode: WorkspaceRuntimeMode = hasSession() ? 'authenticated' : 'visitor'
  const state = loadWorkspaceSnapshot(mode)
  return {
    mode,
    state,
    services: mode === 'authenticated'
      ? createRemoteServices()
      : createVisitorWorkspaceServices(state),
  }
}
