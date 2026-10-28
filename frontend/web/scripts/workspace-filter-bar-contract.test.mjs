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
const filterBarSource = readProjectFile(
  'src/features/workspace/workspace-filter-bar.tsx',
)
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const navigationSource = readProjectFile(
  'src/features/workspace/use-workspace-page-navigation.ts',
)
const indexCssSource = readProjectFile('src/index.css')
const tsconfigAppSource = readProjectFile('tsconfig.app.json')
const viteConfigSource = readProjectFile('vite.config.ts')

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-filter-bar-contract.test.mjs',
  ),
  'package test script must run the workspace FilterBar contract.',
)

for (const snippet of [
  "import { X } from 'lucide-react'",
  "import { Chip } from 'weimo-ui/components/chip'",
  "import type { WorkspaceNavigationFacet } from './workspace-navigation-store'",
  'export type WorkspaceFilterBarProps',
  'activeDate: string',
  'selectedFacet: WorkspaceNavigationFacet',
  'onClearDate: () => void',
  'onClearFacet: () => void',
  'const FACET_FILTER_LABELS',
  "annotation: '有批注'",
  "heading: '有标题'",
  "'unordered-list': '有列表'",
  "'markdown-quote': '有引用'",
  'label: `日期 ${normalizedDate}`',
  "clearLabel: '清除日期筛选'",
  'clearLabel: `清除${facetLabel}筛选`',
  'if (chips.length === 0) return null',
  "className={['workspace-filter-bar', className].filter(Boolean).join(' ')}",
  "aria-label={ariaLabel ?? '当前筛选条件'}",
  'content={item.label}',
  'variant="glass"',
  'textSize="sm"',
  'className="workspace-filter-bar__close"',
  'aria-label={item.clearLabel}',
  '<X aria-hidden="true" />',
]) {
  assert.ok(
    filterBarSource.includes(snippet),
    `workspace FilterBar component must include ${snippet}`,
  )
}

assert.equal(
  filterBarSource.includes('selectedTag'),
  false,
  'workspace FilterBar must not accept or render selectedTag; TopBar TagBread owns tag display.',
)

for (const [label, source] of [
  ['authenticated workspace page', workspacePageSource],
  ['guest workspace page', guestPageSource],
]) {
  for (const snippet of [
    "import { WorkspaceFilterBar } from '@/features/workspace/workspace-filter-bar'",
    '<WorkspaceFilterBar',
    'activeDate={navigation.activeDate}',
    'selectedFacet={navigation.selectedFacet}',
    'onClearDate={navigation.clearDateFilter}',
    'onClearFacet={navigation.clearFacetFilter}',
  ]) {
    assert.ok(source.includes(snippet), `${label} must include ${snippet}`)
  }
}

for (const snippet of [
  'const clearDateFilter = useWorkspaceNavigationStore((state) => state.clearDateFilter)',
  'const clearFacetFilter = useWorkspaceNavigationStore((state) => state.clearFacetFilter)',
  'clearDateFilter,',
  'clearFacetFilter,',
]) {
  assert.ok(
    navigationSource.includes(snippet),
    `workspace navigation seam must include ${snippet}`,
  )
}

for (const snippet of [
  '.workspace-filter-bar',
  'flex-wrap: wrap',
  'gap: 8px',
  'max-width: var(--size-content-max-width)',
  '.workspace-filter-bar__close',
  '.workspace-filter-bar__close svg',
  '.workspace-filter-bar .chip',
]) {
  assert.ok(
    indexCssSource.includes(snippet),
    `index.css must include FilterBar style snippet ${snippet}`,
  )
}

assert.equal(
  tsconfigAppSource.includes('weimo-ui'),
  false,
  'tsconfig.app.json must resolve weimo-ui through the installed package interface.',
)
// optimizeDeps.include 允许出现 "weimo-ui > 包名" 条目（源码态发布的预构建需要），
// 契约只约束 resolve.alias 不得别名 weimo-ui 内部路径绕过包接口
const viteAliasBlock = viteConfigSource.match(/alias:\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
assert.equal(
  viteAliasBlock.includes('weimo-ui'),
  false,
  'vite.config.ts must not alias weimo-ui internals.',
)
