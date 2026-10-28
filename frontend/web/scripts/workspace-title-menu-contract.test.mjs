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
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const titleMenuSource = readProjectFile(
  'src/features/workspace/workspace-title-menu.tsx',
)
const compactTitleMenuSource = titleMenuSource.replace(/\s+/g, ' ')

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-title-menu-contract.test.mjs',
  ),
  'package test script must run the workspace title menu contract.',
)
assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-title-refresh-model.test.mjs',
  ),
  'package test script must run the workspace title refresh model test.',
)

for (const snippet of [
  "import { ArrowUpDown, Check, Grid2X2, LogIn, RefreshCw, Undo2 } from 'lucide-react'",
  "import { ActionMenu, type ActionMenuItem } from 'weimo-ui/components/menu'",
  "import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'",
  "import type { MemoSearchQuery } from './workspace-types'",
  "type MemoCreatedAtSort = NonNullable<MemoSearchQuery['created_at_sort']>",
  'type WorkspaceTitleMenuProps = {',
  'memoCreatedAtSort?: MemoCreatedAtSort',
  'onMemoCreatedAtSortChange?: (sort: MemoCreatedAtSort) => void',
  'onRefresh?: () => void',
  'selectedTag?: string',
  'showGuestAuthAction?: boolean',
  "function memoCreatedAtSortSummaryLabel(sort: MemoCreatedAtSort): string {",
  "return sort === 'desc' ? '从新到旧' : '从旧到新'",
  'function selectMemoCreatedAtSort(',
  'if (currentSort === nextSort) return',
  'onMemoCreatedAtSortChange?.(nextSort)',
  "function parentTagPath(tagPath: string): string | null {",
  'function buildWorkspaceTitleMenuItems({',
  'memoCreatedAtSort',
  'onMemoCreatedAtSortChange',
  'onRefresh',
  'showGuestAuthAction',
  "const sort = memoCreatedAtSort ?? 'desc'",
  "if (showGuestAuthAction) {",
  "key: 'guestAuth'",
  "label: '登录/注册'",
  "key: 'parentTag'",
  "label: '查看上一级标签'",
  "key: 'allTags'",
  "label: '查看全部笔记'",
  "key: 'memoSortSection'",
  "type: 'sub'",
  "label: '排序方式'",
  'shortcut: memoCreatedAtSortSummaryLabel(sort)',
  'items: [',
  "key: 'memoSortNewestFirst'",
  "icon: sort === 'desc' ? <Check aria-hidden=\"true\" /> : undefined",
  "inset: sort !== 'desc'",
  "label: '最新的排最前'",
  "key: 'memoSortOldestFirst'",
  "icon: sort === 'asc' ? <Check aria-hidden=\"true\" /> : undefined",
  "inset: sort !== 'asc'",
  "label: '最旧的排最前'",
  "key: 'refresh'",
  "label: '刷新'",
  'onSelect: onRefresh',
  'export function WorkspaceTitleMenu({',
  'memoCreatedAtSort',
  'onMemoCreatedAtSortChange',
  'onRefresh',
  '<ActionMenu',
  'ariaLabel="更多"',
  'items={items}',
  'triggerProps={{',
  'render: <GlassIconButton aria-label="更多" />,',
]) {
  assert.ok(
    titleMenuSource.includes(snippet),
    `workspace title menu must mirror the Skyline home title menu labels: ${snippet}`,
  )
}

for (const snippet of [
  "selectMemoCreatedAtSort( sort, 'desc', onMemoCreatedAtSortChange, )",
  "selectMemoCreatedAtSort( sort, 'asc', onMemoCreatedAtSortChange, )",
]) {
  assert.ok(
    compactTitleMenuSource.includes(snippet),
    `workspace title menu sort actions must use the guarded sort helper: ${snippet}`,
  )
}

const memoSortSectionIndex = titleMenuSource.indexOf("key: 'memoSortSection'")
const memoSortItemsIndex = titleMenuSource.indexOf('items: [', memoSortSectionIndex)
const newestSortIndex = titleMenuSource.indexOf("key: 'memoSortNewestFirst'")
const oldestSortIndex = titleMenuSource.indexOf("key: 'memoSortOldestFirst'")
const refreshIndex = titleMenuSource.indexOf("key: 'refresh'")

assert.ok(memoSortSectionIndex >= 0, 'workspace title menu must include a sort submenu.')
assert.ok(
  memoSortItemsIndex > memoSortSectionIndex,
  'workspace title menu sort choices must be nested under the sort submenu.',
)
assert.ok(
  newestSortIndex > memoSortItemsIndex,
  'newest-first sort choice must be a submenu item.',
)
assert.ok(
  oldestSortIndex > newestSortIndex,
  'oldest-first sort choice must be a submenu item after newest-first.',
)
assert.ok(
  refreshIndex > oldestSortIndex,
  'refresh must stay a top-level menu item after the sort submenu.',
)

const sortSubmenuBlock = titleMenuSource.slice(memoSortItemsIndex, refreshIndex)
assert.ok(
  sortSubmenuBlock.includes("inset: sort !== 'desc'") &&
    sortSubmenuBlock.includes("inset: sort !== 'asc'"),
  'unchecked sort submenu items must use inset so their labels align with checked sibling labels.',
)

for (const forbiddenSnippet of [
  'window.location',
  'refreshMemoList',
  'selectTag(',
]) {
  assert.ok(
    !titleMenuSource.includes(forbiddenSnippet),
    `workspace title menu must remain display-only for now: ${forbiddenSnippet}`,
  )
}

for (const [name, source] of [
  ['workspace page', workspacePageSource],
  ['guest workspace page', guestPageSource],
]) {
  assert.ok(
    source.includes(
      "import { runWorkspaceTitleRefreshActions } from './workspace-title-refresh'",
    ),
    `${name} must use the Skyline-style workspace title refresh helper.`,
  )
}

for (const [name, source] of [
  ['workspace page', workspacePageSource],
  ['guest workspace page', guestPageSource],
]) {
  assert.ok(
    source.includes("import { WorkspaceTitleMenu } from './workspace-title-menu'"),
    `${name} must use the shared workspace title menu component.`,
  )

  const rightSlotIndex = source.indexOf('topBarActions={')
  const searchIndex = source.indexOf('aria-label="搜索"', rightSlotIndex)
  const createIndex = source.indexOf('aria-label="新建笔记"', rightSlotIndex)
  const menuIndex = source.indexOf('<WorkspaceTitleMenu', rightSlotIndex)

  assert.ok(rightSlotIndex >= 0, `${name} shell topBarActions must exist.`)
  assert.ok(searchIndex > rightSlotIndex, `${name} search button must stay in topBarActions.`)
  assert.ok(
    createIndex > searchIndex,
    `${name} create button must stay immediately after search before the title menu.`,
  )
  assert.ok(
    menuIndex > createIndex,
    `${name} title menu button must render after the create button.`,
  )
}

assert.ok(
  workspacePageSource.includes('memoCreatedAtSort={navigation.memoCreatedAtSort}') &&
    workspacePageSource.includes(
      'onMemoCreatedAtSortChange={navigation.setMemoCreatedAtSort}',
    ) &&
    workspacePageSource.includes('onRefresh={handleTitleRefresh}') &&
    workspacePageSource.includes('selectedTag={navigation.selectedTag}'),
  'workspace page must pass current sort state, refresh action, and selected tag to the title menu.',
)

assert.ok(
  guestPageSource.includes('memoCreatedAtSort={navigation.memoCreatedAtSort}') &&
    guestPageSource.includes(
      'onMemoCreatedAtSortChange={navigation.setMemoCreatedAtSort}',
    ) &&
    guestPageSource.includes('onRefresh={handleTitleRefresh}') &&
    guestPageSource.includes('selectedTag={navigation.selectedTag}') &&
    guestPageSource.includes('showGuestAuthAction'),
  'guest workspace page must show the Skyline guest login/register item and pass current sort state plus refresh action.',
)

for (const snippet of [
  'const handleTitleRefresh = useCallback(() => {',
  'clearMemoDisplayOverrides()',
  'void runWorkspaceTitleRefreshActions({',
  'refreshMemoList: () => memoListQuery.refetch()',
  'refreshStats: () => statsQuery.refetch()',
  'refreshTagTree: () => tagTreeQuery.refetch()',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page refresh menu must refresh the memo list, stats, and tag tree: ${snippet}`,
  )
}

const workspaceRefreshSource = workspacePageSource.slice(
  workspacePageSource.indexOf('const handleTitleRefresh = useCallback'),
  workspacePageSource.indexOf('const handleMemoSave = useCallback'),
)
assert.ok(
  workspaceRefreshSource.indexOf('clearMemoDisplayOverrides()') <
    workspaceRefreshSource.indexOf('void runWorkspaceTitleRefreshActions({'),
  'workspace refresh must discard page-local display overrides before refetching server data.',
)

for (const snippet of [
  'const handleTitleRefresh = useCallback(() => {',
  'setMemos(guestMemoCards)',
  'setTagTreeMeta(guestTagTree)',
  'setExpandedTagTreeTags([])',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest workspace title refresh must stay local and restore guest sample data: ${snippet}`,
  )
}
