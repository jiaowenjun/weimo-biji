import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const packageJson = JSON.parse(read('package.json'))
const workspaceApi = read('src/features/workspace/workspace-api.ts')
const workspaceQueries = read('src/features/workspace/workspace-queries.ts')
const workspacePage = read('src/features/workspace/workspace-demo-page.tsx')
const authAdapter = read('src/features/workspace/use-authenticated-memo-create.ts')
const guestAdapter = read('src/features/workspace/use-guest-memo-create.ts')

assert.ok(packageJson.scripts?.test?.includes('workspace-create-memo-contract.test.mjs'))

for (const snippet of [
  'export function createMemo',
  "requestProtectedJson('/memo', token, mutationIdSchema, {",
  "method: 'POST'",
  'body: JSON.stringify(payload)',
]) {
  assert.ok(workspaceApi.includes(snippet), `memo API must include ${snippet}`)
}

for (const snippet of [
  'export function useCreateMemoMutation()',
  'createMemo(token, input.payload)',
  'invalidateWorkspaceCollections(queryClient, scope)',
]) {
  assert.ok(workspaceQueries.includes(snippet), `memo mutation must include ${snippet}`)
}

for (const snippet of [
  "import { useAuthenticatedMemoCreate } from './use-authenticated-memo-create'",
  'const memoCreate = useAuthenticatedMemoCreate(navigation.selectedTag)',
  'onClick={memoCreate.start}',
  'onSave={memoCreate.save}',
  'onViewTransitionEnd={memoCreate.finishViewTransition}',
]) {
  assert.ok(workspacePage.includes(snippet), `workspace page must consume create adapter: ${snippet}`)
}

for (const snippet of [
  'const { isPending, mutateAsync } = useCreateMemoMutation()',
  'payload: { content, tags, refs: [] }',
  "clientIdPrefix: 'pending'",
  'isPending,',
  'persistMemo,',
]) {
  assert.ok(authAdapter.includes(snippet), `authenticated memo adapter must include ${snippet}`)
}

for (const forbidden of ['useCreateMemoMutation', 'createMemoMutation']) {
  assert.ok(!guestAdapter.includes(forbidden), `guest memo adapter must exclude ${forbidden}`)
}
