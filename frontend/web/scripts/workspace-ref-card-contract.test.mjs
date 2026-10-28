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
  buildMemoReferencePreviews,
  createMemoReferencePreviewResolver,
  summarizeMemoContent,
  toCardNote,
} = await import('../src/features/workspace/memo-data.ts')

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

function makeMemo(id, overrides = {}) {
  return {
    id,
    content: wdfDocument(`memo-${id}`),
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
  "import { CircleArrowDown, CircleArrowUp, Trash2 } from 'lucide-react'",
  "} from '@/features/workspace/workspace-memo-card-menu'",
  'buildWorkspaceMemoCardMenuItems,',
  "import { NoteCard, type CardDraft, type CardNote } from './note-card'",
  "import { getCardSurfaceClassName } from 'weimo-ui/components/card-surface'",
  "import './ref-card.css'",
  'export interface RefCardReferencePreview',
  'export type RefCardProps = {',
  'referencePreview?: RefCardReferencePreview | null',
  'referencedByPreviews?: RefCardReferencePreview[]',
  'referenceDisabled?: boolean',
  'onReferenceClick?: () => void',
  'onDelete?: () => void',
  'showReferenceBar?: boolean',
  'const menuItems = buildWorkspaceMemoCardMenuItems({',
  'showMemoDetailPage: hasVisibleReferenceBar,',
  'extraDisplayMenuItems: noteCardProps.displayMenuItems,',
  'displayMenuItems={displayMenuItems}',
  '<NoteCard',
  '{...noteCardProps}',
  'bottomBarExtra={referenceBar}',
  "key: 'delete'",
  "label: '删除'",
  'icon: <Trash2 aria-hidden="true" />',
  'onSelect: onDelete',
  'const hasReferenceBar = referencePreview !== null || referencedByPreviews.length > 0',
  'const hasVisibleReferenceBar = showReferenceBar && hasReferenceBar',
  'const refCardClassName = hasVisibleReferenceBar',
  "getCardSurfaceClassName('ref-card')",
  'data-has-reference={hasVisibleReferenceBar ? \'true\' : undefined}',
  'const referenceBar = hasVisibleReferenceBar ? (',
  'className="ref-card__reference"',
  'className="ref-card__reference-line"',
  '<CircleArrowUp',
  '<CircleArrowDown',
  'ref-card__icon--reference',
  'ref-card__icon--referenced-by',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must inherit NoteCard behavior and render the Skyline-style reference bar: ${snippet}`,
  )
}

for (const snippet of [
  "import { Copy, Quote, CircleArrowOutUpLeft } from 'lucide-react'",
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
    'copy',
  ],
  'workspace memo card menu must insert 查看详情 before copy when the reference/detail entry is visible.',
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
    'copy',
  ],
  'workspace memo card menu must keep Skyline parity: 查看详情 is hidden unless the reference bar is visible.',
)

for (const snippet of [
  '.ref-card[data-has-reference="true"] {',
  '.ref-card[data-has-reference="true"] > .note-card > .wdf-card > .wdf-card__card {',
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
  'bottomBarExtra={referenceBar}',
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
  2,
  'Workspace memo detail dialog must render root and relation cards through RefCard.',
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
  'if (ref.includes(\'/\')) continue',
]) {
  assert.ok(
    workspaceMemoDetailSource.includes(snippet),
    `workspace memo detail projection must be a small testable Skyline-style model: ${snippet}`,
  )
}

const detailRoot = makeMemo(1, {
  refs: ['2'],
  referencedBy: ['3'],
})
const detailProjection = buildWorkspaceMemoDetailProjection(
  detailRoot,
  [
    detailRoot,
    makeMemo(2, { content: wdfDocument('referenced memo') }),
    makeMemo(3, { content: wdfDocument('referencing memo') }),
  ],
  createMemoReferencePreviewResolver({
    getMemoById: (id) => (id === 2 ? makeMemo(2, { content: wdfDocument('referenced memo') }) : undefined),
  }),
)
assert.equal(
  detailProjection.rootMemo,
  detailRoot,
  'workspace memo detail projection must preserve the selected root memo.',
)
assert.deepEqual(
  detailProjection.referenceItems.map((item) =>
    item.kind === 'memo' ? toCardNote(item.memo) : item,
  ),
  [
    toCardNote(makeMemo(2, { content: wdfDocument('referenced memo') })),
  ],
  'workspace memo detail projection must preserve root refs order in the 引用 section.',
)
assert.deepEqual(
  detailProjection.referencedByItems.map((item) =>
    item.kind === 'memo' ? item.memo.id : item,
  ),
  [3],
  'workspace memo detail projection must preserve root referencedBy order in the 被引用 section.',
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
  'export function summarizeMemoContent',
  'export function buildMemoReferenceFallbackText',
  'export function buildMemoReferenceDisplayText',
  'export function createMemoReferencePreviewResolver',
  'export function buildMemoReferencePreviews',
  'const referenceId = memo.refs[0] ?? null',
  'memo.referencedBy.map((id) =>',
]) {
  assert.ok(
    memoDataSource.includes(snippet),
    `memo-data must mirror Skyline reference preview projection: ${snippet}`,
  )
}

assert.equal(
  summarizeMemoContent(wdfDocument('春'.repeat(60))),
  `${'春'.repeat(52)}...`,
)

const referencedMemo = makeMemo(7, {
  content: wdfDocument('被引用笔记的第一行\n第二行会折叠进摘要'),
  createdAt: '2026-06-19T10:30:00.000Z',
})
const childMemo = makeMemo(9, {
  content: wdfDocument('这条笔记引用了当前笔记'),
  createdAt: '2026-06-21T08:15:00.000Z',
})
const memo = makeMemo(5, {
  refs: ['7'],
  referencedBy: ['9'],
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
])

const cachedReferencedMemo = makeMemo(11, {
  content: wdfDocument('来自缓存的引用正文\n应该在切换标签后继续展示'),
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

for (const snippet of [
  "import { RefCard } from '@/components/ref-card'",
  'buildMemoReferencePreviews',
  'createMemoReferencePreviewResolver',
  'createWorkspaceMemoCacheIndex',
  'const memoById = useMemo(',
  'new Map(memoCards.map((memo) => [memo.id, memo]))',
  'const workspaceMemoCacheIndex = useMemo(',
  'createWorkspaceMemoCacheIndex(queryClient, memoCacheOwner, rawMemoCards)',
  'const referencePreviewResolver = useMemo(',
  'const cachedMemo = workspaceMemoCacheIndex.getMemoById(id)',
  'summaryCache: workspaceMemoCacheIndex.getSummaryCache()',
  'const referencePreviews = buildMemoReferencePreviews(',
  'referencePreviewResolver,',
  '<RefCard',
  'referencePreview={referencePreviews.referencePreview}',
  'referencedByPreviews={referencePreviews.referencedByPreviews}',
  'note={toCardNote(memo)}',
  'onDelete={() => handleMemoDelete(memo)}',
  'onSave={(draft) => handleMemoSave(memo, draft)}',
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

for (const forbiddenSnippet of [
  'useFriendReferencePreviewMap',
  'parseFriendMemoRef',
  'buildMemoFriendReferencePreview',
  'friendSummary',
  'friendMemo',
]) {
  assert.ok(
    !workspaceQueriesSource.includes(forbiddenSnippet),
    `workspace queries must not keep friend reference preview code: ${forbiddenSnippet}`,
  )
}

for (const forbiddenSnippet of [
  'getFriendSummary',
  '/friend/',
  'friendSummarySchema',
]) {
  assert.ok(
    !workspaceApiSource.includes(forbiddenSnippet),
    `workspace API must not keep friend endpoints: ${forbiddenSnippet}`,
  )
}

assert.ok(
  guestPageSource.includes("from '@/components/note-card'") &&
    workspacePageSource.includes("from '@/components/note-card'") &&
    !workspacePageSource.includes("from '@/components/card'") &&
    !guestPageSource.includes("from '@/components/card'"),
  'memo list pages must import card types from note-card after the WdfCard migration.',
)
