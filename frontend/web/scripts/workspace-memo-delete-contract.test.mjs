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

const packageJson = JSON.parse(readProjectFile('package.json'))
const workspaceApiSource = readProjectFile(
  'src/features/workspace/workspace-api.ts',
)
const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const deleteMutationSource = workspaceQueriesSource.slice(
  workspaceQueriesSource.indexOf('export function useDeleteMemoMutation()'),
  workspaceQueriesSource.indexOf('export function useRenameTagMutation()'),
)
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const refCardSource = readProjectFile('src/components/ref-card.tsx')

const {
  removeMemoFromWorkspaceCache,
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

function makeMemo(id, overrides = {}) {
  return {
    id,
    content: `memo-${id}`,
    tags: [],
    createdAt: '2026-06-20T02:00:00.000Z',
    updatedAt: '2026-06-20T02:00:00.000Z',
    refs: [],
    referencedBy: [],
    ...overrides,
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

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-memo-delete-contract.test.mjs',
  ),
  'package test script must run the memo delete contract.',
)

for (const snippet of [
  'export function deleteMemo(',
  'id: number',
  'requestProtectedJson(`/memo/${id}`, token, mutationIdSchema, {',
  "method: 'DELETE'",
]) {
  assert.ok(
    workspaceApiSource.includes(snippet),
    `workspace API must implement Skyline-compatible memo delete service: ${snippet}`,
  )
}

for (const snippet of [
  'export function useDeleteMemoMutation()',
  'mutationFn: async (input: { id: number })',
  'await deleteMemo(token, input.id)',
  'removeMemoFromWorkspaceCache(queryClient, scope, input.id)',
  'invalidateWorkspaceCollections(queryClient, scope)',
]) {
  assert.ok(
    deleteMutationSource.includes(snippet),
    `workspace queries must expose a delete memo mutation and refresh aggregates: ${snippet}`,
  )
}

const queryClient = new QueryClient()
const scope = 'tester'
const allKey = memoListKey(scope, {})
const tagKey = memoListKey(scope, { tag: '开发' })
const otherScopeKey = memoListKey('other', {})
const referrer = makeMemo(1, { refs: ['2', 'bob/2'] })
const deleted = makeMemo(2, { tags: ['开发'], refs: ['4'], referencedBy: ['1'] })
const referenced = makeMemo(4, { referencedBy: ['2', '9', 'bob/2'] })

queryClient.setQueryData(allKey, makeInfinitePage([referrer, deleted, referenced], 3))
queryClient.setQueryData(tagKey, makeInfinitePage([deleted], 1))
queryClient.setQueryData(otherScopeKey, makeInfinitePage([deleted], 1))

removeMemoFromWorkspaceCache(queryClient, scope, 2)

assert.deepEqual(
  queryClient.getQueryData(allKey).pages[0].items.map((memo) => ({
    id: memo.id,
    refs: memo.refs,
    referencedBy: memo.referencedBy,
  })),
  [
    { id: 1, refs: ['bob/2'], referencedBy: [] },
    { id: 4, refs: [], referencedBy: ['9', 'bob/2'] },
  ],
  'memo delete cache sync must remove the deleted memo and prune only same-owner ref ids from cached memos.',
)
assert.equal(queryClient.getQueryData(allKey).pages[0].totalCount, 2)
assert.deepEqual(queryClient.getQueryData(tagKey).pages[0].items, [])
assert.equal(queryClient.getQueryData(tagKey).pages[0].totalCount, 0)
assert.deepEqual(
  queryClient.getQueryData(otherScopeKey).pages[0].items.map((memo) => memo.id),
  [2],
  'memo delete cache sync must stay inside the authenticated workspace scope.',
)

// 删除入口随 monolith Card 退役移至 biji 的 RefCard 菜单末项
for (const snippet of [
  "key: 'delete'",
  "label: '删除'",
  '<Trash2 aria-hidden="true" />',
  "variant: 'destructive'",
  'onSelect: onDelete',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must append a destructive delete menu item: ${snippet}`,
  )
}

for (const snippet of [
  'useDeleteMemoMutation',
  'const deleteMemoMutation = useDeleteMemoMutation()',
  'const handleMemoDelete = useCallback((memo: Memo) => {',
  "window.confirm('确定删除这条笔记吗？删除后不可恢复。')",
  'deleteMemoMutation.mutateAsync',
  'id: memo.id',
  'removeMemoDisplayOverride(memo.id)',
  "window.alert(error instanceof Error ? error.message : '删除笔记失败')",
  "onDelete={() => handleMemoDelete(memo)}",
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must confirm and apply memo deletes: ${snippet}`,
  )
}

for (const snippet of [
  'const handleMemoDelete = useCallback((memo: Memo) => {',
  "window.confirm('确定删除这条笔记吗？删除后不可恢复。')",
  'currentMemos.filter((currentMemo) => currentMemo.id !== memo.id)',
  'onDelete={() => handleMemoDelete(memo)}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest page must support local memo deletes for parity with Skyline visitor mode: ${snippet}`,
  )
}
