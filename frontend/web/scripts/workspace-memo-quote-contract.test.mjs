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
const refCardSource = readProjectFile('src/components/ref-card.tsx')
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const workspaceMemoCardMenuSource = readProjectFile(
  'src/features/workspace/workspace-memo-card-menu.ts',
)
const quoteDialogSource = readProjectFile(
  'src/features/workspace/workspace-memo-quote-dialog.tsx',
)
const quoteDialogCss = readProjectFile(
  'src/features/workspace/workspace-memo-quote-dialog.css',
)

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-memo-quote-contract.test.mjs',
  ),
  'package test script must run the memo quote contract.',
)

for (const snippet of [
  'onQuoteSelect?: () => void',
  'onQuoteSelect,',
  "key: 'quote'",
  "label: '批注'",
  'icon: icon(Quote)',
  'onSelect: onQuoteSelect',
]) {
  assert.ok(
    workspaceMemoCardMenuSource.includes(snippet),
    `workspace memo card menu must expose the 批注 action: ${snippet}`,
  )
}

const { buildWorkspaceMemoCardMenuItems } = await import(
  '../src/features/workspace/workspace-memo-card-menu.ts'
)

let quoteSelectCount = 0
let detailSelectCount = 0
const menu = buildWorkspaceMemoCardMenuItems({
  showMemoDetailPage: true,
  onMemoDetailSelect: () => {
    detailSelectCount += 1
  },
  onQuoteSelect: () => {
    quoteSelectCount += 1
  },
})
const quoteItem = menu.find((item) => item.key === 'quote')
const detailItem = menu.find((item) => item.key === 'memo-detail')

assert.equal(
  typeof quoteItem?.onSelect,
  'function',
  '批注 menu item must call the page-level quote opener.',
)
quoteItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
assert.equal(
  quoteSelectCount,
  1,
  '批注 menu item must invoke the supplied quote opener exactly once.',
)
assert.equal(
  detailSelectCount,
  0,
  '批注 menu item must not invoke the detail opener.',
)
detailItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
assert.equal(
  detailSelectCount,
  1,
  '查看详情 menu item must keep its existing detail opener.',
)
assert.equal(
  quoteSelectCount,
  1,
  '查看详情 menu item must not invoke the quote opener.',
)

for (const snippet of [
  'onQuoteSelect?: () => void',
  'onQuoteSelect,',
  'onQuoteSelect,',
  'const displayMenuItems = buildWorkspaceMemoCardMenuItems({',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must pass the 批注 callback into the menu builder: ${snippet}`,
  )
}

for (const snippet of [
  "import { ActionDialog } from 'weimo-ui/components/action-dialog'",
  "import { DialogPanel } from 'weimo-ui/components/coss/dialog'",
  "import type { CardDraft } from '@/components/card'",
  "import { RefCard } from '@/components/ref-card'",
  'buildMemoReferenceDisplayText',
  'formatMemoTimestamp',
  "import type { Memo } from './workspace-types'",
  "import './workspace-memo-quote-dialog.css'",
  'export interface WorkspaceMemoQuoteDialogProps',
  'memo: Memo | null',
  'onSave: (memo: Memo, draft: CardDraft) => void',
  'open: boolean',
  'title="批注"',
  'className="workspace-memo-quote-dialog"',
  'aria-label="批注编辑内容"',
  'role="region"',
  'note={quoteNote}',
  'initialMode="edit"',
  'key={memo.id}',
  'onCancel={handleCancel}',
  'onSave={handleSave}',
  'referencePreview={sourcePreview}',
  'tagOptions={tagOptions}',
  'formatMemoTimestamp(memo.createdAt)',
  'memo.content',
  'formatMemoTimestamp(new Date().toISOString())',
]) {
  assert.ok(
    quoteDialogSource.includes(snippet),
    `quote dialog must reuse the new-note RefCard editor and show source context: ${snippet}`,
  )
}

assert.ok(
  !quoteDialogSource.includes("from '@/components/md-editor'") &&
    !quoteDialogSource.includes('<MdEditor') &&
    !quoteDialogSource.includes('<textarea'),
  'quote dialog must not implement a separate editor; it should reuse RefCard/Card editing.',
)

for (const snippet of [
  '.workspace-memo-quote-dialog',
  'width: min(100%, 680px);',
  '.workspace-memo-quote-dialog__panel',
  'padding: var(--space-gutter);',
  '.workspace-memo-quote-dialog__editor',
  'display: grid;',
  'gap: var(--space-gutter);',
]) {
  assert.ok(
    quoteDialogCss.includes(snippet),
    `quote dialog CSS must keep the dialog aligned with detail/new-note surfaces: ${snippet}`,
  )
}

for (const snippet of [
  "import { WorkspaceMemoQuoteDialog } from './workspace-memo-quote-dialog'",
  'const [quoteMemoId, setQuoteMemoId] = useState<number | null>(null)',
  'const quoteMemo = quoteMemoId === null ? null : (memoById.get(quoteMemoId) ?? null)',
  '<WorkspaceMemoQuoteDialog',
  'memo={quoteMemo}',
  'onOpenChange={handleMemoQuoteOpenChange}',
  'onSave={handleMemoQuoteSave}',
  'open={quoteMemo !== null}',
  'tagOptions={tagOptions}',
  'const handleMemoQuoteOpenChange = useCallback((open: boolean) => {',
  'setQuoteMemoId(null)',
  'const handleMemoQuoteSave = useCallback((memo: Memo, draft: CardDraft) => {',
  'createWorkspaceMemo({ content, tags, refs: [String(memo.id)] })',
  'onQuoteSelect={() => setQuoteMemoId(memo.id)}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must create a referenced memo from the 批注 dialog: ${snippet}`,
  )
}

for (const snippet of [
  "import { WorkspaceMemoQuoteDialog } from './workspace-memo-quote-dialog'",
  'const [quoteMemoId, setQuoteMemoId] = useState<number | null>(null)',
  'const quoteMemo = quoteMemoId === null ? null : (memoById.get(quoteMemoId) ?? null)',
  '<WorkspaceMemoQuoteDialog',
  'memo={quoteMemo}',
  'onOpenChange={handleMemoQuoteOpenChange}',
  'onSave={handleMemoQuoteSave}',
  'open={quoteMemo !== null}',
  'tagOptions={tagOptions}',
  'const handleMemoQuoteOpenChange = useCallback((open: boolean) => {',
  'setQuoteMemoId(null)',
  'const handleMemoQuoteSave = useCallback((memo: Memo, draft: CardDraft) => {',
  'const quotedMemoRef = String(memo.id)',
  'refs: [quotedMemoRef]',
  'referencedBy: []',
  'currentMemo.id === memo.id',
  'referencedBy: Array.from(',
  'new Set([...currentMemo.referencedBy, String(createdMemo.id)])',
  'onQuoteSelect={() => setQuoteMemoId(memo.id)}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest page must create a local referenced memo from the 批注 dialog: ${snippet}`,
  )
}
