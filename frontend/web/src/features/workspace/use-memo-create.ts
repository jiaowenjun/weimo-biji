import { useCallback, useMemo } from 'react'
import { usePendingCreate } from '@weimo/workspace-core/use-pending-create'

import type { CardDraft } from '@/components/note-card'
import { isWdfDocumentEmpty } from 'weimo-ui-editor/components/card-composer'
import { WdfDocument } from 'weimo-wdf'

import { formatMemoTimestamp } from './memo-data'
import { toInitialCreateTags } from './sidebar-data'
import type { Memo } from './workspace-types'

type PendingMemoDraft = {
  content: WdfDocument
  createdAt: string
  createdMemo: Memo | null
  tags: string[]
}

export type MemoCreateInput = {
  content: WdfDocument
  tags: string[]
}

type UseMemoCreateOptions = {
  clientIdPrefix: string
  commitCreatedMemo?: (memo: Memo) => void
  isPending: boolean
  persistMemo: (input: MemoCreateInput) => Memo | null | PromiseLike<Memo | null>
  selectedTag: string
}

function createPendingMemoClientId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}`
}

export function useMemoCreate({
  clientIdPrefix,
  commitCreatedMemo,
  isPending,
  persistMemo,
  selectedTag,
}: UseMemoCreateOptions) {
  const createDraft = useCallback((): PendingMemoDraft => ({
    content: WdfDocument.empty(),
    createdAt: new Date().toISOString(),
    createdMemo: null,
    tags: toInitialCreateTags(selectedTag),
  }), [selectedTag])
  const prepareSubmission = useCallback((draft: CardDraft) => {
    if (isWdfDocumentEmpty(draft.content)) return null

    const content = draft.content
    const tags = [...draft.tags]

    return {
      changes: { content, tags },
      getResultChanges: (createdMemo: Memo | null) => ({ createdMemo }),
      run: () => persistMemo({ content, tags }),
    }
  }, [persistMemo])
  const handleViewTransitionEnd = useCallback((state: PendingMemoDraft) => {
    if (state.createdMemo) commitCreatedMemo?.(state.createdMemo)
  }, [commitCreatedMemo])
  const memoCreate = usePendingCreate<PendingMemoDraft, CardDraft, Memo | null>({
    blocked: isPending,
    createClientId: () => createPendingMemoClientId(clientIdPrefix),
    createDraft,
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : '新建笔记失败')
    },
    onReadyToCommit: handleViewTransitionEnd,
    prepareSubmission,
  })
  const pendingCreateNote = useMemo(
    () => memoCreate.pending
      ? {
          content: memoCreate.pending.content,
          createdAtText: formatMemoTimestamp(memoCreate.pending.createdAt),
          tags: memoCreate.pending.tags.length > 0
            ? memoCreate.pending.tags
            : undefined,
        }
      : null,
    [memoCreate.pending],
  )

  return {
    cancel: memoCreate.cancel,
    finishExitAnimation: memoCreate.finishExitAnimation,
    finishViewTransition: memoCreate.finishViewTransition,
    isPending,
    pendingCreate: memoCreate.pending,
    pendingCreateNote,
    reset: memoCreate.reset,
    save: memoCreate.submit,
    start: memoCreate.start,
  }
}
