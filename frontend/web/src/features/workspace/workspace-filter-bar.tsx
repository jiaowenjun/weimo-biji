import type { ComponentPropsWithoutRef } from 'react'
import { X } from 'lucide-react'
import { Chip } from 'weimo-ui/components/chip'

import type { WorkspaceNavigationFacet } from './workspace-navigation-store'

type ActiveWorkspaceFacet = Exclude<WorkspaceNavigationFacet, 'none'>

type FilterChipItem = {
  key: string
  label: string
  clearLabel: string
  onClear: () => void
}

export type WorkspaceFilterBarProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  activeDate: string
  selectedFacet: WorkspaceNavigationFacet
  onClearDate: () => void
  onClearFacet: () => void
}

const FACET_FILTER_LABELS = {
  annotation: '有批注',
  heading: '有标题',
  'unordered-list': '有列表',
  'markdown-quote': '有引用',
} satisfies Record<ActiveWorkspaceFacet, string>

function getFacetFilterLabel(facet: WorkspaceNavigationFacet) {
  if (facet === 'none') return null

  return FACET_FILTER_LABELS[facet]
}

export function WorkspaceFilterBar({
  activeDate,
  className,
  onClearDate,
  onClearFacet,
  role,
  'aria-label': ariaLabel,
  selectedFacet,
  ...props
}: WorkspaceFilterBarProps) {
  const normalizedDate = activeDate.trim()
  const facetLabel = getFacetFilterLabel(selectedFacet)
  const chips: FilterChipItem[] = []

  if (normalizedDate) {
    chips.push({
      key: 'date',
      label: `日期 ${normalizedDate}`,
      clearLabel: '清除日期筛选',
      onClear: onClearDate,
    })
  }

  if (facetLabel) {
    chips.push({
      key: 'facet',
      label: facetLabel,
      clearLabel: `清除${facetLabel}筛选`,
      onClear: onClearFacet,
    })
  }

  if (chips.length === 0) return null

  return (
    <div
      {...props}
      aria-label={ariaLabel ?? '当前筛选条件'}
      className={['workspace-filter-bar', className].filter(Boolean).join(' ')}
      role={role ?? 'toolbar'}
    >
      {chips.map((item) => (
        <Chip
          content={item.label}
          key={item.key}
          suffix={
            <button
              aria-label={item.clearLabel}
              className="workspace-filter-bar__close"
              onClick={item.onClear}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          }
          textSize="sm"
          variant="glass"
        />
      ))}
    </div>
  )
}
