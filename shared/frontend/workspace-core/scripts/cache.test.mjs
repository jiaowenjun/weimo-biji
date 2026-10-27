import assert from 'node:assert/strict'

const {
  createWorkspaceListCacheCore,
  invalidateWorkspaceCollections,
  workspaceItemMatchesFilters,
} = await import('../src/cache.ts')

function keyStartsWith(key, prefix) {
  return prefix.every((part, index) => Object.is(key[index], part))
}

class FakeQueryClient {
  data = new Map()
  invalidated = []

  getQueryCache() {
    return {
      findAll: ({ queryKey }) => Array.from(this.data, ([keyText, entry]) => ({
        queryKey: entry.queryKey,
        state: { data: entry.data },
      })).filter((query) => keyStartsWith(query.queryKey, queryKey)),
    }
  }

  setQueryData(queryKey, updater) {
    const keyText = JSON.stringify(queryKey)
    const current = this.data.get(keyText)?.data
    this.data.set(keyText, { queryKey, data: updater(current) })
  }

  getQueryData(queryKey) {
    return this.data.get(JSON.stringify(queryKey))?.data
  }

  invalidateQueries({ queryKey }) {
    this.invalidated.push(queryKey)
    return Promise.resolve()
  }
}

function makeItem(id, tags, content = `item-${id}`) {
  return {
    id,
    tags,
    content,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  }
}

function makeData(items, totalCount = items.length) {
  return {
    pageParams: [null],
    pages: [{ items, nextCursor: null, hasMore: false, totalCount }],
  }
}

function makePagedData(pages, totalCount) {
  return {
    pageParams: pages.map((_, index) => index === 0 ? null : `cursor-${index}`),
    pages: pages.map((items, index) => ({
      items,
      nextCursor: index === pages.length - 1 ? null : `cursor-${index + 1}`,
      hasMore: index < pages.length - 1,
      totalCount,
    })),
  }
}

const prefix = ['workspace', 'alice', 'items', 'list']
const key = (filters) => [...prefix, { filters }]
const isItem = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value.id === 'number' &&
  typeof value.content === 'string' && Array.isArray(value.tags)
const core = createWorkspaceListCacheCore({
  isItem,
  filtersFromQueryKey: (queryKey) => queryKey[4]?.filters ?? {},
  matchesFilters: workspaceItemMatchesFilters,
})
const queryClient = new FakeQueryClient()
const nested = makeItem(1, ['数列/单调性'])
const other = makeItem(2, ['几何'])

queryClient.setQueryData(key({}), () => makeData([nested, other], 2))
queryClient.setQueryData(key({ tag: '数列' }), () => makeData([nested], 1))
queryClient.setQueryData(key({ tag: '代数' }), () => makeData([], 0))

core.syncRenamedTag(queryClient, prefix, '数列', '代数')
assert.deepEqual(
  queryClient.getQueryData(key({})).pages[0].items[0].tags,
  ['代数/单调性'],
)
assert.deepEqual(queryClient.getQueryData(key({ tag: '数列' })).pages[0].items, [])
assert.deepEqual(
  queryClient.getQueryData(key({ tag: '代数' })).pages[0].items,
  [],
  'partial cache sync must not invent rows in a target filter.',
)

const collisionKey = key({ text: { contains: 'collision' } })
queryClient.setQueryData(
  collisionKey,
  () => makeData([makeItem(3, ['数列', '代数'], 'collision')]),
)
core.syncRenamedTag(queryClient, prefix, '数列', '代数')
assert.deepEqual(
  queryClient.getQueryData(collisionKey).pages[0].items[0].tags,
  ['代数'],
)

assert.deepEqual(
  core.collect(queryClient, prefix).map((item) => item.id).sort((a, b) => a - b),
  [1, 2, 3],
)

const pagedKey = key({ text: { contains: 'paged' } })
queryClient.setQueryData(
  pagedKey,
  () => makePagedData([
    [makeItem(4, [], 'paged keep')],
    [makeItem(5, [], 'paged remove')],
  ], 2),
)
core.removeById(queryClient, prefix, 5)
assert.deepEqual(
  queryClient.getQueryData(pagedKey).pages.map((page) => ({
    ids: page.items.map((item) => item.id),
    totalCount: page.totalCount,
  })),
  [
    { ids: [4], totalCount: 1 },
    { ids: [], totalCount: 1 },
  ],
  'every cached page must retain the same corrected global total count.',
)

await invalidateWorkspaceCollections(queryClient, [
  prefix,
  ['workspace', 'alice', 'stats'],
  ['workspace', 'alice', 'tag-tree'],
])
assert.deepEqual(queryClient.invalidated, [
  prefix,
  ['workspace', 'alice', 'stats'],
  ['workspace', 'alice', 'tag-tree'],
])
