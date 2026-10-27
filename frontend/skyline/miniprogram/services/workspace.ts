import type { WorkspaceStats } from '../models/workspace'
import { request } from '../utils/request'

export function getWorkspaceStats() {
  return request<WorkspaceStats>({
    url: '/me/stats',
  })
}
