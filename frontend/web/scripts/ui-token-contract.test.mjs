import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const uiRoot = join(root, 'node_modules/weimo-ui')

function readProjectFile(base, relativePath) {
  const absolutePath = join(base, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

function blockFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))

  assert.ok(match, `${selector} block must exist.`)

  return match[1]
}

function declarationValue(block, tokenName) {
  const escapedTokenName = tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`${escapedTokenName}\\s*:\\s*([^;]+);`))

  assert.ok(match, `${tokenName} must be declared.`)

  return match[1].trim()
}

function assertDeclaration(block, tokenName, expectedValue, message) {
  assert.equal(declarationValue(block, tokenName), expectedValue, message)
}

function assertDeclarationAbsent(block, tokenName, message) {
  const escapedTokenName = tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  assert.doesNotMatch(block, new RegExp(`${escapedTokenName}\\s*:`), message)
}

function assertOpaqueDeclaration(block, tokenName, message) {
  const value = declarationValue(block, tokenName)

  assert.ok(
    !value.includes('rgba(') &&
      !value.includes('hsla(') &&
      !/\/\s*(?:0?\.\d+|[1-9]\d?%)/.test(value),
    message,
  )
}

function assertComponentTagWithProps(source, componentName, props, message) {
  const openingTags = Array.from(
    source.matchAll(new RegExp(`<${componentName}\\b[^>]*>`, 'g')),
    ([tag]) => tag,
  )

  assert.ok(
    openingTags.some((tag) =>
      props.every((prop) => tag.includes(`${prop.name}=${JSON.stringify(prop.value)}`)),
    ),
    message,
  )
}

function collectCssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectCssFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : []
  })
}

const demoIndexCss = readProjectFile(root, 'src/index.css')
const appSource = readProjectFile(root, 'src/features/workspace/workspace-demo-page.tsx')
const routerSource = readProjectFile(root, 'src/App.tsx')
const demoCardSource = readProjectFile(root, 'src/components/card.tsx')
const bijiSideBarSource = readProjectFile(
  root,
  'src/components/biji-side-bar.tsx',
)
assert.ok(
  routerSource.includes("from 'react-router'") &&
    routerSource.includes('<BrowserRouter') &&
    routerSource.includes('<Routes>') &&
    routerSource.includes('path="/"') &&
    routerSource.includes('path="/me"') &&
    routerSource.includes('path="/login"') &&
    routerSource.includes('<AuthProvider') &&
    routerSource.includes('<ProtectedRoute') &&
    routerSource.includes('<PublicOnlyRoute') &&
    routerSource.includes('<AuthFallbackRedirect'),
  'App must declare the React Router auth route table for /, /me, /login, and fallback routes.',
)
assert.ok(
  bijiSideBarSource.includes('sampleNavNodes') &&
    bijiSideBarSource.includes('variant="no-action"'),
  'BijiSideBar note range shortcuts must be rendered through shared TagTree nodes.',
)
assert.ok(
  !bijiSideBarSource.includes('function ShortcutRow') &&
    !bijiSideBarSource.includes('biji-side-bar__facet-row'),
  'BijiSideBar note range shortcuts must not keep a parallel hand-written tree implementation.',
)

const uiPackageJson = JSON.parse(readProjectFile(uiRoot, 'package.json'))
const sharedTokenCssPath = uiPackageJson.exports?.['./styles/tokens.css']
const sharedTokenCssAbsolutePath = join(uiRoot, sharedTokenCssPath ?? '')

assert.equal(
  sharedTokenCssPath,
  './src/styles/tokens.css',
  'ui package must export the shared component token stylesheet for workspace consumers.',
)

const sharedTokenCss = readProjectFile(uiRoot, sharedTokenCssPath)
const demoPackageJson = JSON.parse(readProjectFile(root, 'package.json'))
const demoRootBlock = blockFor(demoIndexCss, ':root')
const demoDarkBlock = blockFor(demoIndexCss, '.dark')
const removedColorAliasReferences = []

for (const cssFile of collectCssFiles(join(root, 'src'))) {
  const cssSource = readFileSync(cssFile, 'utf8')

  for (const token of [
    '--color-brand',
    '--color-brand-foreground',
    '--color-brand-strong',
    '--color-fg-strong',
    '--color-text-muted',
    '--color-text-muted-subtle',
    '--color-danger',
  ]) {
    if (cssSource.includes(`var(${token})`)) {
      removedColorAliasReferences.push(`${cssFile}: var(${token})`)
    }
  }
}

assert.match(
  demoIndexCss,
  /@import\s+["']weimo-ui\/styles\/tokens\.css["'];/,
  'demo must consume shared UI component tokens instead of copying the token snapshot.',
)
assert.ok(
  sharedTokenCss.includes(
    '--font-sans: "Segoe UI", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;',
  ),
  'shared UI tokens must define the canonical default sans font stack.',
)
assert.deepEqual(
  removedColorAliasReferences,
  [],
  `biji-react CSS must use canonical --color-text-* or action tokens instead of removed color aliases:\n${removedColorAliasReferences.join('\n')}`,
)
assert.ok(
    sharedTokenCss.includes('--color-bg-chip: hsl(40 12% 96%);') &&
    sharedTokenCss.includes('--color-bg-chip: hsl(0 0% 13%);') &&
    sharedTokenCss.includes('--color-bg-hover: hsl(40 12% 96%);') &&
    sharedTokenCss.includes('--color-bg-hover: hsl(0 0% 20%);'),
  'shared UI tokens must keep TagChip display surfaces neutral by default.',
)
assert.ok(
  !sharedTokenCss.includes('--glass-gradient'),
  'shared UI tokens must not export a glass background gradient token.',
)
assert.ok(
  !sharedTokenCss.includes('--color-bg-pressable-overlay'),
  'shared UI tokens must not export a separate pressable overlay token after feedback tokens are merged.',
)

assertDeclaration(
  demoRootBlock,
  '--primary',
  '0 0% 15%',
  'demo light brand color must match the shared UI neutral primary token.',
)
assertDeclaration(
  demoRootBlock,
  '--primary-foreground',
  '0 0% 98%',
  'demo light brand foreground must match the shared UI neutral primary foreground token.',
)
assertDeclaration(
  demoRootBlock,
  '--border',
  '0 0% 80%',
  'demo light border input must match the shared UI default border step.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-brand',
  'demo light tokens must not keep the removed brand color alias.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-brand-strong',
  'demo light tokens must not keep the removed strong brand color alias.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-fg-strong',
  'demo light tokens must not keep the removed strong foreground alias.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-text-primary',
  'demo light tokens must inherit the shared concrete primary text token.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-text-secondary',
  'demo light tokens must inherit the shared concrete secondary text token.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-text-subtle',
  'demo light tokens must inherit the shared concrete subtle text token.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--color-text-muted',
  'demo light tokens must not keep the removed muted text alias.',
)
assertDeclaration(
  demoRootBlock,
  '--color-bg-chip',
  'hsl(34 12% 95%)',
  'demo light TagChip display surfaces must stay neutral like shared UI tokens.',
)
assertDeclaration(
  demoRootBlock,
  '--color-bg-hover',
  'hsl(34 12% 95%)',
  'demo light hover surfaces must use an opaque neutral background.',
)
assertOpaqueDeclaration(
  demoRootBlock,
  '--color-bg-chip',
  'demo light TagChip display surfaces must not use alpha.',
)
assertOpaqueDeclaration(
  demoRootBlock,
  '--color-bg-hover',
  'demo light hover surfaces must not use alpha.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--glass-gradient',
  'demo light tokens must inherit glass blur without reintroducing a local glass gradient.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--accent',
  'demo light tokens must not keep an app-local orange accent token.',
)
assertDeclarationAbsent(
  demoRootBlock,
  '--accent-foreground',
  'demo light tokens must not keep an app-local orange accent foreground token.',
)

assertDeclaration(
  demoDarkBlock,
  '--primary',
  '0 0% 96%',
  'demo dark brand color must match the shared UI neutral primary token.',
)
assertDeclaration(
  demoDarkBlock,
  '--primary-foreground',
  '0 0% 9%',
  'demo dark brand foreground must match the shared UI neutral primary foreground token.',
)
assertDeclaration(
  demoDarkBlock,
  '--border',
  '0 0% 38%',
  'demo dark border input must match the shared UI default border step.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-brand',
  'demo dark tokens must not keep the removed brand color alias.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-brand-strong',
  'demo dark tokens must not keep the removed strong brand color alias.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-fg-strong',
  'demo dark tokens must not keep the removed strong foreground alias.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-text-primary',
  'demo dark tokens must inherit the shared concrete primary text token.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-text-secondary',
  'demo dark tokens must inherit the shared concrete secondary text token.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-text-subtle',
  'demo dark tokens must inherit the shared concrete subtle text token.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--color-text-muted',
  'demo dark tokens must not keep the removed muted text alias.',
)
assertDeclaration(
  demoDarkBlock,
  '--color-bg-chip',
  'hsl(0 0% 13%)',
  'demo dark TagChip display surfaces must stay neutral like shared UI tokens.',
)
assertDeclaration(
  demoDarkBlock,
  '--color-bg-hover',
  'hsl(0 0% 20%)',
  'demo dark hover surfaces must use an opaque neutral background.',
)
assertOpaqueDeclaration(
  demoDarkBlock,
  '--color-bg-chip',
  'demo dark TagChip display surfaces must not use alpha.',
)
assertOpaqueDeclaration(
  demoDarkBlock,
  '--color-bg-hover',
  'demo dark hover surfaces must not use alpha.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--glass-gradient',
  'demo dark tokens must inherit glass blur without reintroducing a local glass gradient.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--accent',
  'demo dark tokens must not keep an app-local orange accent token.',
)
assertDeclarationAbsent(
  demoDarkBlock,
  '--accent-foreground',
  'demo dark tokens must not keep an app-local orange accent foreground token.',
)
assert.doesNotMatch(
  demoIndexCss,
  /#ca5421|#f08646|品牌橙|蜜桃色/,
  'demo brand token comments and literals must not preserve the old orange/peach brand language.',
)
assert.ok(
  !demoIndexCss.includes('@fontsource-variable/geist') &&
    !demoIndexCss.includes('Geist Variable') &&
    !demoIndexCss.includes('--font-sans:') &&
    !demoPackageJson.dependencies?.['@fontsource-variable/geist'],
  'demo must inherit the shared UI default font stack instead of overriding it with Geist.',
)

for (const snippet of [
  '--color-text-placeholder: rgb(0 0 0 / 0.26);',
  '--color-text-placeholder: rgb(255 255 255 / 0.26);',
  '--color-border-divider: hsl(0 0% 88%);',
  '--color-border-divider: hsl(0 0% 28%);',
  '--color-border: hsl(0 0% 90%);',
  '--color-border: hsl(0 0% 20%);',
  '--color-border-emphasis: hsl(0 0% 68%);',
  '--color-border-emphasis: hsl(0 0% 50%);',
  '--color-border-accent: hsl(0 0% 35%);',
  '--color-border-accent: hsl(0 0% 75%);',
  '--color-border-danger: #b42318;',
  '--color-border-danger: #ff8a7a;',
]) {
  assert.ok(sharedTokenCss.includes(snippet), `shared UI tokens must include ${snippet}`)
}

const sharedTokenNames = new Set(
  Array.from(sharedTokenCss.matchAll(/--([A-Za-z0-9-]+)\s*:/g), ([, token]) => token),
)
const componentLocalTokenNames = new Set()
const componentTokenReferences = new Map()
const componentInlineStyleTokenNames = new Set()

for (const inlineStyleSourcePath of [
  'src/components/card.tsx',
  'src/components/card-resolvers.tsx',
]) {
  for (const [, token] of readProjectFile(uiRoot, inlineStyleSourcePath).matchAll(
    /'--([A-Za-z0-9-]+)'/g,
  )) {
    componentInlineStyleTokenNames.add(token)
  }
}

for (const cssFile of collectCssFiles(join(uiRoot, 'src/components'))) {
  const cssSource = readFileSync(cssFile, 'utf8')

  for (const [, token] of cssSource.matchAll(/--([A-Za-z0-9-]+)\s*:/g)) {
    componentLocalTokenNames.add(token)
  }

  for (const [, token, fallbackMarker] of cssSource.matchAll(/var\(--([A-Za-z0-9-]+)(\s*,)?/g)) {
    componentTokenReferences.set(token, componentTokenReferences.get(token) || Boolean(fallbackMarker))
  }
}

for (const [token, hasLocalFallback] of componentTokenReferences) {

  assert.ok(
    sharedTokenNames.has(token) ||
      componentLocalTokenNames.has(token) ||
      componentInlineStyleTokenNames.has(token) ||
      hasLocalFallback,
    `shared UI tokens must define --${token} because component CSS references it.`,
  )
}

assert.ok(
  !demoIndexCss.includes(sharedTokenCssAbsolutePath),
  'demo must import the shared token stylesheet through the ui package export, not by filesystem path.',
)

for (const token of [
  '--color-text-placeholder',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-subtle',
  '--space-card-padding',
  '--space-card-section-gap',
  '--size-icon-button-sm',
  '--font-size-sm',
  '--color-border-accent',
  '--color-border-danger',
  '--glass-shadow',
  '--glass-shadow-elevated',
  '--glass-shadow-bleed',
]) {
  assert.ok(
    !demoRootBlock.includes(`${token}:`) && !demoDarkBlock.includes(`${token}:`),
    `demo must not copy component token ${token}; it should inherit it from ui/styles/tokens.css.`,
  )
}

assert.ok(
    /import\s+\{[\s\S]*\bRefCard\b[\s\S]*\}\s+from\s+['"]@\/components\/ref-card['"]/.test(appSource) &&
    appSource.includes('<RefCard') &&
    appSource.includes('note={toCardNote(memo)}') &&
    appSource.includes(
      'onSave={(draft) => handleMemoSave(memo, draft)}',
    ) &&
    appSource.includes('tagOptions={tagOptions}'),
  'demo note list cards must render backend memo data through the internal RefCard component.',
)
assert.ok(
  /import\s+type\s+\{[\s\S]*\bCardDraft\b[\s\S]*\}\s+from\s+['"]@\/components\/card['"]/.test(appSource) &&
    appSource.includes('const handleMemoSave = useCallback((memo: Memo, draft: CardDraft) => {') &&
    appSource.includes('const content = draft.content.trim()') &&
    appSource.includes('const tags = [...draft.tags]') &&
    appSource.includes('payload: { content, tags, refs: [...memo.refs] }') &&
    !appSource.includes('<Card\n                    disabled') &&
    !appSource.includes('saveMemo') &&
    !appSource.includes('createdAtText: memo.timestampText') &&
    !appSource.includes('const memoCards: MemoCard[]'),
  'demo note list must persist Card edits to the backend memo mutation.',
)
assert.ok(
  !appSource.includes('EditableCard') &&
    !appSource.includes('editingMemoId') &&
    !appSource.includes('editing=') &&
    !appSource.includes('onEdit=') &&
    !appSource.includes('type CardProps') &&
    !appSource.includes('<CardHeader') &&
    !appSource.includes('<CardContent') &&
    !appSource.includes('<CardFooter'),
  'demo must not use removed EditableCard or Card convenience composition props.',
)

assert.ok(
  demoCardSource.includes('Card as UiCard,') &&
    demoCardSource.includes('type CardProps,') &&
    demoCardSource.includes('export type {') &&
    demoCardSource.includes('CardDraft,') &&
    demoCardSource.includes('CardNote,') &&
    demoCardSource.includes('CardLabels,') &&
    demoCardSource.includes('CardEditorOptions,') &&
    demoCardSource.includes('const BIJI_CARD_TRANSITION_MS = 180') &&
    demoCardSource.includes('return <UiCard transitionDurationMs={transitionDurationMs} {...props} />') &&
    demoCardSource.includes("from 'weimo-ui/components/card'"),
  'demo Card adapter must wrap the shared UI Card API while applying the biji-react transition duration.',
)
assert.ok(
  !demoCardSource.includes('CardHeader') &&
    !demoCardSource.includes('CardContent') &&
    !demoCardSource.includes('CardFooter') &&
    !demoCardSource.includes('EditableCard'),
  'demo Card adapter must not re-export removed Card composition or EditableCard APIs.',
)

assert.ok(
  !existsSync(join(root, 'src/components/editable-card.tsx')),
  'demo must not keep a local EditableCard adapter; it should use ui/components/card through the local Card re-export.',
)
assert.ok(
  !existsSync(join(root, 'src/components/icon-button.tsx')),
  'biji-react must not keep the removed local IconButton adapter; import GlassIconButton or GhostIconButton directly.',
)

assert.ok(
  !demoIndexCss.includes('.weimo-demo-note-card[data-editing="true"] .md-editor__viewport'),
  'demo must rely on shared Card compact edit layout instead of overriding MdEditor internals.',
)

for (const snippet of [
  '<WorkspaceShell',
  'sidebar={(api) => (',
  'onClose={api.close}',
  'topBarActions={',
  'topBarLeading={',
]) {
  assert.ok(
    appSource.includes(snippet),
    `demo must build the workspace frame through the SiteTemplate shell: ${snippet}`,
  )
}

const siteTemplateContentOverrideBlock = blockFor(
  demoIndexCss,
  '.weimo-site-template .weimo-site-template__content',
)

assert.ok(
  siteTemplateContentOverrideBlock.includes('gap: 0;'),
  'demo must zero the SiteTemplate content gap so pending create spacing stays app-owned.',
)
assert.ok(
  demoIndexCss.includes('.weimo-site-template__content > * + * {') &&
    demoIndexCss.includes('margin-top: var(--space-gutter);') &&
    demoIndexCss.includes(
      '.weimo-site-template__content > .weimo-card-composer + * {',
    ),
  'demo must own the note list vertical rhythm inside the SiteTemplate content column.',
)
assert.ok(
  !appSource.includes('max-w-(--size-layout-max-width)') &&
    !appSource.includes('gap-(--space-gutter)'),
  'demo must not keep one-off Tailwind layout utilities that drift from the shared site shell contract.',
)

const demoSidebarSource = readProjectFile(root, 'src/components/sidebar.tsx')
const bijiSideBarCss = readProjectFile(
  root,
  'src/components/biji-side-bar.css',
)
const bijiSideBarRootBlock = blockFor(bijiSideBarCss, '.biji-side-bar')
const bijiSideBarHeaderBlock = blockFor(
  bijiSideBarCss,
  '.biji-side-bar__header',
)
const bijiSideBarIdentityBlock = blockFor(
  bijiSideBarCss,
  '.biji-side-bar__identity',
)
const bijiSideBarStatGroupBlock = blockFor(
  bijiSideBarCss,
  '.biji-side-bar__stats .stat-group',
)
const bijiSideBarHeatmapBlock = blockFor(
  bijiSideBarCss,
  '.biji-side-bar__stats .heatmap',
)
const bijiSideBarSectionHintBlock = blockFor(
  bijiSideBarCss,
  '.biji-side-bar__section-hint',
)

assert.ok(
  demoSidebarSource.includes('BijiSideBar'),
  'demo SideBar adapter must render the BijiSideBar content.',
)
assert.ok(
  !demoSidebarSource.includes('drawerAction=') &&
    !demoSidebarSource.includes("import { X } from 'lucide-react'"),
  'demo SideBar adapter must not render a drawer close button over the BijiSideBar header.',
)

for (const snippet of [
  "from 'weimo-ui/components/stat-group'",
  "from 'weimo-ui/components/heatmap'",
  "from 'weimo-ui/components/tag-tree'",
  "from 'weimo-ui/components/ghost-icon-button'",
]) {
  assert.ok(
    bijiSideBarSource.includes(snippet),
    `BijiSideBar must compose ${snippet}.`,
  )
}

for (const ariaLabel of ['打开设置']) {
  assertComponentTagWithProps(
    bijiSideBarSource,
    'GhostIconButton',
    [
      { name: 'aria-label', value: ariaLabel },
      { name: 'size', value: 'sm' },
    ],
    `BijiSideBar header ${ariaLabel} button must use the shared small GhostIconButton.`,
  )
}
assert.ok(
  !bijiSideBarSource.includes("from 'weimo-ui/components/icon-button'") &&
    !bijiSideBarSource.includes('<IconButton') &&
    !bijiSideBarSource.includes('variant="ghost"'),
  'BijiSideBar must not use the removed IconButton API after the shared button split.',
)

assert.ok(
  !bijiSideBarSource.includes('biji-side-bar__badge') &&
    !bijiSideBarCss.includes('biji-side-bar__badge'),
  'BijiSideBar header notification button must not render a badge marker.',
)

assert.ok(
  bijiSideBarSource.includes('sampleNavNodes') &&
    !bijiSideBarSource.includes('sampleTagNodes') &&
    !bijiSideBarSource.includes('sampleDailyCounts'),
  'BijiSideBar must keep sample navigation nodes but remove sample tag and heatmap data.',
)
assert.match(
  bijiSideBarSource,
  /<TagTree[\s\S]*?nodes=\{tagTreeNodes\}[\s\S]*?onMenuAction=\{tagMenuEnabled \? handleTagMenuAction : undefined\}[\s\S]*?onSelect=\{handleTagSelect\}[\s\S]*?>/,
  'BijiSideBar tag tree must wire its three-dot ActionMenu through the self-scope onMenuAction gate.',
)

assert.ok(
  bijiSideBarRootBlock.includes(
    '--biji-side-bar-content-width: min(243px, calc(100% - 24px));',
  ) &&
    bijiSideBarRootBlock.includes(
      '--biji-side-bar-edge-inline: calc((100% - var(--biji-side-bar-content-width)) / 2);',
    ) &&
    bijiSideBarRootBlock.includes(
      '--biji-side-bar-tag-tree-row-body-padding-inline: var(--tag-tree-row-body-padding-inline, 3px);',
    ),
  'BijiSideBar must derive one shared visual edge and expose parent-scope TagTree compensation.',
)
assert.ok(
  bijiSideBarHeaderBlock.includes(
    'padding-inline: var(--biji-side-bar-edge-inline);',
  ),
  'BijiSideBar header must align to the shared sidebar visual edge.',
)
assert.ok(
  bijiSideBarIdentityBlock.includes('font-size: var(--font-size-base);'),
  'BijiSideBar identity must use the shared base font size instead of a custom display size.',
)
assert.doesNotMatch(
  bijiSideBarCss,
  /\.biji-side-bar__header-button\s+svg\s*\{/,
  'BijiSideBar header IconButtons must use shared IconButton sizing instead of overriding the icon glyph size.',
)
assert.ok(
  bijiSideBarStatGroupBlock.includes(
    'width: var(--biji-side-bar-content-width);',
  ) &&
    bijiSideBarStatGroupBlock.includes('max-width: none;') &&
    bijiSideBarStatGroupBlock.includes(
      'margin-inline: var(--biji-side-bar-edge-inline);',
    ),
  'BijiSideBar stats must use the same visual width as the sidebar rows.',
)
assert.ok(
  bijiSideBarHeatmapBlock.includes(
    'padding-inline: var(--biji-side-bar-edge-inline);',
  ),
  'BijiSideBar heatmap must start and end on the shared visual edge.',
)
assert.match(
  bijiSideBarCss,
  /\.biji-side-bar__nav,\s*\.biji-side-bar__tags\s*\{[\s\S]*?padding-inline:\s*calc\(var\(--biji-side-bar-edge-inline\) - var\(--biji-side-bar-tag-tree-row-body-padding-inline\)\);/,
  'BijiSideBar nav and tag sections must compensate for TagTree row body padding while preserving the shared visual edge.',
)
assert.ok(
  bijiSideBarSectionHintBlock.includes('padding-inline: var(--biji-side-bar-tag-tree-row-body-padding-inline);'),
  'BijiSideBar section hints must align with TagTree row content after section padding compensation.',
)
assert.ok(
  !bijiSideBarSource.includes('className="biji-side-bar__nav-tree"') &&
    !/\.biji-side-bar__[^{]*\.tag-tree/.test(bijiSideBarCss) &&
    !/\.biji-side-bar__[^{]*\.tag-tree__/.test(bijiSideBarCss),
  'BijiSideBar must rely on shared TagTree styles instead of overriding TagTree internals.',
)
assert.ok(
  !demoIndexCss.includes('--color-bg-selected'),
  'demo must use the shared TagTree selected row background token.',
)
