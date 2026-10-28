import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QueryClient } from '@tanstack/react-query'

const root = fileURLToPath(new URL('..', import.meta.url))

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const workspaceCacheSource = readProjectFile(
  'src/features/workspace/workspace-cache.ts',
)

const {
  WORKSPACE_CACHE_GC_TIME_MS,
  WORKSPACE_CACHE_STALE_TIME_MS,
  invalidateWorkspaceCollections,
  collectWorkspaceMemoListCacheMemos,
  createWorkspaceMemoCacheIndex,
  memoMatchesFilters,
  syncDeletedTagInWorkspaceCache,
  syncRenamedTagInWorkspaceCache,
} = await import('../src/features/workspace/workspace-cache.ts')

const MEMO_LIST_PAGE_SIZE = 8

function memoListKey(scope, filters) {
  return [
    'workspace',
    scope,
    'memos',
    'list',
    {
      pageSize: MEMO_LIST_PAGE_SIZE,
      filters,
    },
  ]
}

function wdfDocument(text) {
  return {
    schema: 'weimo.document',
    version: 1,
    root: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  }
}

function makeMemo(id, tags, content = `memo-${id}`) {
  return {
    id,
    content: wdfDocument(content),
    tags,
    createdAt: '2026-06-20T02:00:00.000Z',
    updatedAt: '2026-06-20T02:00:00.000Z',
    refs: [],
    referencedBy: [],
  }
}

function makeInfinitePage(items, totalCount = items.length) {
  return {
    pageParams: [null],
    pages: [
      {
        items,
        nextCursor: null,
        hasMore: false,
        totalCount,
      },
    ],
  }
}

assert.equal(WORKSPACE_CACHE_STALE_TIME_MS, 600_000)
assert.ok(
  WORKSPACE_CACHE_GC_TIME_MS > WORKSPACE_CACHE_STALE_TIME_MS,
  'inactive cached tag lists must live longer than the fresh window so switching tags back does not repeat API calls before staleTime.',
)

assert.equal(memoMatchesFilters(makeMemo(1, ['开发/调试']), { tag: '开发' }), true)
assert.equal(memoMatchesFilters(makeMemo(1, ['开发/调试']), { tag: '文学' }), false)
assert.equal(memoMatchesFilters(makeMemo(1, []), { has_no_tag: true }), true)
assert.equal(memoMatchesFilters(makeMemo(1, ['开发']), { has_no_tag: true }), false)
assert.equal(
  memoMatchesFilters(
    {
      ...makeMemo(1, ['开发']),
      createdAt: '2026-06-19T16:30:00.000Z',
      content: wdfDocument('React Query 缓存记录'),
    },
    {
      created_at: { kind: 'day', year: 2026, month: 6, day: 20 },
      text: { contains: '缓存' },
      tag: '开发',
    },
  ),
  true,
)

const queryClient = new QueryClient()
const scope = 'tester'
const selfOwner = { kind: 'self', scope }
const allKey = memoListKey(scope, {})
const oldTagKey = memoListKey(scope, {
  tag: '开发',
})
const newTagKey = memoListKey(scope, {
  tag: '归档',
})
const noTagKey = memoListKey(scope, {
  has_no_tag: true,
})
const otherScopeKey = memoListKey('other', {})

const nestedMemo = makeMemo(1, ['开发/调试'])
const siblingMemo = makeMemo(2, ['文学'])
queryClient.setQueryData(allKey, makeInfinitePage([nestedMemo, siblingMemo], 2))
queryClient.setQueryData(oldTagKey, makeInfinitePage([nestedMemo], 1))
queryClient.setQueryData(newTagKey, makeInfinitePage([], 0))
queryClient.setQueryData(noTagKey, makeInfinitePage([], 0))
queryClient.setQueryData(otherScopeKey, makeInfinitePage([makeMemo(99, [])], 1))

syncRenamedTagInWorkspaceCache(queryClient, scope, '开发', '归档')

assert.deepEqual(
  queryClient.getQueryData(allKey).pages[0].items.map((memo) => memo.tags),
  [['归档/调试'], ['文学']],
)
assert.deepEqual(queryClient.getQueryData(oldTagKey).pages[0].items, [])
assert.equal(queryClient.getQueryData(oldTagKey).pages[0].totalCount, 0)
assert.deepEqual(
  queryClient.getQueryData(newTagKey).pages[0].items,
  [],
  'cache sync should not invent rows in a cached target-tag list; invalidation/refetch can fill lists that did not already contain the memo.',
)

const renameCollisionKey = memoListKey(scope, {
  text: { contains: 'rename-collision' },
})
queryClient.setQueryData(
  renameCollisionKey,
  makeInfinitePage([makeMemo(3, ['开发', '归档'], 'rename-collision')], 1),
)
syncRenamedTagInWorkspaceCache(queryClient, scope, '开发', '归档')
assert.deepEqual(
  queryClient.getQueryData(renameCollisionKey).pages[0].items[0].tags,
  ['归档'],
  'renaming into an existing tag must not leave duplicate chips in the optimistic cache.',
)

syncDeletedTagInWorkspaceCache(queryClient, scope, '归档')

assert.deepEqual(
  queryClient.getQueryData(allKey).pages[0].items.map((memo) => ({
    id: memo.id,
    tags: memo.tags,
  })),
  [
    { id: 1, tags: [] },
    { id: 2, tags: ['文学'] },
  ],
)
assert.deepEqual(queryClient.getQueryData(oldTagKey).pages[0].items, [])
assert.deepEqual(queryClient.getQueryData(newTagKey).pages[0].items, [])
assert.deepEqual(
  queryClient.getQueryData(noTagKey).pages[0].items,
  [],
  'cache sync should not append newly untagged memos into an already cached no-tag list that never loaded them.',
)

const referenceSourceMemo = {
  ...makeMemo(100, ['归档'], '缓存里的被引用正文'),
  createdAt: '2026-06-18T06:00:00.000Z',
}
const quotingMemo = {
  ...makeMemo(101, ['开发'], '当前列表里的引用笔记'),
  refs: ['100'],
}
const archivedKey = memoListKey(scope, { tag: '归档' })
const activeKey = memoListKey(scope, { tag: '开发' })
queryClient.setQueryData(archivedKey, makeInfinitePage([referenceSourceMemo], 1))
queryClient.setQueryData(activeKey, makeInfinitePage([quotingMemo], 1))

assert.deepEqual(
  collectWorkspaceMemoListCacheMemos(queryClient, selfOwner)
    .map((memo) => memo.id)
    .sort((left, right) => left - right),
  [1, 2, 3, 100, 101],
  'memo preview cache should scan every cached memo-list query under the same workspace scope.',
)

const memoCacheIndex = createWorkspaceMemoCacheIndex(queryClient, selfOwner)
assert.deepEqual(
  memoCacheIndex.getMemoById(100)?.content,
  wdfDocument('缓存里的被引用正文'),
  'memo-id lookup should resolve memos from cached lists outside the current tag.',
)

const statsKey = ['workspace', scope, 'stats']
const tagTreeKey = ['workspace', scope, 'tag-tree']
queryClient.setQueryData(statsKey, { note_count: 1 })
queryClient.setQueryData(tagTreeKey, { tag: '', children: [] })
await invalidateWorkspaceCollections(queryClient, scope)
assert.equal(queryClient.getQueryState(allKey).isInvalidated, true)
assert.equal(queryClient.getQueryState(statsKey).isInvalidated, true)
assert.equal(queryClient.getQueryState(tagTreeKey).isInvalidated, true)
assert.equal(
  queryClient.getQueryState(otherScopeKey).isInvalidated,
  false,
  'workspace invalidation must not invalidate another user scope.',
)
assert.equal(
  memoCacheIndex.getSummaryCache() instanceof Map,
  true,
  'memo preview cache should expose a memo-id to summary cache for derived reference text.',
)

for (const snippet of [
  'WORKSPACE_CACHE_STALE_TIME_MS',
  'WORKSPACE_CACHE_GC_TIME_MS',
  'gcTime: WORKSPACE_CACHE_GC_TIME_MS',
  'syncRenamedTagInWorkspaceCache(queryClient, scope, input.oldTag, input.newTag)',
  'syncDeletedTagInWorkspaceCache(queryClient, scope, input.tag)',
  'queryKey: workspaceQueryKeys.tagTree(scope)',
]) {
  assert.ok(
    workspaceQueriesSource.includes(snippet),
    `workspace queries must wire cache helpers: ${snippet}`,
  )
}

for (const snippet of [
  'export function collectWorkspaceMemoListCacheMemos',
  'export function createWorkspaceMemoCacheIndex',
  'export async function invalidateWorkspaceCollections',
  'summaryCache',
  'getMemoById(id: number)',
  'getSummaryCache()',
]) {
  assert.ok(
    workspaceCacheSource.includes(snippet),
    `workspace cache must expose reference preview cache helper: ${snippet}`,
  )
}

assert.ok(
  !workspaceQueriesSource.includes(
    'queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.scope(scope) })',
  ),
  'workspace mutations must not invalidate the whole workspace scope because that marks cached tag lists stale and causes repeated API calls when switching back.',
)

assert.equal(
  workspaceQueriesSource.includes('queryClient.invalidateQueries'),
  false,
  'workspace mutation hooks must use the centralized collection invalidation policy.',
)
