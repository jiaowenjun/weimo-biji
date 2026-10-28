import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const uiRoot = join(root, 'node_modules/weimo-ui')

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return readFileSync(absolutePath, 'utf8')
}

function readUiFile(relativePath) {
  const absolutePath = join(uiRoot, relativePath)

  assert.ok(existsSync(absolutePath), `installed weimo-ui/${relativePath} must exist.`)

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
const sharedCardSource = readUiFile('src/components/card.tsx')
const sharedCardEditTransitionSource = readUiFile('src/components/use-card-edit-transition.ts')
const sharedCardRuntimeSource = [
  sharedCardSource,
  sharedCardEditTransitionSource,
].join('\n')
const sharedCardComposerSource = readUiFile('src/components/card-composer.tsx')
const sharedComposerShellSource = readUiFile('src/components/composer-shell.tsx')
const sharedCardComposerCss = readUiFile('src/components/card-composer.css')

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
  '.weimo-site-template__content > .weimo-card-composer + * {',
]) {
  assert.ok(
    indexCss.includes(snippet),
    `pending create spacing must stay app-owned: ${snippet}`,
  )
}

for (const snippet of [
  '.weimo-card-composer {',
  'display: grid;',
  'grid-template-rows: 1fr;',
  'margin-bottom: var(--space-gutter);',
  'overflow: hidden;',
  'animation: weimo-card-composer-enter 180ms cubic-bezier(0.2, 0, 0, 1) both;',
  ".weimo-card-composer[data-state='closing'] {",
  'animation: weimo-card-composer-exit',
  'pointer-events: none;',
  '.weimo-card-composer__frame {',
  'min-height: 0;',
  'overflow: hidden;',
  '@keyframes weimo-card-composer-enter',
  'grid-template-rows: 0fr;',
  'margin-bottom: 0;',
  'opacity: 0;',
  'transform: translateY(-8px);',
  'grid-template-rows: 1fr;',
  'margin-bottom: var(--space-gutter);',
  'opacity: 1;',
  'transform: translateY(0);',
  '@keyframes weimo-card-composer-exit',
  'grid-template-rows: 0fr;',
  'margin-bottom: 0;',
  'opacity: 0;',
  'transform: translateY(-8px);',
  '@media (prefers-reduced-motion: reduce)',
  '.weimo-card-composer {',
  'animation: none;',
  'margin-bottom: var(--space-gutter);',
  ".weimo-card-composer[data-state='closing'] {",
  'margin-bottom: 0;',
]) {
  assert.ok(
    sharedCardComposerCss.includes(snippet),
    `shared CardComposer animation CSS must include: ${snippet}`,
  )
}

for (const snippet of [
  "import { CardComposer, type CardComposerProps } from 'weimo-ui/components/card-composer'",
  "import type { CardProps } from '@/components/card'",
  "import { RefCard } from '@/components/ref-card'",
  'type PendingCreateCardProps = CardComposerProps',
  'function renderPendingRefCard(cardProps: CardProps)',
  'return <RefCard {...cardProps} />',
  'export function PendingCreateCard(props: PendingCreateCardProps) {',
  '<CardComposer',
  '{...props}',
  'renderCard={renderPendingRefCard}',
]) {
  assert.ok(
    pendingCreateCardSource.includes(snippet),
    `PendingCreateCard must delegate to the shared CardComposer: ${snippet}`,
  )
}

for (const forbiddenSnippet of [
  "import { X } from 'lucide-react'",
  "import { useEffect, useRef, useState } from 'react'",
  "import type { TransitionEvent } from 'react'",
  "import { GhostIconButton } from 'weimo-ui/components/ghost-icon-button'",
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
  'export type CardComposerRenderCard = (props: CardProps) => ReactNode',
  'export type CardComposerProps = CardProps & {',
  'renderCard?: CardComposerRenderCard',
  'const externalCancel = editBehavior?.onCancel ?? onCancel',
  'disabled: disabled || isClosing',
  'actionSlot: editBehavior?.actionSlot ?? composerEditActionSlot',
  'onCancel: handleComposerClose',
  'const ComposerCard = renderCard ?? Card',
  '<ComposerShell',
  '<ComposerCard {...composerCardProps} />',
]) {
  assert.ok(
    sharedCardComposerSource.includes(snippet),
    `Shared CardComposer must preserve Card/RefCard composition boundaries: ${snippet}`,
  )
}

for (const snippet of [
  'export type ComposerShellProps = Omit<',
  'isClosing?: boolean',
  'onExitAnimationEnd?: () => void',
  'onViewTransitionEnd?: () => void',
  'export const ComposerShell = forwardRef<HTMLDivElement, ComposerShellProps>(',
  'className={cn(\'weimo-card-composer\', className)}',
  "data-state={isClosing ? 'closing' : undefined}",
  'onTransitionEnd={handleTransitionEnd}',
  '<div className="weimo-card-composer__frame">',
]) {
  assert.ok(
    sharedComposerShellSource.includes(snippet),
    `Shared ComposerShell must preserve shared composer animation frame boundaries: ${snippet}`,
  )
}

for (const snippet of [
  'initialEditAutoFocus?: boolean',
  'initialEditAutoFocus = true',
  'const initialEditAutoFocusCompletedRef = useRef(initialMode !== \'edit\')',
  'function focusInitialEditEditor()',
  'initialEditAutoFocusCompletedRef.current = true',
  "editorInstance.commands.focus('end')",
  'if (initialEditAutoFocus) focusInitialEditEditor()',
  'if (!initialEditAutoFocus) return',
  'if (!initialEditLayoutResolvedRef.current) return',
  'if (initialEditAutoFocusCompletedRef.current) return',
]) {
  assert.ok(
    sharedCardRuntimeSource.includes(snippet),
    `shared Card must allow pending create to delay initial edit focus: ${snippet}`,
  )
}
