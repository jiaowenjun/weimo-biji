import type { HeatmapDailyCount } from 'weimo-ui-stats/components/heatmap'
import type { StatGroupItem } from 'weimo-ui-stats/components/stat-group'
import type { TagTreeNode } from 'weimo-ui-tagtree/components/tag-tree'

export {
  remapExpandedTagPaths,
  remapSelectedTagPath,
  removeDeletedExpandedTagPaths,
  removeDeletedTagSelection,
} from '@weimo/workspace-core/tag-state'

import type { DailyNoteCount, TagTreeMeta, WorkspaceStats } from './workspace-types'

export const UNTAGGED_TAG = '__untagged__'

export function isSidebarActionableTag(tag: string) {
  return tag.trim() !== '' && tag.trim() !== UNTAGGED_TAG
}

export function toInitialCreateTags(selectedTag: string) {
  const tag = selectedTag.trim()

  return isSidebarActionableTag(tag) ? [tag] : []
}

export function formatDateInt(dateInt: number) {
  const rawDate = String(dateInt).padStart(8, '0')

  return `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
}

export function toHeatmapDailyCounts(
  dailyNoteCount: DailyNoteCount,
): HeatmapDailyCount[] {
  return dailyNoteCount.map(([date, count]) => ({
    date: formatDateInt(date),
    count,
  }))
}

export function toTagTreeNodes(nodes: TagTreeMeta[]): TagTreeNode[] {
  return nodes.map((node) => ({
    tag: node.tag,
    label: node.label,
    itemCount: node.item_count,
    children: toTagTreeNodes(node.children ?? []),
  }))
}

export function toSidebarTagTree(root: TagTreeMeta | undefined): {
  nodes: TagTreeNode[]
  untaggedCount: number
} {
  if (!root) {
    return {
      nodes: [],
      untaggedCount: 0,
    }
  }

  const untaggedCount = root.untagged_count ?? 0
  const nodes = toTagTreeNodes(root.children ?? [])

  if (untaggedCount > 0) {
    nodes.push({
      tag: UNTAGGED_TAG,
      label: '未标签',
      itemCount: untaggedCount,
      children: [],
      menuEnabled: false,
    })
  }

  return {
    nodes,
    untaggedCount,
  }
}

function appendTagOptions(
  nodes: TagTreeMeta[],
  tagOptions: string[],
  seenTags: Set<string>,
) {
  for (const node of nodes) {
    const tag = node.tag.trim()

    if (tag.length > 0 && !seenTags.has(tag)) {
      seenTags.add(tag)
      tagOptions.push(tag)
    }

    appendTagOptions(node.children ?? [], tagOptions, seenTags)
  }
}

export function toTagOptions(root: TagTreeMeta | undefined): string[] {
  if (!root) return []

  const tagOptions: string[] = []

  appendTagOptions(root.children ?? [], tagOptions, new Set())

  return tagOptions
}

export function formatTagBreadTag(tag: string) {
  if (tag === UNTAGGED_TAG) {
    return '未标签'
  }

  return tag
}

const FACET_PAGE_TITLES: Record<string, string> = {
  annotation: '有批注',
  heading: '有标题',
  'unordered-list': '有列表',
  'markdown-quote': '有引用',
}

export function formatWorkspacePageTitle(navigation: {
  activeDate: string
  selectedFacet: string
  selectedTag: string
}) {
  if (navigation.selectedTag) {
    return `标签 ${formatTagBreadTag(navigation.selectedTag)}`
  }

  if (navigation.activeDate) {
    return `${navigation.activeDate} 笔记`
  }

  const facetTitle = FACET_PAGE_TITLES[navigation.selectedFacet]

  return facetTitle ?? '全部笔记'
}


export function formatWordMetric(wordCount: number) {
  if (wordCount >= 10000) {
    return {
      value: (wordCount / 10000).toFixed(1),
      unit: '万字',
    }
  }

  return {
    value: String(wordCount),
    unit: '字',
  }
}

export function buildSidebarStatItems(
  stats: WorkspaceStats | undefined,
): StatGroupItem[] {
  if (!stats) {
    return []
  }

  const wordMetric = formatWordMetric(stats.word_count)

  return [
    { key: 'notes', value: String(stats.note_count), label: '笔记' },
    { key: 'words', value: wordMetric.value, label: wordMetric.unit },
    { key: 'days', value: String(stats.daily_note_count.length), label: '天' },
  ]
}
