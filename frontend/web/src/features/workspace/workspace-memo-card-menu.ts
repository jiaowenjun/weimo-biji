import { Copy, Quote, CircleArrowOutUpLeft } from 'lucide-react'
import { createElement } from 'react'
import type { ActionMenuItem } from 'weimo-ui-core/components/menu'

type BuildWorkspaceMemoCardMenuItemsOptions = {
  showMemoDetailPage?: boolean
  extraDisplayMenuItems?: ActionMenuItem[]
  onCopySelect?: () => void
  onMemoDetailSelect?: () => void
  onQuoteSelect?: () => void
}

function icon(Component: typeof Quote) {
  return createElement(Component, {
    'aria-hidden': 'true',
  })
}

export function buildWorkspaceMemoCardMenuItems({
  showMemoDetailPage = false,
  extraDisplayMenuItems = [],
  onCopySelect,
  onMemoDetailSelect,
  onQuoteSelect,
}: BuildWorkspaceMemoCardMenuItemsOptions = {}): ActionMenuItem[] {
  const secondaryItems: ActionMenuItem[] = [
    ...(showMemoDetailPage
      ? [
          {
            key: 'memo-detail',
            label: '查看详情',
            icon: icon(CircleArrowOutUpLeft),
            onSelect: onMemoDetailSelect,
          } satisfies ActionMenuItem,
        ]
      : []),
    {
      key: 'copy',
      label: '复制',
      icon: icon(Copy),
      onSelect: onCopySelect,
    },
  ]

  return [
    {
      key: 'quote',
      label: '批注',
      icon: icon(Quote),
      onSelect: onQuoteSelect,
    },
    {
      key: 'workspace-memo-card-secondary-separator',
      type: 'separator',
    },
    ...secondaryItems,
    ...extraDisplayMenuItems,
  ]
}
