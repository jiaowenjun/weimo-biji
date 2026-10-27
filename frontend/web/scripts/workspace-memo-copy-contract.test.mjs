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
const workspaceMemoCopySource = readProjectFile(
  'src/features/workspace/workspace-memo-copy.ts',
)

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-memo-copy-contract.test.mjs',
  ),
  'package test script must run the memo copy contract.',
)

for (const snippet of [
  'onCopySelect?: () => void',
  'onCopySelect,',
  "key: 'copy'",
  "label: '复制'",
  'icon: icon(Copy)',
  'onSelect: onCopySelect',
]) {
  assert.ok(
    workspaceMemoCardMenuSource.includes(snippet),
    `workspace memo card menu must expose the 复制 action: ${snippet}`,
  )
}

const { buildWorkspaceMemoCardMenuItems } = await import(
  '../src/features/workspace/workspace-memo-card-menu.ts'
)

let copySelectCount = 0
let quoteSelectCount = 0
let detailSelectCount = 0
const menu = buildWorkspaceMemoCardMenuItems({
  showMemoDetailPage: true,
  onCopySelect: () => {
    copySelectCount += 1
  },
  onMemoDetailSelect: () => {
    detailSelectCount += 1
  },
  onQuoteSelect: () => {
    quoteSelectCount += 1
  },
})
const copyItem = menu.find((item) => item.key === 'copy')
const quoteItem = menu.find((item) => item.key === 'quote')
const detailItem = menu.find((item) => item.key === 'memo-detail')

assert.equal(
  typeof copyItem?.onSelect,
  'function',
  '复制 menu item must call the page-level copy handler.',
)
copyItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
assert.equal(copySelectCount, 1, '复制 menu item must invoke copy once.')
assert.equal(quoteSelectCount, 0, '复制 menu item must not invoke quote.')
assert.equal(detailSelectCount, 0, '复制 menu item must not invoke detail.')
quoteItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
detailItem?.onSelect?.({ preventDefault() {}, stopPropagation() {} })
assert.equal(copySelectCount, 1, 'other menu items must not invoke copy.')

for (const snippet of [
  'onCopySelect?: () => void',
  'onCopySelect,',
  'onCopySelect,',
  'const displayMenuItems = buildWorkspaceMemoCardMenuItems({',
]) {
  assert.ok(
    refCardSource.includes(snippet),
    `RefCard must pass the 复制 callback into the menu builder: ${snippet}`,
  )
}

for (const snippet of [
  'export interface MemoClipboard',
  'writeText(content: string): Promise<void>',
  'function getMemoClipboard',
  'navigator.clipboard',
  'export async function copyMemoContentToClipboard',
  'content: string',
  'clipboard: MemoClipboard | null = getMemoClipboard()',
  'await clipboard.writeText(content)',
  "throw new Error('Clipboard API unavailable')",
]) {
  assert.ok(
    workspaceMemoCopySource.includes(snippet),
    `workspace memo copy helper must mirror Skyline raw-content clipboard behavior: ${snippet}`,
  )
}

const { copyMemoContentToClipboard } = await import(
  '../src/features/workspace/workspace-memo-copy.ts'
)

const copiedText = []
await copyMemoContentToClipboard('# Title\nBody line', {
  writeText: async (content) => {
    copiedText.push(content)
  },
})
assert.deepEqual(
  copiedText,
  ['# Title\nBody line'],
  'copy helper must copy only the raw memo content.',
)

await assert.rejects(
  copyMemoContentToClipboard('Body line', null),
  /Clipboard API unavailable/,
  'copy helper must reject when clipboard access is unavailable.',
)

for (const snippet of [
  "import { copyMemoContentToClipboard } from './workspace-memo-copy'",
  'const handleMemoCopy = useCallback((memo: Memo) => {',
  'void copyMemoContentToClipboard(memo.content).catch(() => {',
  "window.alert('复制失败')",
  'onCopySelect={() => handleMemoCopy(memo)}',
]) {
  assert.ok(
    workspacePageSource.includes(snippet),
    `workspace page must copy the raw memo content from the 复制 menu: ${snippet}`,
  )
}

for (const snippet of [
  "import { copyMemoContentToClipboard } from './workspace-memo-copy'",
  'const handleMemoCopy = useCallback((memo: Memo) => {',
  'void copyMemoContentToClipboard(memo.content).catch(() => {',
  "window.alert('复制失败')",
  'onCopySelect={() => handleMemoCopy(memo)}',
]) {
  assert.ok(
    guestPageSource.includes(snippet),
    `guest page must copy the raw memo content from the 复制 menu: ${snippet}`,
  )
}
