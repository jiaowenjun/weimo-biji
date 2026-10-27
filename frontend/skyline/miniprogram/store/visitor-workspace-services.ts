import type { Memo, MemoRefId, MemoSearchPage, MemoSearchQuery, MemoWriteRequest } from '../models/memo'
import type { TagTreeMeta } from '../models/tag'
import type { WorkspaceStats } from '../models/workspace'
import { appendMemoRefId, ownMemoIdFromRef, removeMemoRefId } from '../utils/memo-ref-id'
import { compareTagTreeMetaSiblings } from '../utils/tag-sort'
import { memoMatchesFilters } from './memo-cache-filters'
import type { WorkspaceServices, WorkspaceState } from './workspace-store'

interface MutableTagTreeNode extends TagTreeMeta {
  memoIds: Set<number>
  children: MutableTagTreeNode[]
}

function cloneMemo(memo: Memo): Memo {
  return {
    id: memo.id,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
    tags: [...memo.tags],
    content: memo.content,
    refs: [...memo.refs],
    referencedBy: [...memo.referencedBy],
  }
}

function syncVisitorBacklinks(
  memos: Map<number, Memo>,
  referrerId: number,
  previousRefs: MemoRefId[],
  nextRefs: MemoRefId[],
): void {
  const previous = new Set(previousRefs.map(ownMemoIdFromRef).filter((id): id is number => id !== null))
  const next = new Set(nextRefs.map(ownMemoIdFromRef).filter((id): id is number => id !== null))
  const affected = new Set([...previous, ...next])
  const referrerRef = String(referrerId)
  affected.forEach((memoId) => {
    const memo = memos.get(memoId)
    if (!memo) return
    let referencedBy = memo.referencedBy
    if (previous.has(memoId) && !next.has(memoId)) {
      referencedBy = removeMemoRefId(referencedBy, referrerRef)
    }
    if (next.has(memoId)) {
      referencedBy = appendMemoRefId(referencedBy, referrerRef)
    }
    if (referencedBy !== memo.referencedBy) {
      memos.set(memoId, { ...memo, referencedBy })
    }
  })
}

function seedMemos(seedState: WorkspaceState): Map<number, Memo> {
  const memos = new Map<number, Memo>()

  seedState.memos.detail.forEach((entry) => {
    memos.set(entry.memo.id, cloneMemo(entry.memo))
  })

  seedState.memos.list.forEach((entry) => {
    entry.pages.forEach((page) => {
      page.items.forEach((memo) => {
        if (!memos.has(memo.id)) {
          memos.set(memo.id, cloneMemo(memo))
        }
      })
    })
  })

  return memos
}

function sortMemosDesc(memos: Iterable<Memo>): Memo[] {
  return [...memos].sort((left, right) => {
    const timeDiff = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    if (timeDiff !== 0) return timeDiff
    return right.id - left.id
  })
}

function countWords(content: string): number {
  const trimmed = content.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function buildVisitorStats(memos: Iterable<Memo>): WorkspaceStats {
  const memoList = [...memos]
  const tags = new Set<string>()
  const dailyCounts = new Map<number, number>()
  let wordCount = 0

  memoList.forEach((memo) => {
    memo.tags.forEach((tag) => tags.add(tag))
    wordCount += countWords(memo.content)

    const date = new Date(memo.createdAt)
    if (!Number.isNaN(date.getTime())) {
      const key = (
        date.getUTCFullYear() * 10_000 +
        (date.getUTCMonth() + 1) * 100 +
        date.getUTCDate()
      )
      dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1)
    }
  })

  return {
    note_count: memoList.length,
    tag_count: tags.size,
    word_count: wordCount,
    daily_note_count: [...dailyCounts.entries()].sort((left, right) => left[0] - right[0]),
  }
}

function createTagNode(label: string, tag: string): MutableTagTreeNode {
  return {
    label,
    tag,
    item_count: 0,
    children: [],
    memoIds: new Set<number>(),
  }
}

function stripTagNode(node: MutableTagTreeNode): TagTreeMeta {
  return {
    label: node.label,
    tag: node.tag,
    item_count: node.memoIds.size,
    children: node.children
      .sort(compareTagTreeMetaSiblings)
      .map(stripTagNode),
  }
}

function buildVisitorTagTree(memos: Iterable<Memo>): TagTreeMeta {
  const root = createTagNode('root', '')
  const nodeByTag = new Map<string, MutableTagTreeNode>()

  for (const memo of memos) {
    root.memoIds.add(memo.id)
    const seenTagPrefixes = new Set<string>()
    for (const fullTag of memo.tags) {
      const parts = fullTag.split('/').filter(Boolean)
      if (parts.length === 0) continue

      let parent = root
      let currentTag = ''
      for (const part of parts) {
        currentTag = currentTag ? `${currentTag}/${part}` : part
        let node = nodeByTag.get(currentTag)
        if (!node) {
          node = createTagNode(part, currentTag)
          nodeByTag.set(currentTag, node)
          parent.children.push(node)
        }
        parent = node

        if (seenTagPrefixes.has(currentTag)) {
          continue
        }
        seenTagPrefixes.add(currentTag)
        parent.memoIds.add(memo.id)
      }
    }
  }

  return stripTagNode(root)
}

function normalizeOffset(cursor: string | null): number {
  const parsed = Number.parseInt(cursor ?? '0', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function nextVisitorMemoId(memos: Map<number, Memo>): number {
  let minId = 0
  memos.forEach((memo) => {
    if (memo.id < minId) minId = memo.id
  })
  return minId - 1
}

export function createVisitorWorkspaceServices(seedState: WorkspaceState): WorkspaceServices {
  const memos = seedMemos(seedState)
  let nextId = nextVisitorMemoId(memos)

  return {
    async searchMemos(filters: MemoSearchQuery, cursor: string | null, pageSize: number): Promise<MemoSearchPage> {
      const filtered = sortMemosDesc(
        [...memos.values()].filter((memo) => memoMatchesFilters(memo, filters)),
      )
      const offset = normalizeOffset(cursor)
      const items = filtered.slice(offset, offset + pageSize).map(cloneMemo)
      const nextOffset = offset + items.length
      const hasMore = nextOffset < filtered.length

      return {
        items,
        nextCursor: hasMore ? String(nextOffset) : null,
        hasMore,
        totalCount: filtered.length,
      }
    },

    async getMemo(id: number): Promise<Memo> {
      const memo = memos.get(id)
      if (!memo) {
        throw new Error(`Memo ${id} not found`)
      }
      return cloneMemo(memo)
    },

    async getMemos(ids: number[]): Promise<Memo[]> {
      return ids.map((id) => {
        const memo = memos.get(id)
        if (!memo) {
          throw new Error(`Memo ${id} not found`)
        }
        return cloneMemo(memo)
      })
    },

    async getWorkspaceStats(): Promise<WorkspaceStats> {
      return buildVisitorStats(memos.values())
    },

    async getTagTree(): Promise<TagTreeMeta> {
      return buildVisitorTagTree(memos.values())
    },

    async createMemo(payload: MemoWriteRequest): Promise<number> {
      const now = new Date().toISOString()
      const id = nextId
      nextId -= 1
      const refs = payload.refs ? [...payload.refs] : []
      memos.set(id, {
        id,
        content: payload.content,
        tags: [...payload.tags],
        refs,
        referencedBy: [],
        createdAt: now,
        updatedAt: now,
      })
      syncVisitorBacklinks(memos, id, [], refs)
      return id
    },

    async updateMemo(id: number, payload: MemoWriteRequest): Promise<number> {
      const current = memos.get(id)
      if (!current) {
        throw new Error(`Memo ${id} not found`)
      }

      const refs = payload.refs ? [...payload.refs] : [...current.refs]
      memos.set(id, {
        ...current,
        content: payload.content,
        tags: [...payload.tags],
        refs,
        updatedAt: new Date().toISOString(),
      })
      syncVisitorBacklinks(memos, id, current.refs, refs)
      return id
    },

    async deleteMemo(id: number): Promise<number> {
      if (!memos.has(id)) {
        throw new Error(`Memo ${id} not found`)
      }
      memos.delete(id)
      return id
    },

    async renameTag(): Promise<string> {
      throw new Error('游客模式不支持标签重命名')
    },

    async deleteTag(): Promise<void> {
      throw new Error('游客模式不支持标签删除')
    },
  }
}
