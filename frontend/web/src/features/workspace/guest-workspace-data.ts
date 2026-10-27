import { UNTAGGED_TAG } from './sidebar-data.ts'
import type {
  Memo,
  MemoDateFilter,
  MemoSearchQuery,
  TagTreeMeta,
  WorkspaceStats,
} from './workspace-types'

export const guestStats: WorkspaceStats = {
  note_count: 5,
  tag_count: 7,
  word_count: 12840,
  daily_note_count: [
    [20260619, 1],
    [20260620, 2],
    [20260621, 1],
    [20260625, 3],
  ],
}

export const guestTagTree: TagTreeMeta = {
  label: '全部标签',
  tag: '',
  item_count: 5,
  untagged_count: 1,
  children: [
    {
      label: '文学',
      tag: '文学',
      item_count: 2,
      children: [
        {
          label: '古代',
          tag: '文学/古代',
          item_count: 2,
          children: [
            {
              label: '诗词',
              tag: '文学/古代/诗词',
              item_count: 2,
              children: [],
            },
          ],
        },
      ],
    },
    {
      label: '开发',
      tag: '开发',
      item_count: 2,
      children: [
        {
          label: 'React',
          tag: '开发/React',
          item_count: 1,
          children: [],
        },
        {
          label: '调试',
          tag: '开发/调试',
          item_count: 1,
          children: [],
        },
      ],
    },
  ],
}

export const guestMemoCards: Memo[] = [
  {
    id: 1,
    content:
      '# 游客模式调试\n\n无需登录也能检查工作台布局、TopBar 标签面包屑和侧栏筛选。\n\n- 点击左侧标签树\n- 观察顶部当前标签',
    createdAt: '2026-06-25T09:30:00.000+08:00',
    updatedAt: '2026-06-25T09:30:00.000+08:00',
    tags: ['开发/调试'],
    refs: [],
    referencedBy: ['3'],
  },
  {
    id: 2,
    content:
      '> 山气日夕佳，飞鸟相与还。\n\n这条笔记用于检查嵌套标签 `文学/古代/诗词` 在 TagBread 中拆分展示。',
    createdAt: '2026-06-25T08:20:00.000+08:00',
    updatedAt: '2026-06-25T08:20:00.000+08:00',
    tags: ['文学/古代/诗词'],
    refs: [],
    referencedBy: [],
  },
  {
    id: 3,
    content:
      'React 调试记录：TagBread 点击上级标签时，应复用同一套 `selectTag` 状态，不创建第二份导航状态。',
    createdAt: '2026-06-21T16:45:00.000+08:00',
    updatedAt: '2026-06-21T16:45:00.000+08:00',
    tags: ['开发/React'],
    refs: ['1'],
    referencedBy: [],
  },
  {
    id: 4,
    content:
      '诗词摘录旁边可以放一点批注 ==这里用来触发有批注筛选==，方便看导航筛选和列表状态是否同步。',
    createdAt: '2026-06-20T11:12:00.000+08:00',
    updatedAt: '2026-06-20T11:12:00.000+08:00',
    tags: ['文学/古代/诗词'],
    refs: [],
    referencedBy: [],
  },
  {
    id: 5,
    content: '这是一条未标签笔记，用于调试侧栏底部的未标签入口。',
    createdAt: '2026-06-19T20:05:00.000+08:00',
    updatedAt: '2026-06-19T20:05:00.000+08:00',
    tags: [],
    refs: [],
    referencedBy: [],
  },
]

function memoMatchesDate(memo: Memo, filter: MemoDateFilter) {
  const createdAt = new Date(memo.createdAt)
  if (Number.isNaN(createdAt.getTime())) return false

  const year = createdAt.getFullYear()
  const month = createdAt.getMonth() + 1
  const day = createdAt.getDate()

  if (filter.kind === 'year') {
    return year === filter.year
  }

  if (filter.kind === 'month') {
    return year === filter.year && month === filter.month
  }

  return year === filter.year && month === filter.month && day === filter.day
}

function memoMatchesTag(memo: Memo, tag: string) {
  if (tag === UNTAGGED_TAG) {
    return memo.tags.length === 0
  }

  return memo.tags.some((memoTag) => memoTag === tag || memoTag.startsWith(`${tag}/`))
}

export function filterGuestMemos(
  memos: Memo[],
  filters: MemoSearchQuery = {},
): Memo[] {
  const filteredMemos = memos.filter((memo) => {
    if (filters.created_at && !memoMatchesDate(memo, filters.created_at)) {
      return false
    }

    if (filters.tag && !memoMatchesTag(memo, filters.tag)) {
      return false
    }

    if (filters.has_no_tag && memo.tags.length > 0) {
      return false
    }

    if (filters.text?.contains && !memo.content.includes(filters.text.contains)) {
      return false
    }

    if (filters.has_annotation && !memo.content.includes('==')) {
      return false
    }

    if (filters.has_heading && !/^#\s/m.test(memo.content)) {
      return false
    }

    if (filters.has_unordered_list && !/^-\s/m.test(memo.content)) {
      return false
    }

    if (filters.has_markdown_quote && !/^>\s/m.test(memo.content)) {
      return false
    }

    return true
  })

  if (filters.created_at_sort === 'asc') {
    return [...filteredMemos].sort((first, second) =>
      first.createdAt.localeCompare(second.createdAt),
    )
  }

  return [...filteredMemos].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  )
}
