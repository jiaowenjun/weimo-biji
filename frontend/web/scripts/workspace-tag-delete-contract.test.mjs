import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { workspaceTagUiReducer } from '../../../shared/frontend/workspace-core/src/tag-state.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const uiRoot = fileURLToPath(
  new URL('../node_modules/weimo-ui', import.meta.url),
)
const read = (base, path) => readFileSync(join(base, path), 'utf8')
const project = (path) => read(root, path)
const workspaceApi = project('src/features/workspace/workspace-api.ts')
const workspaceQueries = project('src/features/workspace/workspace-queries.ts')
const workspacePage = project('src/features/workspace/workspace-demo-page.tsx')
const guestPage = project('src/features/workspace/guest-workspace-page.tsx')
const tagAdapter = project('src/features/workspace/workspace-tag-actions.ts')
const guestAdapter = project('src/features/workspace/use-guest-workspace-tag-actions.ts')

assert.deepEqual(
  workspaceTagUiReducer(
    { expandedTags: ['文学', '文学/古代', '开发'], renameRevision: 1, renamingTag: '文学/古代' },
    { type: 'delete-succeeded', tag: '文学' },
  ),
  { expandedTags: ['开发'], renameRevision: 1, renamingTag: null },
)

for (const snippet of [
  'export function deleteTag(',
  '`/tag/${encodeTagPathParam(tag)}`',
  "method: 'DELETE'",
]) assert.ok(workspaceApi.includes(snippet), `delete API must include ${snippet}`)

for (const snippet of [
  'export function useDeleteTagMutation()',
  'await deleteTag(token, input.tag)',
  'syncDeletedTagInWorkspaceCache(queryClient, scope, input.tag)',
  'invalidateWorkspaceCollections(queryClient, scope)',
]) assert.ok(workspaceQueries.includes(snippet), `delete mutation must include ${snippet}`)

for (const snippet of [
  'const deleteTagMutation = useDeleteTagMutation()',
  'canManageTag: isSidebarActionableTag',
  '该标签将从所有笔记中移除',
  'deleteTagMutation.mutateAsync({ tag })',
  'showAllItems: showAllNotes',
]) assert.ok(tagAdapter.includes(snippet), `tag adapter must include ${snippet}`)

assert.ok(guestAdapter.includes("mode: 'guest'"))
assert.ok(workspacePage.includes('onDeleteTag={handleDeleteTag}'))
assert.ok(guestPage.includes('onDeleteTag={handleDeleteTag}'))

for (const [path, snippets] of [
  ['src/components/tag-tree/tag-tree-model.ts', ['menuEnabled?: boolean']],
  ['src/components/tag-tree/tag-tree.tsx', ['rowMenuEnabled={showMenu && row.node.menuEnabled !== false}']],
  ['src/components/tag-tree/tag-tree-row.tsx', ['rowMenuEnabled: boolean', '{rowMenuEnabled ? (']],
]) {
  const source = read(uiRoot, path)
  for (const snippet of snippets) assert.ok(source.includes(snippet), `${path} must include ${snippet}`)
}
