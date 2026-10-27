import { CircleArrowDown, CircleArrowUp } from 'lucide-react'

import { Card } from '@/components/card'
import type { CardProps } from '@/components/card'
import { buildWorkspaceMemoCardMenuItems } from '@/features/workspace/workspace-memo-card-menu'
import { getCardSurfaceClassName } from 'weimo-ui/components/card-surface'

import './ref-card.css'

export interface RefCardReferencePreview {
  id: string
  displayText: string
}

export type RefCardProps = CardProps & {
  referencePreview?: RefCardReferencePreview | null
  referencedByPreviews?: RefCardReferencePreview[]
  referenceDisabled?: boolean
  onCopySelect?: () => void
  onReferenceClick?: () => void
  onQuoteSelect?: () => void
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
  onReferenceClick,
  onQuoteSelect,
  showReferenceBar = true,
  ...cardProps
}: RefCardProps) {
  const hasReferenceBar = referencePreview !== null || referencedByPreviews.length > 0
  const hasVisibleReferenceBar = showReferenceBar && hasReferenceBar
  const displayMenuItems = buildWorkspaceMemoCardMenuItems({
    showMemoDetailPage: hasVisibleReferenceBar,
    extraDisplayMenuItems: cardProps.displayMenuItems,
    onCopySelect,
    onMemoDetailSelect: onReferenceClick,
    onQuoteSelect,
  })
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
      <Card
        {...cardProps}
        afterTagsSlot={referenceBar}
        displayMenuItems={displayMenuItems}
      />
    </div>
  )
}
