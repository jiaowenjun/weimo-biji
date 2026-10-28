import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const editorRoot = join(root, 'node_modules/weimo-ui-editor')

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

const packageJson = JSON.parse(readProjectFile('package.json'))
const noteCardSource = readProjectFile('src/components/note-card.tsx')
const editorWdfCardSource = readFileSync(
  join(editorRoot, 'dist/components/wdf-card/wdf-card.js'),
  'utf8',
)
const editorWdfCardStyles = readFileSync(
  join(editorRoot, 'dist/components/wdf-card/wdf-card.css'),
  'utf8',
)

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-card-transition-contract.test.mjs',
  ),
  'package test script must run the workspace card transition contract.',
)

assert.ok(
  !existsSync(join(root, 'src/components/card.tsx')),
  'the old monolith Card adapter must be removed once WdfCard lands.',
)

// 编辑样式与过渡时长由编辑器包统一编排;biji 侧不再覆盖任何时长
assert.ok(
  packageJson.dependencies['weimo-ui-editor']?.startsWith('^'),
  'weimo-ui-editor must come from the npm registry after 0.4.0 was published.',
)
assert.ok(
  !existsSync(join(root, 'vendor/weimo-ui-editor-0.4.0.tgz')),
  'the vendored editor tarball must be removed once the registry dependency lands.',
)
assert.ok(
  packageJson.dependencies['weimo-wdf']?.startsWith('^'),
  'weimo-wdf must be a registry dependency for WDF documents.',
)

for (const snippet of [
  "import { WdfCard, type WdfCardHandle, type WdfCardMode } from 'weimo-ui-editor/components/wdf-card'",
  'value={note.content}',
  'defaultMode={defaultMode}',
  'onModeChange={handleModeChange}',
  'bottomBar={bottomBar}',
  'actionSlot={actionMenu}',
  'title={note.createdAtText}',
]) {
  assert.ok(
    noteCardSource.includes(snippet),
    `NoteCard must drive WdfCard through its public API: ${snippet}`,
  )
}

assert.ok(
  !noteCardSource.includes('transitionDurationMs'),
  'biji-react must not override editor-managed card transition timings.',
)

// 编辑器包的过渡编排契约(内联 48px 工具栏带 + 200ms 收高)不被本地覆盖
for (const snippet of [
  "height: 48px",
  'transition: height 200ms ease',
]) {
  assert.ok(
    editorWdfCardStyles.includes(snippet),
    `the editor card must keep choreographing its own toolbar transitions: ${snippet}`,
  )
}

assert.ok(
  editorWdfCardSource.includes('bottomBar'),
  'the vendored editor build must include the bottomBar slot.',
)
