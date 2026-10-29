import { useMemo } from 'react'
import { ActionDialog } from 'weimo-ui-core/components/action-dialog'
import { DialogPanel } from 'weimo-ui-core/components/coss/dialog'

import { RefCard } from '@/components/ref-card'
import {
  buildMemoReferencePreviews,
  createMemoReferencePreviewResolver,
  type MemoReferencePreviewResolver,
  toCardNote,
} from '@/features/workspace/memo-data'
import type { Memo } from './workspace-types'
import {
  buildWorkspaceMemoDetailProjection,
  type WorkspaceMemoDetailRelationItem,
} from './workspace-memo-detail'

import './workspace-memo-detail-dialog.css'

export interface WorkspaceMemoDetailDialogProps {
  memo: Memo | null
  memos: readonly Memo[]
  onOpenChange: (open: boolean) => void
  open: boolean
  referencePreviewResolver?: MemoReferencePreviewResolver
  tagOptions?: string[]
}

function WorkspaceMemoDetailSection({
  items,
  label,
  referencePreviewResolver,
  tagOptions,
}: {
  items: readonly WorkspaceMemoDetailRelationItem[]
  label: string
  referencePreviewResolver: MemoReferencePreviewResolver
  tagOptions?: string[]
}) {
  if (items.length === 0) return null

  return (
    <section className="workspace-memo-detail-dialog__section">
      <p className="workspace-memo-detail-dialog__section-title">
        {label.replace('{count}', String(items.length))}
      </p>
      <div className="workspace-memo-detail-dialog__section-cards">
        {items.map((item) => {
          const previews = buildMemoReferencePreviews(
            item.memo,
            referencePreviewResolver,
          )

          return (
            <RefCard
              disabled
              key={item.memo.id}
              note={toCardNote(item.memo)}
              referencePreview={previews.referencePreview}
              referencedByPreviews={previews.referencedByPreviews}
              tagOptions={tagOptions}
            />
          )
        })}
      </div>
    </section>
  )
}

export function WorkspaceMemoDetailDialog({
  memo,
  memos,
  onOpenChange,
  open,
  referencePreviewResolver,
  tagOptions,
}: WorkspaceMemoDetailDialogProps) {
  const memoById = useMemo(
    () => new Map(memos.map((item) => [item.id, item])),
    [memos],
  )
  const fallbackReferencePreviewResolver = useMemo(
    () =>
      createMemoReferencePreviewResolver({
        getMemoById: (id) => memoById.get(id),
      }),
    [memoById],
  )
  const detailReferencePreviewResolver =
    referencePreviewResolver ?? fallbackReferencePreviewResolver
  const projection = useMemo(
    () =>
      memo
        ? buildWorkspaceMemoDetailProjection(
            memo,
            memos,
            detailReferencePreviewResolver,
          )
        : null,
    [detailReferencePreviewResolver, memo, memos],
  )
  const rootPreviews = useMemo(
    () =>
      memo
        ? buildMemoReferencePreviews(memo, detailReferencePreviewResolver)
        : null,
    [detailReferencePreviewResolver, memo],
  )
  const referenceSections = projection
    ? [
        {
          key: 'reference',
          label: '- 引用以下 {count} 条笔记 -',
          items: projection.referenceItems,
        },
        {
          key: 'referenced-by',
          label: '- 被以下 {count} 条笔记引用 -',
          items: projection.referencedByItems,
        },
      ]
    : []
  const hasRelations = referenceSections.some((section) => section.items.length > 0)

  return (
    <ActionDialog
      className="workspace-memo-detail-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="笔记详情"
    >
      <DialogPanel
        aria-label="笔记详情内容"
        className="workspace-memo-detail-dialog__panel"
        role="region"
      >
        {memo && projection && rootPreviews ? (
          <div className="workspace-memo-detail-dialog__content">
            <RefCard
              disabled
              note={toCardNote(projection.rootMemo)}
              referencePreview={rootPreviews.referencePreview}
              referencedByPreviews={rootPreviews.referencedByPreviews}
              showReferenceBar={false}
              tagOptions={tagOptions}
            />
            {hasRelations ? (
              <div className="workspace-memo-detail-dialog__sections">
                {referenceSections.map((section) => (
                  <WorkspaceMemoDetailSection
                    items={section.items}
                    key={section.key}
                    label={section.label}
                    referencePreviewResolver={detailReferencePreviewResolver}
                    tagOptions={tagOptions}
                  />
                ))}
              </div>
            ) : (
              <p className="workspace-memo-detail-dialog__empty">
                暂无引用关系
              </p>
            )}
          </div>
        ) : (
          <p className="workspace-memo-detail-dialog__empty">笔记详情不可用</p>
        )}
      </DialogPanel>
    </ActionDialog>
  )
}
