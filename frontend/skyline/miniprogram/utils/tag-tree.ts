import type { TagTreeMeta } from '../models/tag'

export interface VisibleTagTreeRow {
  tag: string
  label: string
  depth: number
  hasChildren: boolean
  expanded: boolean
  selected: boolean
  itemCount: number
}

export function resolveTagLabel(node: TagTreeMeta): string {
  const parts = node.tag.split('/')
  return node.label || parts[parts.length - 1] || node.tag || '未命名'
}

export function containsTagInTree(node: TagTreeMeta, selectedTag: string): boolean {
  if (!selectedTag) {
    return false
  }

  if (node.tag === selectedTag) {
    return true
  }

  return node.children.some((child) => containsTagInTree(child, selectedTag))
}

export function flattenTagTreeToStrings(nodes: TagTreeMeta[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    if (node.tag) {
      result.push(node.tag)
    }
    if (node.children.length > 0) {
      result.push(...flattenTagTreeToStrings(node.children))
    }
  }
  return result
}

export function buildVisibleTagTreeRows(
  nodes: TagTreeMeta[],
  expandedTags: Set<string>,
  selectedTag: string,
  depth = 0,
): VisibleTagTreeRow[] {
  const rows: VisibleTagTreeRow[] = []

  for (const node of nodes) {
    const hasChildren = node.children.length > 0
    const forcedExpanded =
      hasChildren && node.children.some((child) => containsTagInTree(child, selectedTag))
    const expanded = hasChildren && (forcedExpanded || expandedTags.has(node.tag))

    rows.push({
      tag: node.tag,
      label: resolveTagLabel(node),
      depth,
      hasChildren,
      expanded,
      selected: node.tag === selectedTag,
      itemCount: node.item_count,
    })

    if (expanded) {
      rows.push(
        ...buildVisibleTagTreeRows(node.children, expandedTags, selectedTag, depth + 1),
      )
    }
  }

  return rows
}
