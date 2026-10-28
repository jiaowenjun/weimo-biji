import type { QueryClient, QueryKey } from '@tanstack/query-core'

export const WORKSPACE_CACHE_STALE_TIME_MS = 600_000
export const WORKSPACE_CACHE_GC_TIME_MS = 30 * 60_000

export type WorkspaceDateFilter =
  | { kind: 'day'; year: number; month: number; day: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }

export type WorkspaceListFilters = {
  tag?: string
  text?: { contains?: string }
  created_at?: WorkspaceDateFilter
  has_markdown_quote?: boolean
  has_heading?: boolean
  has_unordered_list?: boolean
  has_no_tag?: boolean
}

export type WorkspaceListItem = {
  id: number
  /** 内容载荷不限定形状(markdown 文本 / WDF 文档等),内容级过滤由消费方注入 */
  content: unknown
  createdAt: string
  updatedAt: string
  tags: string[]
}

export type WorkspaceListPage<Item> = {
  items: Item[]
  nextCursor: string | null
  hasMore: boolean
  totalCount: number
}

type WorkspaceListData<Page> = {
  pages: Page[]
  pageParams: unknown[]
}

type WorkspaceListCacheCoreOptions<
  Item extends WorkspaceListItem,
  Filters extends WorkspaceListFilters,
> = {
  isItem: (value: unknown) => value is Item
  filtersFromQueryKey: (queryKey: QueryKey) => Filters
  matchesFilters: (item: Item, filters: Filters) => boolean
}

type ItemTransform<Item> = (item: Item) => Item | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isWorkspaceListPage<Item>(
  value: unknown,
  isItem: (value: unknown) => value is Item,
): value is WorkspaceListPage<Item> {
  if (!isRecord(value)) return false

  return (
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    typeof value.hasMore === 'boolean' &&
    typeof value.totalCount === 'number'
  )
}

function isWorkspaceListData<Item>(
  value: unknown,
  isItem: (value: unknown) => value is Item,
): value is WorkspaceListData<WorkspaceListPage<Item>> {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    value.pages.every((page) => isWorkspaceListPage(page, isItem))
  )
}

function matchesDateFilter(item: WorkspaceListItem, filter?: WorkspaceDateFilter) {
  if (!filter) return true

  const date = new Date(item.createdAt)
  if (Number.isNaN(date.getTime())) return false

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (filter.kind === 'day') {
    return year === filter.year && month === filter.month && day === filter.day
  }
  if (filter.kind === 'month') {
    return year === filter.year && month === filter.month
  }

  return year === filter.year
}

/**
 * 标签/日期/未标签过滤之外的内容级过滤(正文检索、块类型、批注等)
 * 一律由 matchesAdditionalFilters 注入;核心不再假设内容形状。
 */
export function workspaceItemMatchesFilters<
  Item extends WorkspaceListItem,
  Filters extends WorkspaceListFilters,
>(
  item: Item,
  filters: Filters,
  matchesAdditionalFilters: (item: Item, filters: Filters) => boolean = () => true,
) {
  const tag = filters.tag?.trim()

  return (
    (!tag || item.tags.some((itemTag) => itemTag === tag || itemTag.startsWith(`${tag}/`))) &&
    matchesDateFilter(item, filters.created_at) &&
    (!filters.has_no_tag || item.tags.length === 0) &&
    matchesAdditionalFilters(item, filters)
  )
}

function remapTagPath(tag: string, oldTag: string, newTag: string) {
  if (tag === oldTag) return newTag
  const prefix = `${oldTag}/`
  return tag.startsWith(prefix) ? `${newTag}${tag.slice(oldTag.length)}` : tag
}

export function createWorkspaceListCacheCore<
  Item extends WorkspaceListItem,
  Filters extends WorkspaceListFilters,
>(options: WorkspaceListCacheCoreOptions<Item, Filters>) {
  const collect = (queryClient: QueryClient, prefix: QueryKey): Item[] => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: prefix })
    const itemsById = new Map<number, Item>()

    for (const query of queries) {
      const data = query.state.data
      if (!isWorkspaceListData(data, options.isItem)) continue
      for (const page of data.pages) {
        for (const item of page.items) itemsById.set(item.id, item)
      }
    }

    return Array.from(itemsById.values())
  }

  const transform = (
    queryClient: QueryClient,
    prefix: QueryKey,
    transformItem: ItemTransform<Item>,
  ) => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: prefix })

    for (const query of queries) {
      const filters = options.filtersFromQueryKey(query.queryKey)
      queryClient.setQueryData<WorkspaceListData<WorkspaceListPage<Item>>>(
        query.queryKey,
        (data) => {
          if (!data) return data

          let changed = false
          let removedCount = 0
          const pages = data.pages.map((page) => {
            let pageChanged = false
            const items: Item[] = []

            for (const item of page.items) {
              const nextItem = transformItem(item)
              if (!nextItem || !options.matchesFilters(nextItem, filters)) {
                pageChanged = true
                removedCount += 1
                continue
              }

              if (nextItem !== item) pageChanged = true
              items.push(nextItem)
            }

            if (!pageChanged) return page
            changed = true
            return { ...page, items }
          })

          if (!changed) return data
          return {
            ...data,
            pages: removedCount === 0
              ? pages
              : pages.map((page) => ({
                  ...page,
                  totalCount: Math.max(page.totalCount - removedCount, 0),
                })),
          }
        },
      )
    }
  }

  return {
    collect,
    transform,
    syncRenamedTag(
      queryClient: QueryClient,
      prefix: QueryKey,
      oldTag: string,
      newTag: string,
    ) {
      transform(queryClient, prefix, (item) => {
        const tags = Array.from(
          new Set(item.tags.map((tag) => remapTagPath(tag, oldTag, newTag))),
        )
        const changed = tags.length !== item.tags.length ||
          tags.some((tag, index) => tag !== item.tags[index])

        return changed ? { ...item, tags } : item
      })
    },
    syncDeletedTag(queryClient: QueryClient, prefix: QueryKey, deletedTag: string) {
      const deletedPrefix = `${deletedTag}/`
      transform(queryClient, prefix, (item) => {
        const tags = item.tags.filter((tag) =>
          tag !== deletedTag && !tag.startsWith(deletedPrefix),
        )
        return tags.length === item.tags.length ? item : { ...item, tags }
      })
    },
    removeById(queryClient: QueryClient, prefix: QueryKey, id: number) {
      transform(queryClient, prefix, (item) => item.id === id ? undefined : item)
    },
  }
}

export async function invalidateWorkspaceCollections(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
) {
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}
