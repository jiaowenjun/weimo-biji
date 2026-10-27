import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url))

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
  'github:jiaowenjun/weimo-ui#18e6da6b4ab1ef3eb83cb8273712cf7b3d8c566b',
  'biji-react must consume the reviewed immutable weimo-ui commit.',
)
