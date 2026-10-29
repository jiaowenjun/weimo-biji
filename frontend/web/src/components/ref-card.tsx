import { CircleArrowDown, CircleArrowUp, Trash2 } from 'lucide-react'

import {
  buildWorkspaceMemoCardMenuItems,
} from '@/features/workspace/workspace-memo-card-menu'
import { getCardSurfaceClassName } from 'weimo-ui-core/components/card-surface'

import { NoteCard, type CardDraft, type CardNote } from './note-card'
import type { ActionMenuItem } from 'weimo-ui-core/components/menu'

import './ref-card.css'

export interface RefCardReferencePreview {
  id: string
  displayText: string
}

export type RefCardProps = {
  note: CardNote
  defaultMode?: 'view' | 'edit'
  disabled?: boolean
  displayMenuItems?: ActionMenuItem[]
  referencePreview?: RefCardReferencePreview | null
  referencedByPreviews?: RefCardReferencePreview[]
  referenceDisabled?: boolean
  onCopySelect?: () => void
  onDelete?: () => void
  onReferenceClick?: () => void
  onQuoteSelect?: () => void
  onSave?: (draft: CardDraft) => void
  onCancel?: () => void
  onTagClick?: (tag: string) => void
  tagOptions?: string[]
  showReferenceBar?: boolean
}

function renderReferenceLine(
  item: RefCardReferencePreview,
  relation: 'reference' | 'referencedBy',
) {
  const iconClassName =
    relation === 'reference'
      ? 'ref-card__icon ref-card__icon--reference'
      : 'ref-card__icon ref-card__icon--referenced-by'

  return (
    <span className="ref-card__reference-line" key={`${relation}-${item.id}`}>
      {relation === 'reference' ? (
        <CircleArrowUp aria-hidden="true" className={iconClassName} />
      ) : (
        <CircleArrowDown aria-hidden="true" className={iconClassName} />
      )}
      <span className="ref-card__reference-text">{item.displayText}</span>
    </span>
  )
}

export function RefCard({
  referenceDisabled = false,
  referencePreview = null,
  referencedByPreviews = [],
  onCopySelect,
  onDelete,
  onReferenceClick,
  onQuoteSelect,
  showReferenceBar = true,
  ...noteCardProps
}: RefCardProps) {
  const hasReferenceBar = referencePreview !== null || referencedByPreviews.length > 0
  const hasVisibleReferenceBar = showReferenceBar && hasReferenceBar
  const menuItems = buildWorkspaceMemoCardMenuItems({
    showMemoDetailPage: hasVisibleReferenceBar,
    extraDisplayMenuItems: noteCardProps.displayMenuItems,
    onCopySelect,
    onMemoDetailSelect: onReferenceClick,
    onQuoteSelect,
  })
  // 删除入口沿旧卡惯例固定挂在菜单末尾(旧 Card 内部追加)
  const displayMenuItems = onDelete
    ? [
        ...menuItems,
        {
          key: 'delete',
          label: '删除',
          icon: <Trash2 aria-hidden="true" />,
          variant: 'destructive' as const,
          onSelect: onDelete,
        },
      ]
    : menuItems
  const refCardClassName = hasVisibleReferenceBar
    ? getCardSurfaceClassName('ref-card')
    : 'ref-card'
  const referenceBar = hasVisibleReferenceBar ? (
    <button
      aria-label="引用关系"
      className="ref-card__reference"
      data-reference-disabled={referenceDisabled ? 'true' : undefined}
      disabled={referenceDisabled || !onReferenceClick}
      onClick={handleReferenceClick}
      type="button"
    >
      <span className="ref-card__reference-inner">
        {referencePreview ? renderReferenceLine(referencePreview, 'reference') : null}
        {referencedByPreviews.map((item) =>
          renderReferenceLine(item, 'referencedBy'),
        )}
      </span>
    </button>
  ) : null

  function handleReferenceClick() {
    if (referenceDisabled) return

    onReferenceClick?.()
  }

  return (
    <div
      className={refCardClassName}
      data-has-reference={hasVisibleReferenceBar ? 'true' : undefined}
    >
      <NoteCard
        {...noteCardProps}
        bottomBarExtra={referenceBar}
        displayMenuItems={displayMenuItems}
      />
    </div>
  )
}
