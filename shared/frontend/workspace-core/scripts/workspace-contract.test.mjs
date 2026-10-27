import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const readRepositoryFile = (path) => readFileSync(`${repositoryRoot}/${path}`, 'utf8')
const workspaceSource = readRepositoryFile('pnpm-workspace.yaml')
const packageJson = JSON.parse(
  readRepositoryFile('shared/frontend/workspace-core/package.json'),
)
const bijiPackage = JSON.parse(readRepositoryFile('frontend/web/package.json'))
const bijiViteConfig = readRepositoryFile('frontend/web/vite.config.ts')

assert.ok(workspaceSource.includes('- "frontend/web"'))
assert.ok(workspaceSource.includes('- "shared/frontend/workspace-core"'))
assert.equal(packageJson.name, '@weimo/workspace-core')
assert.equal(packageJson.peerDependencies?.react, '^19.0.0')
assert.equal(bijiPackage.dependencies?.['@weimo/workspace-core'], 'workspace:*')
assert.equal(packageJson.exports?.['./cache'], './src/cache.ts')
assert.equal(packageJson.exports?.['./display-overrides'], './src/display-overrides.ts')
assert.equal(packageJson.exports?.['./guest-workspace'], './src/guest-workspace.ts')
assert.equal(packageJson.exports?.['./pending-create'], './src/pending-create.ts')
assert.equal(packageJson.exports?.['./tag-state'], './src/tag-state.ts')
assert.equal(packageJson.exports?.['./use-pending-create'], './src/use-pending-create.ts')
assert.equal(
  packageJson.exports?.['./use-workspace-tag-actions'],
  './src/use-workspace-tag-actions.ts',
)
assert.ok(
  bijiViteConfig.includes(
    "path.resolve(__dirname, '../../shared/frontend/workspace-core')",
  ),
)
