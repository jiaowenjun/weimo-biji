import { ArrowUpDown, Check, Grid2X2, Home, LogIn, RefreshCw, Undo2, Users } from 'lucide-react'
import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'
import { ActionMenu, type ActionMenuItem } from 'weimo-ui/components/menu'

import type { MemoSearchQuery } from './workspace-types'

type MemoCreatedAtSort = NonNullable<MemoSearchQuery['created_at_sort']>

export type WorkspaceHomeMemoScope = 'self' | 'friend'

type WorkspaceTitleMenuProps = {
  canViewFriendMemos?: boolean
  homeMemoScope?: WorkspaceHomeMemoScope
  memoCreatedAtSort?: MemoCreatedAtSort
  onMemoCreatedAtSortChange?: (sort: MemoCreatedAtSort) => void
  onViewFriendMemos?: () => void
  onViewMyMemos?: () => void
  onRefresh?: () => void
  selectedTag?: string
  showGuestAuthAction?: boolean
}

function memoCreatedAtSortSummaryLabel(sort: MemoCreatedAtSort): string {
  return sort === 'desc' ? '从新到旧' : '从旧到新'
}

function selectMemoCreatedAtSort(
  currentSort: MemoCreatedAtSort,
  nextSort: MemoCreatedAtSort,
  onMemoCreatedAtSortChange?: (sort: MemoCreatedAtSort) => void,
) {
  if (currentSort === nextSort) return

  onMemoCreatedAtSortChange?.(nextSort)
}

function parentTagPath(tagPath: string): string | null {
  const tag = String(tagPath || '').trim()
  const slash = tag.lastIndexOf('/')

  if (slash <= 0) return null

  const parent = tag.slice(0, slash).trim()

  return parent || null
}

function buildWorkspaceTitleMenuItems({
  canViewFriendMemos,
  homeMemoScope = 'self',
  memoCreatedAtSort,
  onMemoCreatedAtSortChange,
  onViewFriendMemos,
  onViewMyMemos,
  onRefresh,
  selectedTag,
  showGuestAuthAction,
}: WorkspaceTitleMenuProps): ActionMenuItem[] {
  const tag = String(selectedTag || '').trim()
  const sort = memoCreatedAtSort ?? 'desc'
  const items: ActionMenuItem[] = []

  if (homeMemoScope === 'self' && showGuestAuthAction) {
    items.push({
      key: 'guestAuth',
      icon: <LogIn aria-hidden="true" />,
      label: '登录/注册',
    })
  }

  if (parentTagPath(tag)) {
    items.push({
      key: 'parentTag',
      icon: <Undo2 aria-hidden="true" />,
      label: '查看上一级标签',
    })
  }

  if (tag) {
    items.push({
      key: 'allTags',
      icon: <Grid2X2 aria-hidden="true" />,
      label: '查看全部笔记',
    })
  }

  if (homeMemoScope === 'friend') {
    items.push({
      key: 'viewMyMemos',
      icon: <Home aria-hidden="true" />,
      label: '查看我的笔记',
      onSelect: onViewMyMemos,
    })
  } else if (canViewFriendMemos) {
    items.push({
      key: 'viewFriendMemos',
      icon: <Users aria-hidden="true" />,
      label: '查看好友笔记',
      onSelect: onViewFriendMemos,
    })
  }

  items.push(
    {
      key: 'memoSortSection',
      type: 'sub',
      icon: <ArrowUpDown aria-hidden="true" />,
      label: '排序方式',
      shortcut: memoCreatedAtSortSummaryLabel(sort),
      items: [
        {
          key: 'memoSortNewestFirst',
          icon: sort === 'desc' ? <Check aria-hidden="true" /> : undefined,
          inset: sort !== 'desc',
          label: '最新的排最前',
          onSelect: () =>
            selectMemoCreatedAtSort(
              sort,
              'desc',
              onMemoCreatedAtSortChange,
            ),
        },
        {
          key: 'memoSortOldestFirst',
          icon: sort === 'asc' ? <Check aria-hidden="true" /> : undefined,
          inset: sort !== 'asc',
          label: '最旧的排最前',
          onSelect: () =>
            selectMemoCreatedAtSort(
              sort,
              'asc',
              onMemoCreatedAtSortChange,
            ),
        },
      ],
    },
    {
      key: 'refresh',
      icon: <RefreshCw aria-hidden="true" />,
      label: '刷新',
      onSelect: onRefresh,
    },
  )

  return items
}

export function WorkspaceTitleMenu({
  canViewFriendMemos,
  homeMemoScope,
  memoCreatedAtSort,
  onMemoCreatedAtSortChange,
  onViewFriendMemos,
  onViewMyMemos,
  onRefresh,
  selectedTag,
  showGuestAuthAction,
}: WorkspaceTitleMenuProps) {
  const items = buildWorkspaceTitleMenuItems({
    canViewFriendMemos,
    homeMemoScope,
    memoCreatedAtSort,
    onMemoCreatedAtSortChange,
    onViewFriendMemos,
    onViewMyMemos,
    onRefresh,
    selectedTag,
    showGuestAuthAction,
  })

  return (
    <ActionMenu
      ariaLabel="更多"
      items={items}
      triggerProps={{
        render: <GlassIconButton aria-label="更多" />,
      }}
    />
  )
}
