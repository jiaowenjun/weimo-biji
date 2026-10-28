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
const appSource = readProjectFile('src/App.tsx')
const routeLoadersSource = readProjectFile('src/app-route-loaders.ts')
const loginScreenSource = readProjectFile('src/features/auth/login-screen.tsx')
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const navigationSource = readProjectFile(
  'src/features/workspace/use-workspace-page-navigation.ts',
)
const guestDataSource = readProjectFile(
  'src/features/workspace/guest-workspace-data.ts',
)

assert.ok(
  packageJson.scripts?.test?.includes('node scripts/guest-home-contract.test.mjs'),
  'package test script must run guest-home-contract.test.mjs.',
)
assert.ok(
  packageJson.scripts?.test?.includes('node scripts/guest-memo-sort-model.test.mjs'),
  'package test script must run the guest memo sort model test.',
)

for (const snippet of [
  'loadGuestWorkspacePage',
  '<GuestWorkspacePage />',
]) {
  assert.ok(appSource.includes(snippet), `App route table must include ${snippet}`)
}
assert.ok(
  routeLoadersSource.includes("import('@/features/workspace/guest-workspace-page')"),
  'guest workspace route must be loaded through a dynamic import.',
)

for (const snippet of [
  "import { Link, useLocation, useNavigate } from 'react-router'",
  'to="/guest"',
  '游客模式',
  'preloadGuestWorkspacePage',
  'onFocus={preloadGuestWorkspacePage}',
  'onMouseEnter={preloadGuestWorkspacePage}',
]) {
  assert.ok(
    loginScreenSource.includes(snippet),
    `login screen must expose a guest entry with ${snippet}`,
  )
}

for (const snippet of [
  "import { TagBread } from '@/components/tag-bread'",
  "import { RefCard } from '@/components/ref-card'",
  "import { SideBar } from '@/components/sidebar'",
  "import { WorkspaceShell } from '@/features/workspace/workspace-shell'",
  'buildMemoReferencePreviews',
  'createMemoReferencePreviewResolver',
  'formatTagBreadTag',
  'formatWorkspacePageTitle(navigation)',
  'guestMemoCards',
  'guestStats',
  'guestTagTree',
  'filterGuestMemos',
  'useWorkspacePageNavigation',
  'const { filters: memoFilters, navigation } = useWorkspacePageNavigation()',
  'displayName="游客模式"',
  'sidebar={(api) => (',
  'onClose={api.close}',
  'topBarLeading={',
  'navigation.selectedTag ? (',
  'tag={formatTagBreadTag(navigation.selectedTag)}',
  'onSelect={navigation.selectTag}',
  'const memoById = useMemo(',
  'new Map(memos.map((memo) => [memo.id, memo]))',
  'const referencePreviewResolver = useMemo(',
  'getMemoById: (id) => memoById.get(id)',
  'const referencePreviews = buildMemoReferencePreviews(',
  'referencePreviewResolver,',
  '<RefCard',
  'referencePreview={referencePreviews.referencePreview}',
  'referencedByPreviews={referencePreviews.referencedByPreviews}',
  'note={toCardNote(memo)}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest workspace page must include ${snippet}`,
  )
}

for (const snippet of [
  'export function useWorkspacePageNavigation()',
  'useWorkspaceNavigationStore((state) => state.filters)',
  'selectedTag,',
  'selectTag,',
]) {
  assert.ok(
    navigationSource.includes(snippet),
    `workspace navigation seam must include ${snippet}`,
  )
}

for (const forbiddenSnippet of [
  'useAuth()',
  'useMemoListQuery',
  'useTagTreeQuery',
  'useWorkspaceStatsQuery',
  'useUpdateMemoMutation',
  'getCurrentUser',
  'requestProtectedJson',
]) {
  assert.ok(
    !guestPageSource.includes(forbiddenSnippet),
    `guest workspace page must not require authenticated APIs: ${forbiddenSnippet}`,
  )
}

for (const snippet of [
  'export const guestStats',
  'export const guestTagTree',
  'export const guestMemoCards',
  'export function filterGuestMemos',
  'filters.tag',
  'filters.has_no_tag',
  'filters.has_annotation',
  'filters.has_heading',
  'filters.has_unordered_list',
  'filters.has_markdown_quote',
  'filters.created_at_sort',
  'first.createdAt.localeCompare(second.createdAt)',
  'second.createdAt.localeCompare(first.createdAt)',
]) {
  assert.ok(
    guestDataSource.includes(snippet),
    `guest workspace data must include ${snippet}`,
  )
}

// 桌面端标签面包屑由 SiteTemplate 的 topBarLeading 插槽对齐内容列（模板 CSS 负责
// 侧边栏偏移），这里只约束页面把 TagBread 挂到该插槽。
assert.ok(
  guestPageSource.includes('topBarLeading={') &&
    guestPageSource.includes('<TagBread'),
  'guest workspace page must surface the selected tag breadcrumb through the shell topBarLeading slot.',
)
