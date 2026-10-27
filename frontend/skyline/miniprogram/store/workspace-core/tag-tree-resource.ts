import { sortTagTreeMetaDeep } from '../../utils/tag-sort'
import type { WorkspaceStoreCtx } from './types'
import { createSingleResourceLifecycle } from './single-resource-lifecycle'

export function createTagTreeResource(ctx: WorkspaceStoreCtx) {
  return createSingleResourceLifecycle({
    getEntry: () => ctx.state.tagTree,
    setEntry: (entry) => {
      ctx.state.tagTree = entry
    },
    getInflight: () => ctx.aggregateSlots.tagTree.inflight,
    setInflight: (value) => {
      ctx.aggregateSlots.tagTree.inflight = value
    },
    getPendingCause: () => ctx.aggregateSlots.tagTree.pendingCause,
    setPendingCause: (value) => {
      ctx.aggregateSlots.tagTree.pendingCause = value
    },
    getInflightSource: () => ctx.aggregateSlots.tagTree.inflightSource,
    setInflightSource: (value) => {
      ctx.aggregateSlots.tagTree.inflightSource = value
    },
    isFresh: (entry) => ctx.isFresh(entry),
    invalidateEntry: () => {
      ctx.state.tagTree = { ...ctx.state.tagTree, dataUpdatedAt: 0 }
    },
    fetchOnce: async (runtimeVersion) => {
      ctx.state.tagTree = { ...ctx.state.tagTree, status: 'loading', error: null }
      ctx.emit()
      try {
        const root = await ctx.services.getTagTree()
        if (!ctx.isRuntimeCurrent(runtimeVersion)) return
        ctx.state.tagTree = {
          status: 'success',
          error: null,
          dataUpdatedAt: ctx.now(),
          data: sortTagTreeMetaDeep(root.children || []),
          untaggedCount: root.untagged_count || 0,
        }
      } catch (err) {
        if (!ctx.isRuntimeCurrent(runtimeVersion)) return
        ctx.state.tagTree = { ...ctx.state.tagTree, status: 'error', error: (err as Error).message }
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
