import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const guestPage = read('src/features/workspace/guest-workspace-page.tsx')
const guestAdapter = read('src/features/workspace/use-guest-workspace-tag-actions.ts')
const sidebar = read('src/components/sidebar.tsx')
const appSidebar = read('src/components/biji-side-bar.tsx')

for (const snippet of [
  "from '@weimo/workspace-core/use-workspace-tag-actions'",
  "mode: 'guest'",
  'items: memos',
  'setItems: setMemos',
  'setTagTree: setTagTreeMeta',
  'tagTree: tagTreeMeta',
]) {
  assert.ok(guestAdapter.includes(snippet), `guest tag adapter must include ${snippet}`)
}

for (const snippet of [
  'const liveTagTreeMeta = useMemo(',
  'buildGuestWorkspaceTagTree(memos, toTagOptions(tagTreeMeta))',
  'tagTreeMeta: liveTagTreeMeta',
  'onRenameTag={handleRenameTag}',
  'onDeleteTag={handleDeleteTag}',
  'mode="update"',
  'onApply={handleRenameTagApply}',
]) {
  assert.ok(guestPage.includes(snippet), `guest page must consume tag adapter: ${snippet}`)
}

for (const source of [sidebar, appSidebar]) {
  assert.ok(source.includes('onRenameTag'))
  assert.ok(source.includes('onDeleteTag'))
}

for (const forbidden of ['useRenameTagMutation', 'useDeleteTagMutation']) {
  assert.ok(!guestAdapter.includes(forbidden), `guest tag adapter must exclude ${forbidden}`)
}
