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
const workspaceApiSource = readProjectFile(
  'src/features/workspace/workspace-api.ts',
)
const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const workspaceTypesSource = readProjectFile(
  'src/features/workspace/workspace-types.ts',
)

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-friend-memo-scope-contract.test.mjs',
  ),
  'package test script must run the workspace friend memo scope contract.',
)

for (const snippet of [
  'export interface FriendProfile',
  'export interface FriendSummary',
  'friends: FriendProfile[]',
]) {
  assert.ok(
    workspaceTypesSource.includes(snippet),
    `workspace friend types must include ${snippet}`,
  )
}

for (const snippet of [
  'function friendPath(username: string)',
  'export function getFriendSummary',
  "requestProtectedJson('/friend/me', token, friendSummarySchema)",
  'export function getFriendStats',
  'workspaceStatsSchema,',
  '`/friend/${friendPath(friendUsername)}/stats`',
  'export function getFriendTagTree',
  'tagTreeMetaSchema,',
  '`/friend/${friendPath(friendUsername)}/tag/meta`',
  'export function searchFriendMemos',
  'memoSearchPageDtoSchema,',
  '`/friend/${friendPath(friendUsername)}/memos/search`',
  'body: JSON.stringify(payload)',
  "method: 'POST'",
]) {
  assert.ok(
    workspaceApiSource.includes(snippet),
    `workspace API must expose Skyline-compatible friend memo scope endpoints: ${snippet}`,
  )
}

for (const snippet of [
  'getFriendStats,',
  'getFriendTagTree,',
  'searchFriendMemos,',
  'friendStats: (scope: string, friendUsername: string)',
  'friendTagTree: (scope: string, friendUsername: string)',
  'friendMemoLists: (scope: string, friendUsername: string)',
  'friendMemoList: (',
  'friendUsername: string',
  'export function useFriendSummaryQuery()',
  'export function useFriendWorkspaceStatsQuery(friendUsername: string)',
  'export function useFriendTagTreeQuery(friendUsername: string)',
  'export function useFriendMemoListQuery(',
  'enabled: enabled && Boolean(friendUsername)',
  'queryKey: workspaceQueryKeys.friendStats(scope, friendUsername)',
  'queryKey: workspaceQueryKeys.friendTagTree(scope, friendUsername)',
  'queryKey: workspaceQueryKeys.friendMemoList(',
  'const result = await searchFriendMemos(',
  'token,',
  'friendUsername,',
  'filters,',
  'pageParam,',
  'MEMO_LIST_PAGE_SIZE,',
  'select: (data) => mergeMemoSearchPages(data.pages)',
]) {
  assert.ok(
    workspaceQueriesSource.includes(snippet),
    `workspace queries must expose a friend memo scope query: ${snippet}`,
  )
}

for (const snippet of [
  "type HomeMemoScope = { kind: 'self' } | { kind: 'friend'; targetFriend: FriendProfile }",
  "const [homeMemoScope, setHomeMemoScope] = useState<HomeMemoScope>({ kind: 'self' })",
  'const friendSummaryQuery = useFriendSummaryQuery()',
  'const friendProfiles = friendSummaryQuery.data?.friends ?? EMPTY_FRIEND_PROFILES',
  "const selectedFriendUsername = homeMemoScope.kind === 'friend'",
  "const canViewFriendMemos = homeMemoScope.kind === 'self' &&",
  'const friendStatsQuery = useFriendWorkspaceStatsQuery(selectedFriendUsername)',
  'const friendTagTreeQuery = useFriendTagTreeQuery(selectedFriendUsername)',
  'const friendMemoListQuery = useFriendMemoListQuery(',
  "const activeStatsQuery = homeMemoScope.kind === 'friend' ? friendStatsQuery : statsQuery",
  "const activeTagTreeQuery = homeMemoScope.kind === 'friend' ? friendTagTreeQuery : tagTreeQuery",
  "const activeMemoListQuery = homeMemoScope.kind === 'friend' ? friendMemoListQuery : memoListQuery",
  'const rawMemoCards = activeMemoListQuery.data?.items ?? EMPTY_MEMO_CARDS',
  'const totalMemoCount = activeMemoListQuery.data?.totalCount ?? 0',
  'const treeTagOptions = toTagOptions(activeTagTreeQuery.data)',
  'buildSidebarStatItems(activeStatsQuery.data)',
  'toHeatmapDailyCounts(activeStatsQuery.data.daily_note_count)',
  'toSidebarTagTree(activeTagTreeQuery.data)',
  'statsLoading={activeStatsQuery.isPending}',
  'statsLoadFailed={activeStatsQuery.isError}',
  'tagTreeLoading={activeTagTreeQuery.isPending}',
  'tagTreeLoadFailed={activeTagTreeQuery.isError}',
  'tagTreeInitialized={activeTagTreeQuery.isFetched}',
  "tagMenuEnabled={homeMemoScope.kind === 'self'}",
  'const handleViewFriendMemos = useCallback(() => {',
  'const friend = resolveSelectedFriendProfile(friendProfiles, homeMemoScope)',
  "setHomeMemoScope({ kind: 'friend', targetFriend: friend })",
  'const handleViewMyMemos = useCallback(() => {',
  "setHomeMemoScope({ kind: 'self' })",
  'refreshMemoList: () => activeMemoListQuery.refetch()',
  'refreshStats: () => activeStatsQuery.refetch()',
  'refreshTagTree: () => activeTagTreeQuery.refetch()',
  'canViewFriendMemos={canViewFriendMemos}',
  'homeMemoScope={homeMemoScope.kind}',
  'onViewFriendMemos={handleViewFriendMemos}',
  'onViewMyMemos={handleViewMyMemos}',
  "homeMemoScope.kind === 'self' ? (",
  "disabled={homeMemoScope.kind === 'friend'}",
  'onDelete={homeMemoScope.kind === \'self\' ? () => handleMemoDelete(memo) : undefined}',
  'onSave={homeMemoScope.kind === \'self\' ? (draft) => handleMemoSave(memo, draft) : undefined}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must switch between self and friend memo scopes like Skyline: ${snippet}`,
  )
}
