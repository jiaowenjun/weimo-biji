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
const localCardSource = readProjectFile('src/components/card.tsx')
const sharedCardSource = readUiFile('src/components/card.tsx')
const sharedCardEditTransitionSource = readUiFile('src/components/use-card-edit-transition.ts')
const sharedCardRuntimeSource = [
  sharedCardSource,
  sharedCardEditTransitionSource,
].join('\n')
const sharedCardResolversSource = readUiFile('src/components/card-resolvers.tsx')

assert.ok(
  packageJson.scripts?.test?.includes(
    'node scripts/workspace-card-transition-contract.test.mjs',
  ),
  'package test script must run the workspace card transition contract.',
)

for (const snippet of [
  'Card as UiCard,',
  'type CardProps,',
  "from 'weimo-ui/components/card'",
  'const BIJI_CARD_TRANSITION_MS = 180',
  'export function Card({',
  'transitionDurationMs = BIJI_CARD_TRANSITION_MS',
  '}: CardProps) {',
  'return <UiCard transitionDurationMs={transitionDurationMs} {...props} />',
]) {
  assert.ok(
    localCardSource.includes(snippet),
    `biji-react Card wrapper must default note card transitions to 180ms: ${snippet}`,
  )
}

for (const snippet of [
  'transitionDurationMs?: number',
  'transitionDurationMs = CARD_TRANSITION_MS',
  'const cardTransitionMs = transitionDurationMs',
  'durationMs: transitionDurationMs',
  'useHeightTransition(',
  'cardTransitionMs',
]) {
  assert.ok(
    sharedCardRuntimeSource.includes(snippet),
    `shared Card must use the configurable transition duration consistently: ${snippet}`,
  )
}

for (const snippet of [
  'export function resolveCardStyle(',
  "'--weimo-card-transition-duration': `${cardTransitionMs}ms`",
]) {
  assert.ok(
    sharedCardResolversSource.includes(snippet),
    `shared Card resolvers must apply the configurable transition duration consistently: ${snippet}`,
  )
}
