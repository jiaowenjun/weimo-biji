import type { WorkspaceStats } from '../../models/workspace'
import type { WorkspaceStoreCtx } from './types'
import { createSingleResourceLifecycle } from './single-resource-lifecycle'

export function createStatsResource(ctx: WorkspaceStoreCtx) {
  return createSingleResourceLifecycle({
    getEntry: () => ctx.state.stats,
    setEntry: (entry) => {
      ctx.state.stats = entry
    },
    getInflight: () => ctx.aggregateSlots.stats.inflight,
    setInflight: (value) => {
      ctx.aggregateSlots.stats.inflight = value
    },
    getPendingCause: () => ctx.aggregateSlots.stats.pendingCause,
    setPendingCause: (value) => {
      ctx.aggregateSlots.stats.pendingCause = value
    },
    getInflightSource: () => ctx.aggregateSlots.stats.inflightSource,
    setInflightSource: (value) => {
      ctx.aggregateSlots.stats.inflightSource = value
    },
    isFresh: (entry) => ctx.isFresh(entry),
    invalidateEntry: () => {
      ctx.state.stats = { ...ctx.state.stats, dataUpdatedAt: 0 }
    },
    fetchOnce: async (runtimeVersion) => {
      ctx.state.stats = { ...ctx.state.stats, status: 'loading', error: null }
      ctx.emit()
      try {
        const data: WorkspaceStats = await ctx.services.getWorkspaceStats()
        if (!ctx.isRuntimeCurrent(runtimeVersion)) return
        ctx.state.stats = { status: 'success', error: null, dataUpdatedAt: ctx.now(), data }
      } catch (err) {
        if (!ctx.isRuntimeCurrent(runtimeVersion)) return
        ctx.state.stats = { ...ctx.state.stats, status: 'error', error: (err as Error).message }
        ctx.emit()
        throw err
      }
      ctx.emit()
    },
    emit: ctx.emit,
    getRuntimeVersion: ctx.getRuntimeVersion,
    isRuntimeCurrent: ctx.isRuntimeCurrent,
  })
}
