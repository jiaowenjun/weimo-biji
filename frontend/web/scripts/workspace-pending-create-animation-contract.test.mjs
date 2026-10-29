import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const uiRoot = join(root, 'node_modules/weimo-ui-editor/dist/components/card-composer')

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

function readUiFile(relativePath) {
  const absolutePath = join(uiRoot, relativePath)

  assert.ok(existsSync(absolutePath), `installed weimo-ui-editor/${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

const packageJson = JSON.parse(readProjectFile('package.json'))
const workspacePageSource = readProjectFile(
  'src/features/workspace/workspace-demo-page.tsx',
)
const guestPageSource = readProjectFile(
  'src/features/workspace/guest-workspace-page.tsx',
)
const pendingCreateCardSource = readProjectFile(
  'src/features/workspace/pending-create-card.tsx',
)
const indexCss = readProjectFile('src/index.css')
const sharedCardComposerSource = readUiFile('card-composer.js')
const sharedComposerShellSource = readUiFile('composer-shell.js')
const sharedCardComposerCss = readUiFile('card-composer.css')

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-pending-create-animation-contract.test.mjs',
  ),
  'package test script must run the pending create animation contract.',
)

function assertPendingCreateAnimationWrapper(source, label) {
  const wrapperIndex = source.indexOf('<PendingCreateCard')

  assert.ok(
    wrapperIndex >= 0,
    `${label} page must render a pending create card.`,
  )
}

assertPendingCreateAnimationWrapper(workspacePageSource, 'workspace')
assertPendingCreateAnimationWrapper(guestPageSource, 'guest')

const siteTemplateContentOverrideMatch = indexCss.match(
  /\.weimo-site-template \.weimo-site-template__content\s*\{[\s\S]*?\n\}/,
)

assert.ok(
  siteTemplateContentOverrideMatch,
  'the SiteTemplate content column override must exist so pending create spacing stays app-owned.',
)
assert.ok(
  siteTemplateContentOverrideMatch[0].includes('gap: 0;'),
  'the SiteTemplate content gap must be zeroed because inserted pending create cards would make existing cards jump by the gap before the height animation starts.',
)

for (const snippet of [
  '.weimo-site-template__content > * + * {',
  'margin-top: var(--space-gutter);',
  '.weimo-site-template__content > .wdf-card-composer + * {',
]) {
  assert.ok(
    indexCss.includes(snippet),
    `pending create spacing must stay app-owned: ${snippet}`,
  )
}

for (const snippet of [
  '.wdf-card-composer {',
  'display: grid;',
  'grid-template-rows: 1fr;',
  'margin-bottom: var(--wdf-card-composer-gutter, var(--space-gutter));',
  'overflow: hidden;',
  'animation: wdf-card-composer-enter 180ms cubic-bezier(0.2, 0, 0, 1) both;',
  ".wdf-card-composer[data-state='closing'] {",
  'animation: wdf-card-composer-exit',
  '.wdf-card-composer__frame {',
  'min-height: 0;',
  'overflow: hidden;',
  '@keyframes wdf-card-composer-enter',
  'grid-template-rows: 0fr;',
  'margin-bottom: 0;',
  '@keyframes wdf-card-composer-exit',
  'grid-template-rows: 0fr;',
  'margin-bottom: 0;',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(
    sharedCardComposerCss.includes(snippet),
    `editor CardComposer animation CSS must include: ${snippet}`,
  )
}

for (const snippet of [
  "import { CardComposer } from 'weimo-ui-editor/components/card-composer'",
  "import { TagBar } from '@/components/tag-bar'",
  "import type { CardDraft, CardNote } from '@/components/note-card'",
  'type PendingCreateCardProps = {',
  'const [sessionTags, setSessionTags] = useState(() => note.tags ?? [])',
  '<CardComposer',
  'autoEnterEdit={initialMode !== \'view\'}',
  'bottomBar={',
  '<TagBar',
  'editable',
  'onTagsChange={setSessionTags}',
  'clientId={clientId}',
  'isClosing={isClosing}',
  'onCancel={onCancel}',
  'onExitAnimationEnd={onExitAnimationEnd}',
  'if (mode === \'view\') onViewTransitionEnd?.()',
  'onSave={(document) => onSave?.({ content: document, tags: [...sessionTags] })}',
  'title={note.createdAtText}',
]) {
  assert.ok(
    pendingCreateCardSource.includes(snippet),
    `PendingCreateCard must delegate to the editor CardComposer with a tag-editing bottom bar: ${snippet}`,
  )
}

for (const forbiddenSnippet of [
  "import { X } from 'lucide-react'",
  "import { useEffect, useRef, useState } from 'react'",
  "import type { TransitionEvent } from 'react'",
  "import { GhostIconButton } from 'weimo-ui-core/components/ghost-icon-button'",
  'MouseEvent',
  'PENDING_CREATE_CARD_TRANSITION_MS',
  'PendingCreateAutoFocusState',
  'wrapperRef',
  'getAnimations',
  'handlePendingCancelClickCapture',
  'onClickCapture={handlePendingCancelClickCapture}',
  'button.mode-button[data-mode="edit"][aria-label="取消"]',
  'editActionSlot={pendingCreateEditActionSlot}',
  'editCancelHandler={handlePendingCreateClose}',
  'className="pending-create-card"',
]) {
  assert.ok(
    !pendingCreateCardSource.includes(forbiddenSnippet),
    `PendingCreateCard must not keep app-local composer mechanics: ${forbiddenSnippet}`,
  )
}

for (const snippet of [
  'export function CardComposer',
  '"data-client-id": clientId',
  'bottomBar: bottomBar',
  'actionSlot: actionSlot',
  'onModeChange: handleModeChange',
  'value: cardDocument',
]) {
  assert.ok(
    sharedCardComposerSource.includes(snippet),
    `editor CardComposer must keep its shell/composer boundaries and slot pass-through: ${snippet}`,
  )
}

for (const snippet of [
  'export const ComposerShell = forwardRef',
  'isClosing = false',
  'onExitAnimationEnd',
  "\"data-state\": isClosing ? 'closing' : undefined",
  'wdf-card-composer',
  'wdf-card-composer__frame',
]) {
  assert.ok(
    sharedComposerShellSource.includes(snippet),
    `editor ComposerShell must preserve shared composer animation frame boundaries: ${snippet}`,
  )
}

// 编辑器版 CardComposer 有意不自动聚焦:编辑器亮着等用户点进去
// (旧卡的 initialEditAutoFocus 机制随 monolith Card 退役)
assert.ok(
  !pendingCreateCardSource.includes('initialEditAutoFocus'),
  'PendingCreateCard must not revive the retired initialEditAutoFocus mechanics.',
)

