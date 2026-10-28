import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const uiRoot = join(root, 'node_modules/weimo-ui')

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

function readUiFile(relativePath) {
  const absolutePath = join(uiRoot, relativePath)

  assert.ok(existsSync(absolutePath), `installed weimo-ui/${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

const packageJson = JSON.parse(readProjectFile('package.json'))
const workspaceTypesSource = readProjectFile(
  'src/features/workspace/workspace-types.ts',
)
const workspaceApiSource = readProjectFile(
  'src/features/workspace/workspace-api.ts',
)
const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const workspaceMemoDisplaySource = readProjectFile(
  'src/features/workspace/workspace-memo-display.ts',
)
const memoDataSource = readProjectFile('src/features/workspace/memo-data.ts')
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const infiniteListSentinelHookSource = readUiFile('src/lib/use-infinite-list-sentinel.ts')
assert.ok(
  workspacePageSource.includes(
    'useMemoDisplayOverrides(rawMemoCards, `self:${workspaceQueryScope}`)',
  ) && workspacePageSource.includes('trackMemoDisplayOverride('),
  'workspace page must route memo saves through the scoped display override controller.',
)
assert.ok(
  workspaceMemoDisplaySource.includes('export function useMemoDisplayOverrides(') &&
    workspaceMemoDisplaySource.includes('trackScopedDisplayOverrideOperation,') &&
    workspaceMemoDisplaySource.includes(
      'return trackScopedDisplayOverrideOperation(',
    ),
  'display override controller must delegate settlement cleanup to workspace-core.',
)
const indexCssSource = readProjectFile('src/index.css')

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-memo-list-contract.test.mjs',
  ) &&
    packageJson.scripts?.test?.includes(
      'node scripts/workspace-memo-list-adapter.test.mjs',
    ) &&
    packageJson.scripts?.test?.includes(
      'node scripts/workspace-navigation-store.test.mjs',
    ),
  'package test script must run memo-list contract, adapter, and navigation store tests.',
)
assert.ok(
  packageJson.dependencies?.zustand,
  'biji-react must depend on zustand for workspace navigation state.',
)
assert.equal(
  packageJson.dependencies?.['@weimo/workspace-core'],
  'workspace:*',
  'biji-react must consume the headless workspace-core package.',
)

for (const snippet of [
  'export type MemoRefId = string',
  'export type MemoUtcArray = [',
  'export interface MemoDto',
  'ct_utc: MemoUtcArray',
  'mt_utc: MemoUtcArray',
  'refs?: MemoRefId[]',
  'referenced_by?: MemoRefId[]',
  'export interface MemoSearchPageDto',
  'next_cursor: string | null',
  'has_more: boolean',
  'total_count: number',
  'export interface Memo',
  'createdAt: string',
  'updatedAt: string',
  'referencedBy: MemoRefId[]',
  'export interface MemoSearchPage',
  'nextCursor: string | null',
  'hasMore: boolean',
  'totalCount: number',
  'export interface MemoWriteRequest',
  'content: WdfDocument',
  'refs?: MemoRefId[]',
  'export interface MemoSearchQuery',
  "created_at_sort?: 'asc' | 'desc'",
]) {
  assert.ok(
    workspaceTypesSource.includes(snippet),
    `workspace memo types must include ${snippet}`,
  )
}

for (const snippet of [
  'memoSearchPageDtoSchema',
  'function buildMemoSearchPayload',
  'page_size: pageSize',
  'payload.cursor = cursor',
  'payload.created_at = filters.created_at',
  'payload.tag = filters.tag',
  'payload.text = { contains: filters.text.contains }',
  'payload.has_annotation = true',
  'payload.has_markdown_quote = true',
  'payload.has_heading = true',
  'payload.has_unordered_list = true',
  'payload.has_no_tag = true',
  "payload.created_at_sort = 'asc'",
  'export function searchMemos',
  "('/memo/search', token, memoSearchPageDtoSchema, {",
  "method: 'POST'",
  'body: JSON.stringify(payload)',
  'export function updateMemo',
  'payload: MemoWriteRequest',
  "(`/memo/${id}`, token, mutationIdSchema, {",
  "method: 'PUT'",
  'body: JSON.stringify(payload)',
]) {
  assert.ok(
    workspaceApiSource.includes(snippet),
    `workspace API must include ${snippet}`,
  )
}

for (const snippet of [
  'export function memoUtcArrayToIso',
  'export function mapMemo',
  'export function mapMemoSearchPage',
  'export function mergeMemoSearchPages',
  'const lastPage = pages[pages.length - 1]',
  'items: pages.flatMap((page) => page.items)',
  'export function formatMemoTimestamp',
  'export function toCardNote',
  'createdAtText: formatMemoTimestamp(memo.createdAt)',
  'tags: tags.length > 0 ? tags : undefined',
]) {
  assert.ok(
    memoDataSource.includes(snippet),
    `memo-data adapter must include ${snippet}`,
  )
}

for (const snippet of [
  'export type MemoDisplayOverrides',
  'export type ScopedMemoDisplayOverrides',
  'export function getMemoDisplayOverridesForScope',
  'export function setScopedMemoDisplayOverride',
  'export function removeScopedMemoDisplayOverride',
  'export function applyMemoDisplayOverrides',
  'export function removeMemoDisplayOverride',
  'applyDisplayOverrides,',
  'removeDisplayOverride,',
  'removeScopedDisplayOverride,',
  "from '@weimo/workspace-core/display-overrides'",
]) {
  assert.ok(
    workspaceMemoDisplaySource.includes(snippet),
    `workspace memo display helper must include ${snippet}`,
  )
}

for (const snippet of [
  "import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'",
  "mergeMemoSearchPages } from './memo-data'",
  'export const MEMO_LIST_PAGE_SIZE = 8',
  'memoList: (',
  "'memos'",
  "'list'",
  'pageSize',
  'filters',
  'scope: (scope: string) => [...workspaceQueryKeys.all, scope] as const',
  'memoLists: (scope: string) =>',
  'export function useMemoListQuery',
  'useInfiniteQuery({',
  'initialPageParam: null as string | null',
  'queryFn: async ({ pageParam }) =>',
  'searchMemos(token, filters, pageParam, MEMO_LIST_PAGE_SIZE)',
  'getNextPageParam: (lastPage) =>',
  'lastPage.hasMore && lastPage.nextCursor',
  'select: (data) => mergeMemoSearchPages(data.pages)',
  'mapMemoSearchPage(result.data)',
  'export function useUpdateMemoMutation',
  'updateMemo(token, input.id, input.payload)',
  'onSuccess: async () =>',
  'invalidateWorkspaceCollections(queryClient, scope)',
  'enabled',
  'gcTime: WORKSPACE_CACHE_GC_TIME_MS',
  'staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS',
]) {
  assert.ok(
    workspaceQueriesSource.includes(snippet),
    `workspace queries must include memo-list snippet ${snippet}`,
  )
}

for (const snippet of [
  "import { Button } from '@/components/ui/button'",
  "import type { CardDraft } from '@/components/note-card'",
  'buildMemoReferencePreviews,',
  'createMemoReferencePreviewResolver,',
  'toCardNote,',
  "} from '@/features/workspace/memo-data'",
  'createWorkspaceMemoCacheIndex,',
  'type WorkspaceMemoCacheOwner,',
  "import { RefCard } from '@/components/ref-card'",
  "import { useMemoDisplayOverrides } from '@/features/workspace/workspace-memo-display'",
  "import { useCallback, useMemo, useState } from 'react'",
  "import { useInfiniteListSentinel } from 'weimo-ui/lib/use-infinite-list-sentinel'",
  "useWorkspacePageNavigation",
  "resetWorkspaceNavigation",
  'getWorkspaceQueryScope',
  'useUpdateMemoMutation',
  'const EMPTY_MEMO_CARDS',
  'const loadMoreSentinelRef = useInfiniteListSentinel({',
  'const { filters: memoFilters, navigation } = useWorkspacePageNavigation()',
  'selectFacet',
  'useMemoListQuery(memoFilters)',
  'const updateMemoMutation = useUpdateMemoMutation()',
  'const {',
  'fetchNextPage,',
  'hasNextPage,',
  'isFetchNextPageError,',
  'isFetchingNextPage,',
  'const rawMemoCards = memoListQuery.data?.items ?? EMPTY_MEMO_CARDS',
  'const totalMemoCount = memoListQuery.data?.totalCount ?? 0',
  'useMemoDisplayOverrides(rawMemoCards, `self:${workspaceQueryScope}`)',
  'const memoById = useMemo(',
  'new Map(memoCards.map((memo) => [memo.id, memo]))',
  '[memoCards]',
  'const workspaceQueryScope = getWorkspaceQueryScope(user)',
  'const workspaceMemoCacheIndex = useMemo(',
  'createWorkspaceMemoCacheIndex(queryClient, memoCacheOwner, rawMemoCards)',
  'const referencePreviewResolver = useMemo(',
  'const cachedMemo = workspaceMemoCacheIndex.getMemoById(id)',
  'summaryCache: workspaceMemoCacheIndex.getSummaryCache()',
  'const treeTagOptions = toTagOptions(tagTreeQuery.data)',
  'const memoTagOptions = memoCards.flatMap((memo) => memo.tags)',
  'new Set([...treeTagOptions, ...memoTagOptions])',
  'onLoadMore: fetchNextPage',
  'hasNextPage',
  'isFetchingNextPage',
  'isFetchNextPageError',
  'memoListQuery.isPending && !hasVisibleMemoCards',
  'memoListQuery.isError && !hasVisibleMemoCards',
  'void memoListQuery.refetch()',
  'resetWorkspaceNavigation()',
  'const handleMemoSave = useCallback((memo: Memo, draft: CardDraft) => {',
  'const content = draft.content',
  'if (isWdfDocumentEmpty(content)) return',
  'const tags = [...draft.tags]',
  'trackMemoDisplayOverride(',
  '() => updateMemoMutation.mutateAsync(',
  '{',
  'id: memo.id',
  'payload: { content, tags, refs: [...memo.refs] }',
  'tags,',
  'memoCards.map((memo) => {',
  'const referencePreviews = buildMemoReferencePreviews(',
  'referencePreviewResolver,',
  '<RefCard',
  'note={toCardNote(memo)}',
  "onSave={(draft) => handleMemoSave(memo, draft)}",
  'onTagClick={navigation.selectTag}',
  'referencePreview={referencePreviews.referencePreview}',
  'referencedByPreviews={referencePreviews.referencedByPreviews}',
  'tagOptions={tagOptions}',
  'ref={loadMoreSentinelRef}',
  'className="memo-list-load-more-sentinel"',
  '正在加载更多笔记...',
  '重试加载更多',
  '已加载全部笔记',
  'totalMemoCount > 0',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must include memo-list snippet ${snippet}`,
  )
}

assert.ok(
  infiniteListSentinelHookSource.includes('export function useInfiniteListSentinel({') &&
    !workspacePageSource.includes('new IntersectionObserver'),
  'workspace page must delegate pagination observation to the shared sentinel hook.',
)

assert.ok(
  !workspaceMemoDisplaySource.includes('dropSyncedMemoDisplayOverrides') &&
    !workspacePageSource.includes('dropSyncedMemoDisplayOverrides'),
  'memo display state must be cleared on mutation settlement instead of hidden during render.',
)

for (const mutationName of ['createMemoMutation', 'deleteMemoMutation']) {
  assert.ok(
    !workspacePageSource.includes(`${mutationName}.mutate(`),
    `${mutationName} callbacks must be attached to its specific mutateAsync promise.`,
  )
}

for (const staleSnippet of [
  'type MemoCard',
  'const memoCards: MemoCard[]',
  'useState(memoCards)',
  'saveMemo',
  '<Card\n                    disabled',
  'Editing is enabled for interaction parity, but persistence is not wired yet.',
  'const handleMemoSave = useCallback(() => {',
  'onSave={handleMemoSave}',
  'component-library-demo',
  'responsive-content-width',
  'Demo 终于像一套组件库',
  '已显示前',
  "import { applyOptimisticMemoUpdate, type UpdateMemoMutationInput } from './workspace-memo-cache'",
  'onMutate: async (input: UpdateMemoMutationInput) =>',
  'queryClient.setQueryData(queryKey, applyOptimisticMemoUpdate(page, input))',
]) {
  assert.ok(
    !workspacePageSource.includes(staleSnippet),
    `workspace page must remove local editable sample memo data: ${staleSnippet}`,
  )
}

for (const snippet of [
  '.memo-list-state',
  '.memo-list-state__action',
  '.memo-list-skeleton',
  '.memo-list-footer',
  '.memo-list-footer__action',
  '.memo-list-load-more-sentinel',
]) {
  assert.ok(indexCssSource.includes(snippet), `index.css must include ${snippet}`)
}
