import {
  clearVisitorWorkspaceData,
  syncWorkspaceStoreRuntime,
} from '../store/store-bindings/workspace-store.instance'
import { clearSession } from './session'

export function performLogout() {
  clearSession()
  clearVisitorWorkspaceData()
  syncWorkspaceStoreRuntime(true)
}
