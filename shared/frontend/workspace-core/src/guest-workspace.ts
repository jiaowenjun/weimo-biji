import {
  remapExpandedTagPaths,
  remapSelectedTagPath,
} from './tag-state.ts'

export type GuestWorkspaceTaggedItem = {
  tags: string[]
}

export type GuestWorkspaceTagTree = {
  children: GuestWorkspaceTagTree[]
  item_count: number
  label: string
  tag: string
  untagged_count?: number
}

type GuestTagTreeDraft = {
  children: Map<string, GuestTagTreeDraft>
  itemCount: number
  label: string
  tag: string
}

function renameGuestTagValue(tag: string, oldTag: string, newTag: string) {
  if (tag === oldTag) return newTag

  const oldTagPrefix = `${oldTag}/`
  if (tag.startsWith(oldTagPrefix)) {
    return `${newTag}${tag.slice(oldTag.length)}`
  }

  return tag
}

function getGuestTagPrefixes(tag: string) {
  const segments = tag.split('/').filter(Boolean)
  const prefixes: string[] = []

  for (let index = 0; index < segments.length; index += 1) {
    prefixes.push(segments.slice(0, index + 1).join('/'))
  }

  return prefixes
}

export function getGuestTagAncestorPaths(tag: string) {
  return getGuestTagPrefixes(tag).slice(0, -1)
}

function getGuestTagLabel(tag: string) {
  const segments = tag.split('/').filter(Boolean)

  return segments.at(-1) ?? tag
}

function createGuestTagTreeDraft(tag: string): GuestTagTreeDraft {
  return {
    children: new Map(),
    itemCount: 0,
    label: tag ? getGuestTagLabel(tag) : '全部标签',
    tag,
  }
}

function collectRenamedTagTreeOrder(
  tagTree: GuestWorkspaceTagTree,
  oldTag: string,
  newTag: string,
) {
  const orderedTags: string[] = []
  const seenTags = new Set<string>()

  function visitNode(node: GuestWorkspaceTagTree) {
    const renamedTag = renameGuestTagValue(node.tag, oldTag, newTag)

    for (const prefix of getGuestTagPrefixes(renamedTag)) {
      if (seenTags.has(prefix)) continue

      seenTags.add(prefix)
      orderedTags.push(prefix)
    }

    for (const child of node.children) visitNode(child)
  }

  for (const child of tagTree.children) visitNode(child)

  return orderedTags
}

function collectGuestTagCounts<Item extends GuestWorkspaceTaggedItem>(items: Item[]) {
  const tagCounts = new Map<string, number>()

  for (const item of items) {
    const itemTagPrefixes = new Set<string>()

    for (const tag of item.tags) {
      for (const prefix of getGuestTagPrefixes(tag)) itemTagPrefixes.add(prefix)
    }

    for (const prefix of itemTagPrefixes) {
      tagCounts.set(prefix, (tagCounts.get(prefix) ?? 0) + 1)
    }
  }

  return tagCounts
}

function insertGuestTagTreePath(
  root: GuestTagTreeDraft,
  tag: string,
  tagCounts: Map<string, number>,
) {
  const segments = tag.split('/').filter(Boolean)
  let currentNode = root

  for (let index = 0; index < segments.length; index += 1) {
    const nodeTag = segments.slice(0, index + 1).join('/')
    let childNode = currentNode.children.get(nodeTag)

    if (!childNode) {
      childNode = createGuestTagTreeDraft(nodeTag)
      currentNode.children.set(nodeTag, childNode)
    }

    childNode.itemCount = tagCounts.get(nodeTag) ?? 0
    currentNode = childNode
  }
}

function toGuestWorkspaceTagTree(draft: GuestTagTreeDraft): GuestWorkspaceTagTree {
  return {
    children: Array.from(draft.children.values()).map(toGuestWorkspaceTagTree),
    item_count: draft.itemCount,
    label: draft.label,
    tag: draft.tag,
  }
}

export function buildGuestWorkspaceTagTree<Item extends GuestWorkspaceTaggedItem>(
  items: Item[],
  orderedTags: string[],
): GuestWorkspaceTagTree {
  const root = createGuestTagTreeDraft('')
  const tagCounts = collectGuestTagCounts(items)
  const itemTags = new Set(items.flatMap((item) => item.tags))
  const insertedTags = new Set<string>()

  for (const tag of orderedTags) {
    if (!tagCounts.has(tag)) continue

    insertGuestTagTreePath(root, tag, tagCounts)
    insertedTags.add(tag)
  }

  for (const tag of itemTags) {
    if (!insertedTags.has(tag)) insertGuestTagTreePath(root, tag, tagCounts)
  }

  return {
    ...toGuestWorkspaceTagTree(root),
    item_count: items.length,
    untagged_count: items.filter((item) => item.tags.length === 0).length,
  }
}

export function renameGuestWorkspaceItems<Item extends GuestWorkspaceTaggedItem>(
  items: Item[],
  oldTag: string,
  newTag: string,
) {
  return items.map((item) => ({
    ...item,
    tags: item.tags.map((tag) => renameGuestTagValue(tag, oldTag, newTag)),
  }))
}

export function renameGuestWorkspaceTag<Item extends GuestWorkspaceTaggedItem>({
  expandedTags,
  items,
  newTag,
  oldTag,
  selectedTag,
  tagTree,
}: {
  expandedTags: string[]
  items: Item[]
  newTag: string
  oldTag: string
  selectedTag: string
  tagTree: GuestWorkspaceTagTree
}) {
  const from = oldTag.trim()
  const to = newTag.trim()
  if (!from || !to || from === to) return null

  const renamedItems = renameGuestWorkspaceItems(items, from, to)
  const orderedTags = collectRenamedTagTreeOrder(tagTree, from, to)
  const remappedExpandedTags = remapExpandedTagPaths(expandedTags, from, to)

  return {
    expandedTags: Array.from(new Set([
      ...remappedExpandedTags,
      ...getGuestTagAncestorPaths(to),
    ])),
    items: renamedItems,
    selectedTag: remapSelectedTagPath(selectedTag, from, to),
    tagTree: buildGuestWorkspaceTagTree(renamedItems, orderedTags),
  }
}
