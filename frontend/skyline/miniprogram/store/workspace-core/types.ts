import type { WorkspaceServices, WorkspaceState } from '../workspace-store'

export type PendingCause = 'refresh' | 'invalidate'
export type LifecycleSource = 'ensure' | PendingCause

export interface RuntimeGate {
  getRuntimeVersion(): number
  isRuntimeCurrent(runtimeVersion: number): boolean
}

export interface AggregateSlotState {
  inflight: Promise<void> | null
  pendingCause: PendingCause | null
  inflightSource: LifecycleSource | null
}

export interface AggregateSlots {
  stats: AggregateSlotState
  tagTree: AggregateSlotState
}

export interface WorkspaceStoreCtx extends RuntimeGate {
  state: WorkspaceState
  services: WorkspaceServices
  aggregateSlots: AggregateSlots
  now(): number
  emit(): void
  subscribe(listener: () => void): () => void
  isFresh(entry: { dataUpdatedAt: number } | undefined): boolean
}

export interface AggregateResource {
  ensure(): Promise<void>
  refresh(): Promise<void>
  invalidateFromMutation(): void
  resetForRuntimeReplace(): void
}

export interface AggregateResources {
  stats: AggregateResource
  tagTree: AggregateResource
}
