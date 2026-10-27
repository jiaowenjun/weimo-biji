import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { workspaceTagUiReducer } from '../../../shared/frontend/workspace-core/src/tag-state.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const workspaceApi = read('src/features/workspace/workspace-api.ts')
const workspaceQueries = read('src/features/workspace/workspace-queries.ts')
const workspacePage = read('src/features/workspace/workspace-demo-page.tsx')
const tagAdapter = read('src/features/workspace/workspace-tag-actions.ts')
const sidebar = read('src/components/sidebar.tsx')
const appSidebar = read('src/components/biji-side-bar.tsx')

assert.deepEqual(
  workspaceTagUiReducer(
    { expandedTags: ['文学', '文学/古代'], renameRevision: 1, renamingTag: '文学' },
    { type: 'rename-succeeded', oldTag: '文学', newTag: '文学/中国文学', revision: 1 },
  ),
  {
    expandedTags: ['文学/中国文学', '文学/中国文学/古代'],
    renameRevision: 1,
    renamingTag: null,
  },
)

for (const snippet of [
  'export function renameTag(',
  "tag.replaceAll('/', '|')",
  '`/tag/${encodeTagPathParam(oldTag)}`',
  'body: JSON.stringify({ new_tag: newTag })',
  "method: 'PUT'",
]) assert.ok(workspaceApi.includes(snippet), `rename API must include ${snippet}`)

for (const snippet of [
  'export function useRenameTagMutation()',
  'await renameTag(token, input.oldTag, input.newTag)',
  'syncRenamedTagInWorkspaceCache(queryClient, scope, input.oldTag, input.newTag)',
  'invalidateWorkspaceCollections(queryClient, scope)',
]) assert.ok(workspaceQueries.includes(snippet), `rename mutation must include ${snippet}`)

for (const snippet of [
  'useWorkspaceTagActions as useWorkspaceTagActionController',
  'const renameTagMutation = useRenameTagMutation()',
  "mode: 'authenticated'",
  'renameTagMutation.mutateAsync({ oldTag, newTag })',
  "action === 'rename' ? '重命名标签失败' : '删除标签失败'",
]) assert.ok(tagAdapter.includes(snippet), `tag adapter must include ${snippet}`)

for (const snippet of [
  'useWorkspaceTagActions({',
  'onRenameTag={handleRenameTag}',
  'mode="update"',
  'onApply={handleRenameTagApply}',
]) assert.ok(workspacePage.includes(snippet), `workspace page must include ${snippet}`)

for (const source of [sidebar, appSidebar]) assert.ok(source.includes('onRenameTag'))
