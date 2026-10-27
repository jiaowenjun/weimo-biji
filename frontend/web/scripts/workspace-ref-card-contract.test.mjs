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
const viteConfigSource = readProjectFile('vite.config.ts')
const refCardSource = readProjectFile('src/components/ref-card.tsx')
const refCardCss = readProjectFile('src/components/ref-card.css')
const memoDataSource = readProjectFile('src/features/workspace/memo-data.ts')
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const workspaceQueriesSource = readProjectFile(
  'src/features/workspace/workspace-queries.ts',
)
const workspaceApiSource = readProjectFile('src/features/workspace/workspace-api.ts')
const workspaceMemoCardMenuSource = readProjectFile(
  'src/features/workspace/workspace-memo-card-menu.ts',
)
const workspaceMemoDetailDialogSource = readProjectFile(
  'src/features/workspace/workspace-memo-detail-dialog.tsx',
)
const workspaceMemoDetailSource = readProjectFile(
  'src/features/workspace/workspace-memo-detail.ts',
)

const {
  buildMemoFriendReferencePreview,
  buildMemoReferenceOwnerSummaryText,
  buildMemoReferencePreviews,
  createMemoReferencePreviewResolver,
  parseFriendMemoRef,
  summarizeMemoContent,
  toCardNote,
} = await import('../src/features/workspace/memo-data.ts')

function makeMemo(id, overrides = {}) {
  return {
    id,
    content: `memo-${id}`,
    createdAt: '2026-06-20T02:00:00.000Z',
    updatedAt: '2026-06-20T02:00:00.000Z',
    tags: [],
    refs: [],
    referencedBy: [],
    ...overrides,
  }
}

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-ref-card-contract.test.mjs',
  ),
  'package test script must run the RefCard contract.',
)

for (const snippet of [
  "import { CircleArrowDown, CircleArrowUp } from 'lucide-react'",
  "import { buildWorkspaceMemoCardMenuItems } from '@/features/workspace/workspace-memo-card-menu'",
  "import { Card } from '@/components/card'",
  "import type { CardProps } from '@/components/card'",
  "import { getCardSurfaceClassName } from 'weimo-ui/components/card-surface'",
  "import './ref-card.css'",
  'export interface RefCardReferencePreview',
  'export type RefCardProps = CardProps &',
  'referencePreview?: RefCardReferencePreview | null',
  'referencedByPreviews?: RefCardReferencePreview[]',
  'referenceDisabled?: boolean',
  'onReferenceClick?: () => void',
  'showReferenceBar?: boolean',
  'const displayMenuItems = buildWorkspaceMemoCardMenuItems({',
  'showMemoDetailPage: hasVisibleReferenceBar,',
  'extraDisplayMenuItems: cardProps.displayMenuItems,',
  'displayMenuItems={displayMenuItems}',
  '<Card',
  '{...cardProps}',
  'const hasReferenceBar = referencePreview !== null || referencedByPreviews.length > 0',
  'const hasVisibleReferenceBar = showReferenceBar && hasReferenceBar',
  'const refCardClassName = hasVisibleReferenceBar',
  "getCardSurfaceClassName('ref-card')",
  'data-has-reference={hasVisibleReferenceBar ? \'true\' : undefined}',
  'const referenceBar = hasVisibleReferenceBar ? (',
  'afterTagsSlot={referenceBar}',
  'className="ref-card__reference"',
  'className="ref-card__reference-line"',
  '<CircleArrowUp',
  '<CircleArrowDown',
  'ref-card__icon--reference',
  'ref-card__icon--referenced-by',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must inherit Card behavior and render the Skyline-style reference bar: ${snippet}`,
  )
}

for (const snippet of [
  "import { Copy, Quote, Share2, CircleArrowOutUpLeft } from 'lucide-react'",
  "import { createElement } from 'react'",
  "import type { ActionMenuItem } from 'weimo-ui/components/menu'",
  'type BuildWorkspaceMemoCardMenuItemsOptions = {',
  'showMemoDetailPage?: boolean',
  'extraDisplayMenuItems?: ActionMenuItem[]',
  'onMemoDetailSelect?: () => void',
  'export function buildWorkspaceMemoCardMenuItems',
  "key: 'quote'",
  "label: '批注'",
  'icon: icon(Quote)',
  "key: 'memo-detail'",
  "label: '查看详情'",
  'icon: icon(CircleArrowOutUpLeft)',
  'onSelect: onMemoDetailSelect',
  "key: 'share'",
  "label: '分享'",
  'icon: icon(Share2)',
  "key: 'copy'",
  "label: '复制'",
  'icon: icon(Copy)',
  "key: 'workspace-memo-card-secondary-separator'",
  '...extraDisplayMenuItems',
]) {
  assert.ok(
    workspaceMemoCardMenuSource.includes(snippet),
    `workspace memo card menu must mirror Skyline menu items: ${snippet}`,
  )
}

const { buildWorkspaceMemoCardMenuItems } = await import(
  '../src/features/workspace/workspace-memo-card-menu.ts'
)
const { buildWorkspaceMemoDetailProjection } = await import(
  '../src/features/workspace/workspace-memo-detail.ts'
)

assert.deepEqual(
  buildWorkspaceMemoCardMenuItems().map((item) => ({
    key: item.key,
    label: item.label,
    type: item.type,
  })),
  [
    { key: 'quote', label: '批注', type: undefined },
    {
      key: 'workspace-memo-card-secondary-separator',
      label: undefined,
      type: 'separator',
    },
    { key: 'share', label: '分享', type: undefined },
    { key: 'copy', label: '复制', type: undefined },
  ],
  'default workspace memo card menu must create Skyline self items between built-in edit and delete.',
)

const menuWithDetail = buildWorkspaceMemoCardMenuItems({
  showMemoDetailPage: true,
})
assert.deepEqual(
  menuWithDetail.map((item) => item.key),
  [
    'quote',
    'workspace-memo-card-secondary-separator',
    'memo-detail',
    'share',
    'copy',
  ],
  'workspace memo card menu must insert 查看详情 before share when the reference/detail entry is visible.',
)
for (const item of menuWithDetail) {
  if (item.key !== 'memo-detail') {
    assert.equal(
      item.onSelect,
      undefined,
      `workspace memo card menu item ${item.key} must not receive the detail callback.`,
    )
  }
}

let detailSelectCount = 0
const menuWithDetailAction = buildWorkspaceMemoCardMenuItems({
  showMemoDetailPage: true,
  onMemoDetailSelect: () => {
    detailSelectCount += 1
  },
})
const detailItem = menuWithDetailAction.find((item) => item.key === 'memo-detail')
assert.equal(
  typeof detailItem?.onSelect,
  'function',
  '查看详情 menu item must call the same page-level detail opener as the reference bar.',
)
detailItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
assert.equal(
  detailSelectCount,
  1,
  '查看详情 menu item must invoke the supplied detail opener exactly once.',
)

assert.deepEqual(
  buildWorkspaceMemoCardMenuItems({
    showMemoDetailPage: false,
    onMemoDetailSelect: () => {},
  }).map((item) => item.key),
  [
    'quote',
    'workspace-memo-card-secondary-separator',
    'share',
    'copy',
  ],
  'workspace memo card menu must keep Skyline parity: 查看详情 is hidden unless the reference bar is visible.',
)

for (const snippet of [
  '.ref-card[data-has-reference="true"] {',
  '.ref-card[data-has-reference="true"] > .weimo-card {',
  'border: 0;',
  'background: transparent;',
  'box-shadow: none;',
  'padding: 0;',
  'color: var(--color-text-placeholder);',
  'font-size: var(--font-size-sm);',
  'text-overflow: ellipsis;',
  'transform: rotate(-45deg);',
  'gap: 2px;',
  'gap: 6px;',
]) {
  assert.ok(refCardCss.includes(snippet), `RefCard CSS must include ${snippet}`)
}

assert.ok(
  !refCardCss.includes('background: var(--color-bg-card);') &&
    !refCardCss.includes('box-shadow: var(--shadow-card);'),
  'RefCard CSS must delegate reference wrapper material to CardSurface.',
)

assert.ok(
  !refCardCss.includes('display: none;'),
  'RefCard must not remove the reference bar from edit mode with display: none.',
)

assert.match(
  refCardCss,
  /\.ref-card__reference\s*\{[\s\S]*?display:\s*block;[\s\S]*?\}/,
  'RefCard reference button must be a block box so a single-line reference bar does not inherit inline line-box descender space.',
)

assert.ok(
  !refCardCss.includes('.weimo-card-editable__after-tags') &&
    !refCardCss.includes('data-mode="view"'),
  'RefCard must delegate after-tags spacing to shared Card so exit-edit mixed state does not double-count the gap.',
)

for (const snippet of [
  'border-start: 0;',
  'border-end-start-radius: 0;',
  'border-end-end-radius: 0;',
]) {
  assert.ok(
    !refCardCss.includes(snippet),
    `RefCard CSS must not create an attached lower panel with ${snippet}`,
  )
}

for (const snippet of [
  'showReferenceBar?: boolean',
  'onMemoDetailSelect: onReferenceClick',
  'const hasVisibleReferenceBar = showReferenceBar && hasReferenceBar',
  'showMemoDetailPage: hasVisibleReferenceBar,',
  'afterTagsSlot={referenceBar}',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must use one Skyline-aligned detail entry gate for menu and reference bar: ${snippet}`,
  )
}

assert.equal(
  viteConfigSource.includes("path.resolve(__dirname, '../../../weimo-ui"),
  false,
  'vite.config.ts must resolve weimo-ui through the installed package interface.',
)
assert.ok(
  viteConfigSource.includes("path.resolve(__dirname, '../../shared/frontend/workspace-core')"),
  'vite.config.ts must keep workspace-core sources available to Vite dev.',
)

for (const snippet of [
  "import { ActionDialog } from 'weimo-ui/components/action-dialog'",
  "import { DialogPanel } from 'weimo-ui/components/coss/dialog'",
  "import { RefCard } from '@/components/ref-card'",
  "import './workspace-memo-detail-dialog.css'",
  'export interface WorkspaceMemoDetailDialogProps',
  'export function WorkspaceMemoDetailDialog',
  'title="笔记详情"',
  'className="workspace-memo-detail-dialog"',
  'open={open}',
  'onOpenChange={onOpenChange}',
  'referencePreviewResolver?: MemoReferencePreviewResolver',
  'referencePreviewResolver ?? fallbackReferencePreviewResolver',
  'role="region"',
  'aria-label="笔记详情内容"',
  'showReferenceBar={false}',
  'referenceSections.map',
  "kind === 'preview'",
  'key={item.preview.id}',
  'item.preview.displayText',
  'key={item.memo.id}',
  'note={toCardNote(item.memo)}',
  'note={toCardNote(projection.rootMemo)}',
]) {
  assert.ok(
    workspaceMemoDetailDialogSource.includes(snippet),
    `Workspace memo detail dialog must follow the Skyline detail structure: ${snippet}`,
  )
}

const detailDialogRefCardRenderCount = (
  workspaceMemoDetailDialogSource.match(/<RefCard\b/g) ?? []
).length
assert.equal(
  detailDialogRefCardRenderCount,
  3,
  'Workspace memo detail dialog must render root, memo relation, and preview relation cards through RefCard.',
)
assert.ok(
  !workspaceMemoDetailDialogSource.includes("from '@/components/card'") &&
    !workspaceMemoDetailDialogSource.includes('<Card'),
  'Workspace memo detail dialog must not render note cards with bare Card or custom Card markup.',
)

for (const snippet of [
  'export interface WorkspaceMemoDetailProjection',
  'rootMemo: Memo',
  'referenceItems: WorkspaceMemoDetailRelationItem[]',
  'referencedByItems: WorkspaceMemoDetailRelationItem[]',
  'export function buildWorkspaceMemoDetailProjection',
  'resolver: MemoReferencePreviewResolver',
  'const memoById = new Map',
  'memo.refs',
  'memo.referencedBy',
  'resolver.resolveReferenceMemo?.(ref)',
  "kind: 'preview'",
]) {
  assert.ok(
    workspaceMemoDetailSource.includes(snippet),
    `workspace memo detail projection must be a small testable Skyline-style model: ${snippet}`,
  )
}

const detailRoot = makeMemo(1, {
  refs: ['2', 'friend/4'],
  referencedBy: ['3', 'friend/5'],
})
const friendPreviewMap = new Map([
  ['friend/4', { id: 'friend/4', displayText: '琦琦君: 好友引用笔记摘要' }],
  ['friend/5', { id: 'friend/5', displayText: '琦琦君: 好友被引用笔记摘要' }],
])
const friendMemoMap = new Map([
  [
    'friend/4',
    makeMemo(4, {
      content: '好友引用完整正文',
      createdAt: '2026-06-19T03:04:00.000Z',
      tags: ['好友标签'],
    }),
  ],
])
const detailProjection = buildWorkspaceMemoDetailProjection(
  detailRoot,
  [
    detailRoot,
    makeMemo(2, { content: 'referenced memo' }),
    makeMemo(3, { content: 'referencing memo' }),
  ],
  createMemoReferencePreviewResolver({
    getMemoById: (id) => (id === 2 ? makeMemo(2, { content: 'referenced memo' }) : undefined),
    resolveReferenceMemo: (id) => friendMemoMap.get(id),
    resolveReferencePreview: (id) => friendPreviewMap.get(id),
  }),
)
assert.equal(
  detailProjection.rootMemo,
  detailRoot,
  'workspace memo detail projection must preserve the selected root memo.',
)
assert.deepEqual(
  detailProjection.referenceItems.map((item) =>
    item.kind === 'memo' ? toCardNote(item.memo) : item.preview.displayText,
  ),
  [
    toCardNote(makeMemo(2, { content: 'referenced memo' })),
    {
      content: '好友引用完整正文',
      createdAtText: '2026-06-19 11:04',
      tags: ['好友标签'],
    },
  ],
  'workspace memo detail projection must preserve root refs order and render hydrated friend refs as full RefCard notes in the 引用 section.',
)
assert.deepEqual(
  detailProjection.referencedByItems.map((item) =>
    item.kind === 'memo' ? item.memo.id : item.preview.displayText,
  ),
  [3, '琦琦君: 好友被引用笔记摘要'],
  'workspace memo detail projection must preserve root referencedBy order and keep friend previews in the 被引用 section.',
)

for (const snippet of [
  "import { WorkspaceMemoDetailDialog } from './workspace-memo-detail-dialog'",
  'const [detailMemoId, setDetailMemoId] = useState<number | null>(null)',
  'const detailMemo = detailMemoId === null ? null : (memoById.get(detailMemoId) ?? null)',
  '<WorkspaceMemoDetailDialog',
  'memo={detailMemo}',
  'memos={memoCards}',
  'onOpenChange={handleMemoDetailOpenChange}',
  'referencePreviewResolver={referencePreviewResolver}',
  'onReferenceClick={() => setDetailMemoId(memo.id)}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must open the Skyline-style detail dialog from the reference bar/menu: ${snippet}`,
  )
}

for (const snippet of [
  "import { WorkspaceMemoDetailDialog } from './workspace-memo-detail-dialog'",
  'const [detailMemoId, setDetailMemoId] = useState<number | null>(null)',
  'const detailMemo = detailMemoId === null ? null : (memoById.get(detailMemoId) ?? null)',
  '<WorkspaceMemoDetailDialog',
  'memo={detailMemo}',
  'memos={memos}',
  'onOpenChange={handleMemoDetailOpenChange}',
  'onReferenceClick={() => setDetailMemoId(memo.id)}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest page must open the same detail dialog without backend calls: ${snippet}`,
  )
}

for (const snippet of [
  'export const REFERENCE_SUMMARY_MAX_LENGTH = 52',
  'export interface MemoReferencePreview',
  'export interface MemoReferencePreviewResolver',
  'export interface MemoReferenceSummaryCache',
  'resolveReferenceMemo?: (id: MemoRefId) => Memo | undefined',
  'export function summarizeMemoContent',
  'export function buildMemoReferenceFallbackText',
  'export function buildMemoReferenceDisplayText',
  'export function buildMemoReferenceOwnerSummaryText',
  'export function parseFriendMemoRef',
  'export function buildMemoFriendReferencePreview',
  'export function createMemoReferencePreviewResolver',
  'export function buildMemoReferencePreviews',
  'resolveReferencePreview',
  'const referenceId = memo.refs[0] ?? null',
  'memo.referencedBy.map((id) =>',
]) {
  assert.ok(
    memoDataSource.includes(snippet),
    `memo-data must mirror Skyline reference preview projection: ${snippet}`,
  )
}

assert.equal(
  summarizeMemoContent('春'.repeat(60)),
  `${'春'.repeat(52)}...`,
)

const referencedMemo = makeMemo(7, {
  content: '被引用笔记的第一行\n第二行会折叠进摘要',
  createdAt: '2026-06-19T10:30:00.000Z',
})
const childMemo = makeMemo(9, {
  content: '这条笔记引用了当前笔记',
  createdAt: '2026-06-21T08:15:00.000Z',
})
const memo = makeMemo(5, {
  refs: ['7', 'bob/8'],
  referencedBy: ['9', 'alice/2'],
})
const previews = buildMemoReferencePreviews(
  memo,
  new Map([
    [7, referencedMemo],
    [9, childMemo],
  ]),
)

assert.deepEqual(previews.referencePreview, {
  id: '7',
  displayText: '2026-06-19：被引用笔记的第一行 第二行会折叠进摘要',
})
assert.deepEqual(previews.referencedByPreviews, [
  {
    id: '9',
    displayText: '2026-06-21：这条笔记引用了当前笔记',
  },
  {
    id: 'alice/2',
    displayText: '笔记alice/2',
  },
])

const cachedReferencedMemo = makeMemo(11, {
  content: '来自缓存的引用正文\n应该在切换标签后继续展示',
  createdAt: '2026-06-18T06:00:00.000Z',
})
const summaryCache = new Map()
const resolver = createMemoReferencePreviewResolver({
  getMemoById: (id) => (id === 11 ? cachedReferencedMemo : undefined),
  summaryCache,
})
const cachedPreviews = buildMemoReferencePreviews(
  makeMemo(6, { refs: ['11'], referencedBy: ['11'] }),
  resolver,
)

assert.deepEqual(cachedPreviews.referencePreview, {
  id: '11',
  displayText: '2026-06-18：来自缓存的引用正文 应该在切换标签后继续展示',
})
assert.deepEqual(cachedPreviews.referencedByPreviews, [
  {
    id: '11',
    displayText: '2026-06-18：来自缓存的引用正文 应该在切换标签后继续展示',
  },
])
assert.equal(
  summaryCache.get(11),
  '2026-06-18：来自缓存的引用正文 应该在切换标签后继续展示',
  'reference summary cache should store memo-id to rendered summary text.',
)
assert.deepEqual(
  buildMemoReferencePreviews(makeMemo(7, { refs: ['11'] }), resolver).referencePreview,
  {
    id: '11',
    displayText: '2026-06-18：来自缓存的引用正文 应该在切换标签后继续展示',
  },
  'reference preview resolver should reuse memo-id summary cache across cards.',
)

assert.deepEqual(parseFriendMemoRef('wx_toqph5va/33'), {
  username: 'wx_toqph5va',
  memoId: 33,
})
assert.equal(parseFriendMemoRef('11'), null)
assert.equal(parseFriendMemoRef('wx_toqph5va/nope'), null)
assert.equal(
  buildMemoReferenceOwnerSummaryText(
    '珲珲君',
    '极限准备公开课，到了十二点，想起婚纱照还没修完',
    '笔记wx_toqph5va/33',
  ),
  '珲珲君: 极限准备公开课，到了十二点，想起婚纱照还没修完',
)

const friendMemo = makeMemo(33, {
  content: '极限准备公开课，到了十二点，想起婚纱照还没修完',
})
assert.deepEqual(
  buildMemoFriendReferencePreview('wx_toqph5va/33', friendMemo, '珲珲君'),
  {
    id: 'wx_toqph5va/33',
    displayText: '珲珲君: 极限准备公开课，到了十二点，想起婚纱照还没修完',
  },
)

const friendPreviewResolver = createMemoReferencePreviewResolver({
  getMemoById: () => undefined,
  resolveReferencePreview: (id) =>
    id === 'wx_toqph5va/33'
      ? buildMemoFriendReferencePreview(id, friendMemo, '珲珲君')
      : undefined,
})
assert.deepEqual(
  buildMemoReferencePreviews(
    makeMemo(8, { refs: ['wx_toqph5va/33'], referencedBy: ['wx_toqph5va/34'] }),
    friendPreviewResolver,
  ),
  {
    referencePreview: {
      id: 'wx_toqph5va/33',
      displayText: '珲珲君: 极限准备公开课，到了十二点，想起婚纱照还没修完',
    },
    referencedByPreviews: [
      {
        id: 'wx_toqph5va/34',
        displayText: '笔记wx_toqph5va/34',
      },
    ],
  },
  'friend reference previews should override the fallback ref text when hydrated.',
)

for (const snippet of [
  "import { RefCard } from '@/components/ref-card'",
  'buildMemoReferencePreviews',
  'createMemoReferencePreviewResolver',
  'createWorkspaceMemoCacheIndex',
  'useFriendReferencePreviewMap',
  'const memoById = useMemo(',
  'new Map(memoCards.map((memo) => [memo.id, memo]))',
  'const friendReferenceDetails = useFriendReferencePreviewMap(',
  'selectedFriendUsername,',
  'const workspaceMemoCacheIndex = useMemo(',
  'createWorkspaceMemoCacheIndex(queryClient, memoCacheOwner, rawMemoCards)',
  'const referencePreviewResolver = useMemo(',
  'resolveReferenceMemo: (id) => friendReferenceDetails.memos.get(id)',
  'resolveReferencePreview: (id) => friendReferenceDetails.previews.get(id)',
  'refreshReferencePreviews: () => friendReferenceDetails.refetch()',
  'const cachedMemo = workspaceMemoCacheIndex.getMemoById(id)',
  'summaryCache: workspaceMemoCacheIndex.getSummaryCache()',
  'const referencePreviews = buildMemoReferencePreviews(',
  'referencePreviewResolver,',
  '<RefCard',
  'referencePreview={referencePreviews.referencePreview}',
  'referencedByPreviews={referencePreviews.referencedByPreviews}',
  'note={toCardNote(memo)}',
  "disabled={homeMemoScope.kind === 'friend'}",
  "onDelete={homeMemoScope.kind === 'self' ? () => handleMemoDelete(memo) : undefined}",
  "onSave={homeMemoScope.kind === 'self' ? (draft) => handleMemoSave(memo, draft) : undefined}",
  'tagOptions={tagOptions}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must render memo list through RefCard: ${snippet}`,
  )
}

for (const snippet of [
  "import { RefCard } from '@/components/ref-card'",
  'buildMemoReferencePreviews',
  'createMemoReferencePreviewResolver',
  'const memoById = useMemo(',
  'new Map(memos.map((memo) => [memo.id, memo]))',
  'const referencePreviewResolver = useMemo(',
  'getMemoById: (id) => memoById.get(id)',
  'const referencePreviews = buildMemoReferencePreviews(',
  'referencePreviewResolver,',
  '<RefCard',
  'referencePreview={referencePreviews.referencePreview}',
  'referencedByPreviews={referencePreviews.referencedByPreviews}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest page must render memo list through RefCard: ${snippet}`,
  )
}

for (const snippet of [
  "import { useQueries",
  'friendSummary: (scope: string)',
  'friendMemo: (scope: string, friendUsername: string, memoId: number)',
  'export function useFriendReferencePreviewMap',
  'owningFriendUsername: string = \'\'',
  'const parsed = parseFriendMemoRef(ref)',
  'username: resolvedRef.username',
  'refetch()',
  'queryKey: workspaceQueryKeys.friendSummary(scope)',
  'queryKey: workspaceQueryKeys.friendMemo(scope, ref.username, ref.memoId)',
  'buildMemoFriendReferencePreview',
  'parseFriendMemoRef',
]) {
  assert.ok(
    workspaceQueriesSource.includes(snippet),
    `workspace queries must hydrate friend reference previews through TanStack Query: ${snippet}`,
  )
}

for (const snippet of [
  'export function getFriendSummary',
  "requestProtectedJson('/friend/me', token, friendSummarySchema)",
  'export function getFriendMemo',
  "`/friend/${friendPath(friendUsername)}/memos/${id}`",
]) {
  assert.ok(
    workspaceApiSource.includes(snippet),
    `workspace API must expose Skyline-compatible friend preview endpoints: ${snippet}`,
  )
}

assert.ok(
  guestPageSource.includes("from '@/components/card'") &&
    !workspacePageSource.includes("import { Card } from '@/components/card'") &&
    !guestPageSource.includes("import { Card } from '@/components/card'"),
  'memo list pages must stop importing the bare Card component while keeping CardDraft type imports.',
)
