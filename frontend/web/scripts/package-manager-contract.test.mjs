import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))

function readJson(base, relativePath) {
  const absolutePath = join(base, relativePath)

  assert.ok(existsSync(absolutePath), `${relativePath} must exist.`)

  return JSON.parse(readFileSync(absolutePath, 'utf8'))
}

const packageJson = readJson(root, 'package.json')
const workspacePackageJson = readJson(repositoryRoot, 'package.json')

assert.equal(
  packageJson.packageManager,
  workspacePackageJson.packageManager,
  'biji-react packageManager must match the repository workspace packageManager so Corepack does not start pnpm with a stale nested version.',
)

assert.equal(
  packageJson.dependencies['weimo-ui'],
  undefined,
  'the monolith weimo-ui dependency must stay retired; new UI comes from weimo-ui-core and local ports.',
)
