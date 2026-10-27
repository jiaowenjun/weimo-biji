import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

const packageJson = JSON.parse(readProjectFile('package.json'))
const mainSource = readProjectFile('src/main.tsx')
const queryClientSource = readProjectFile('src/query-client.ts')
const workspaceTypesSource = readProjectFile(
  'src/features/workspace/workspace-types.ts',
)
const workspaceApiSource = readProjectFile(
  'src/features/workspace/workspace-api.ts',
)
const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const sidebarDataSource = readProjectFile(
  'src/features/workspace/sidebar-data.ts',
)
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const indexCssSource = readProjectFile('src/index.css')
const sidebarSource = readProjectFile('src/components/sidebar.tsx')
const bijiSideBarSource = readProjectFile(
  'src/components/biji-side-bar.tsx',
)

assert.equal(
  packageJson.dependencies?.['@tanstack/react-query'],
  '^5.101.0',
  'biji-react must keep TanStack React Query as the workspace sidebar cache.',
)
assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-sidebar-contract.test.mjs',
  ) &&
    packageJson.scripts?.test?.includes(
      'node scripts/workspace-sidebar-adapter.test.mjs',
    ),
  'package test script must run workspace sidebar contract and adapter tests.',
)

for (const snippet of [
  "import { QueryClientProvider } from '@tanstack/react-query'",
  "import { queryClient } from './query-client'",
  '<QueryClientProvider client={queryClient}>',
  '<App />',
  '</QueryClientProvider>',
]) {
  assert.ok(mainSource.includes(snippet), `main.tsx must include ${snippet}`)
}

for (const snippet of [
  "import { QueryClient } from '@tanstack/react-query'",
  'export const queryClient = new QueryClient',
  'refetchOnWindowFocus: false',
  'retry: 1',
]) {
  assert.ok(
    queryClientSource.includes(snippet),
    `query-client.ts must include ${snippet}`,
  )
}

for (const snippet of [
  'export type DailyNoteCount = Array<[number, number]>',
  'export interface WorkspaceStats',
  'note_count: number',
  'tag_count: number',
  'word_count: number',
  'daily_note_count: DailyNoteCount',
  'export interface TagTreeMeta',
  'item_count: number',
  'children: TagTreeMeta[]',
  'untagged_count?: number',
]) {
  assert.ok(
    workspaceTypesSource.includes(snippet),
    `workspace types must include ${snippet}`,
  )
}

for (const snippet of [
  "from '@/features/auth/auth-api'",
  "requestProtectedJson('/me/stats', token, workspaceStatsSchema)",
  "requestProtectedJson('/tag/meta', token, tagTreeMetaSchema)",
]) {
  assert.ok(
    workspaceApiSource.includes(snippet),
    `workspace API must include ${snippet}`,
  )
}

for (const snippet of [
  "import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'",
  "from '@/features/auth/use-auth'",
  'WORKSPACE_CACHE_STALE_TIME_MS',
  'export const WORKSPACE_SIDEBAR_STALE_TIME_MS = WORKSPACE_CACHE_STALE_TIME_MS',
  "all: ['workspace'] as const",
  "stats: (scope: string) => [...workspaceQueryKeys.all, scope, 'stats'] as const",
  "tagTree: (scope: string) => [...workspaceQueryKeys.all, scope, 'tag-tree'] as const",
  "status === 'authenticated' && Boolean(token)",
  'gcTime: WORKSPACE_CACHE_GC_TIME_MS',
  'staleTime: WORKSPACE_SIDEBAR_STALE_TIME_MS',
  'queryFn: async () => {',
  'return result.data',
  'queryClient.removeQueries({ queryKey: workspaceQueryKeys.all })',
]) {
  assert.ok(
    workspaceQueriesSource.includes(snippet),
    `workspace queries must include ${snippet}`,
  )
}

for (const snippet of [
  "from 'weimo-ui/components/heatmap'",
  "from 'weimo-ui/components/stat-group'",
  "from 'weimo-ui/components/tag-tree'",
  'export function formatDateInt',
  'export function toHeatmapDailyCounts',
  'export function toTagTreeNodes',
  'export function toSidebarTagTree',
  'export function toTagOptions',
  'export function formatTagBreadTag',
  'export function formatWordMetric',
  'export function buildSidebarStatItems',
  "const UNTAGGED_TAG = '__untagged__'",
  "label: '未标签'",
  "return '未标签'",
]) {
  assert.ok(
    sidebarDataSource.includes(snippet),
    `sidebar-data adapter must include ${snippet}`,
  )
}

for (const snippet of [
  "import { useQueryClient } from '@tanstack/react-query'",
  "import { TagBread } from 'weimo-ui/components/tag-bread'",
  'selectDate',
  'selectFacet',
  'selectTag',
  'showAllNotes',
  'showTodayReview',
  'useWorkspaceStatsQuery()',
  'useTagTreeQuery()',
  'useWorkspaceTagActions({',
  'buildSidebarStatItems(statsQuery.data)',
  'toHeatmapDailyCounts(statsQuery.data.daily_note_count)',
  'toSidebarTagTree(tagTreeQuery.data)',
  'toTagOptions(tagTreeQuery.data)',
  'formatTagBreadTag(navigation.selectedTag)',
  'clearWorkspaceQueries(queryClient)',
  'onLogout={handleLogout}',
  'activeDate={navigation.activeDate}',
  'onSelectDate={navigation.selectDate}',
  'onSelectFacet={navigation.selectFacet}',
  'onSelectTag={navigation.selectTag}',
  'onShowAllNotes={navigation.showAllNotes}',
  'onShowTodayReview={navigation.showTodayReview}',
  'selectedFacet={navigation.selectedFacet}',
  'selectedTag={navigation.selectedTag}',
  '{navigation.selectedTag ? (',
  '<TagBread',
  'tag={formatTagBreadTag(navigation.selectedTag)}',
  'onSelect={navigation.selectTag}',
  'className="workspace-top-bar"',
  'statItems={statItems}',
  'dailyCounts={dailyCounts}',
  'expandedTagTreeTags={expandedTagTreeTags}',
  'onExpandedTagTreeTagsChange={setExpandedTagTreeTags}',
  'tagMenuEnabled',
  'statsLoading={statsQuery.isPending}',
  'statsLoadFailed={statsQuery.isError}',
  'tagTreeNodes={tagTree.nodes}',
  'tagTreeLoading={tagTreeQuery.isPending}',
  'tagTreeLoadFailed={tagTreeQuery.isError}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must include ${snippet}`,
  )
}

for (const snippet of [
  '.workspace-top-bar .top-bar__slot--left',
  'padding-inline-start:',
  'var(--size-sidebar-width)',
  'calc(var(--space-gutter) * 1.6)',
]) {
  assert.ok(
    indexCssSource.includes(snippet),
    `index.css must keep selected tag breadcrumbs visible in the desktop TopBar: ${snippet}`,
  )
}

for (const snippet of [
  "import type { HeatmapDailyCount } from 'weimo-ui/components/heatmap'",
  "import type { StatGroupItem } from 'weimo-ui/components/stat-group'",
  "import type { TagTreeNode } from 'weimo-ui/components/tag-tree'",
  'activeDate: string',
  'onSelectDate: (date: string) => void',
  'onSelectFacet: (facet: string) => void',
  'onSelectTag: (tag: string) => void',
  'onShowAllNotes: () => void',
  'onShowTodayReview: () => void',
  'selectedFacet: string',
  'selectedTag: string',
  'statItems: StatGroupItem[]',
  'dailyCounts: HeatmapDailyCount[]',
  'tagTreeNodes: TagTreeNode[]',
  'statsLoading: boolean',
  'statsLoadFailed: boolean',
  'tagMenuEnabled?: boolean',
  'tagTreeLoading: boolean',
  'tagTreeLoadFailed: boolean',
  'tagTreeInitialized: boolean',
  'tagTreeUntaggedCount: number',
  'tagMenuEnabled={tagMenuEnabled}',
  '<BijiSideBar',
  'activeDate={activeDate}',
  'function handleSelectDate(date: string)',
  'onSelectDate={handleSelectDate}',
  'function handleSelectFacet(facet: string)',
  'onSelectFacet={handleSelectFacet}',
  'function handleSelectTag(tag: string)',
  'onSelectTag={handleSelectTag}',
  'function handleShowAllNotes()',
  'onShowAllNotes={handleShowAllNotes}',
  'function handleShowTodayReview()',
  'onShowTodayReview={handleShowTodayReview}',
  'selectedFacet={selectedFacet}',
  'selectedTag={selectedTag}',
  'tagTreeUntaggedCount={tagTreeUntaggedCount}',
]) {
  assert.ok(sidebarSource.includes(snippet), `SideBar must include ${snippet}`)
}

for (const snippet of [
  'activeDate: string',
  'dailyCounts: HeatmapDailyCount[]',
  'onSelectDate: (date: string) => void',
  'onSelectFacet: (facet: string) => void',
  'onSelectTag: (tag: string) => void',
  'onShowAllNotes: () => void',
  'onShowTodayReview: () => void',
  'selectedFacet: string',
  'selectedTag: string',
  'statItems: StatGroupItem[]',
  'tagTreeNodes: TagTreeNode[]',
  'statsLoading: boolean',
  'statsLoadFailed: boolean',
  'tagMenuEnabled?: boolean',
  'tagTreeLoading: boolean',
  'tagTreeLoadFailed: boolean',
  'tagTreeInitialized: boolean',
  'tagTreeUntaggedCount: number',
  'dailyCounts={dailyCounts}',
  'nodes={tagTreeNodes}',
  'onMenuAction={tagMenuEnabled ? handleTagMenuAction : undefined}',
  'activeDate={activeDate}',
  'onDateSelect={(date) => onSelectDate(date)}',
  'onSelectFacet(facet)',
  'onSelect={handleTagSelect}',
  'selectedFacet !== \'none\'',
  'selectedTag={selectedTag}',
  '统计加载中...',
  '统计加载失败',
  '标签加载中...',
  '标签加载失败',
]) {
  assert.ok(
    bijiSideBarSource.includes(snippet),
    `BijiSideBar must include ${snippet}`,
  )
}

for (const staleLocalNavigation of [
  "const [selectedDate, setSelectedDate] = useState('')",
  "const [selectedTag, setSelectedTag] = useState('')",
  "setSelectedDate(sampleToday)",
  "setSelectedTag(tag)",
  "activeDate={selectedDate}",
]) {
  assert.ok(
    !bijiSideBarSource.includes(staleLocalNavigation),
    `BijiSideBar must not keep local list navigation state: ${staleLocalNavigation}`,
  )
}

for (const staleSample of [
  'sampleDailyCounts',
  'sampleTagNodes',
  'formatWordMetric(120000)',
  "value: '1037'",
  "value: '828'",
  "{ date: '2026-03-23', count: 0 }",
  "{ tag: '开发', label: '开发' }",
]) {
  assert.ok(
    !bijiSideBarSource.includes(staleSample),
    `BijiSideBar must not keep sample sidebar data: ${staleSample}`,
  )
}
