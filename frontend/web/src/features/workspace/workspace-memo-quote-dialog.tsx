import { useMemo } from 'react'
import { ActionDialog } from 'weimo-ui/components/action-dialog'
import { DialogPanel } from 'weimo-ui/components/coss/dialog'

import type { CardDraft } from '@/components/card'
import { RefCard } from '@/components/ref-card'
import {
  buildMemoReferenceDisplayText,
  formatMemoTimestamp,
} from '@/features/workspace/memo-data'
import type { Memo } from './workspace-types'

import './workspace-memo-quote-dialog.css'

export interface WorkspaceMemoQuoteDialogProps {
  memo: Memo | null
  onOpenChange: (open: boolean) => void
  onSave: (memo: Memo, draft: CardDraft) => void
  open: boolean
  tagOptions?: string[]
}

export function WorkspaceMemoQuoteDialog({
  memo,
  onOpenChange,
  onSave,
  open,
  tagOptions,
}: WorkspaceMemoQuoteDialogProps) {
  const quoteNote = useMemo(
    () => ({
      content: '',
      createdAtText: memo ? formatMemoTimestamp(new Date().toISOString()) : '',
    }),
    [memo],
  )
  const sourcePreview = useMemo(
    () =>
      memo
        ? {
            id: String(memo.id),
            displayText: buildMemoReferenceDisplayText(
              formatMemoTimestamp(memo.createdAt),
              memo.content,
            ),
          }
        : null,
    [memo],
  )

  function handleCancel() {
    onOpenChange(false)
  }

  function handleSave(draft: CardDraft) {
    if (!memo) return

    onSave(memo, draft)
  }

  return (
    <ActionDialog
      className="workspace-memo-quote-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="批注"
    >
      <DialogPanel
        aria-label="批注编辑内容"
        className="workspace-memo-quote-dialog__panel"
        role="region"
      >
        {memo ? (
          <div className="workspace-memo-quote-dialog__editor">
            <RefCard
              initialMode="edit"
              key={memo.id}
              note={quoteNote}
              onCancel={handleCancel}
              onSave={handleSave}
              referencePreview={sourcePreview}
              tagOptions={tagOptions}
            />
          </div>
        ) : null}
      </DialogPanel>
    </ActionDialog>
  )
}
