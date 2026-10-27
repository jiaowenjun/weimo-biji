import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildGuestMemo } from '../src/features/workspace/guest-memo-create.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const packageJson = JSON.parse(read('package.json'))
const guestPage = read('src/features/workspace/guest-workspace-page.tsx')
const guestAdapter = read('src/features/workspace/use-guest-memo-create.ts')
const guestBuilder = read('src/features/workspace/guest-memo-create.ts')
const createController = read('src/features/workspace/use-memo-create.ts')

assert.ok(packageJson.scripts?.test?.includes('guest-create-memo-contract.test.mjs'))

assert.deepEqual(
  buildGuestMemo(
    [{ id: 4, content: '', tags: [], createdAt: '', updatedAt: '', refs: [], referencedBy: [] }],
    { content: 'draft', tags: ['work'] },
    '2026-07-22T00:00:00.000Z',
  ),
  {
    id: 5,
    content: 'draft',
    tags: ['work'],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    refs: [],
    referencedBy: [],
  },
)

for (const snippet of [
  "import { useGuestMemoCreate } from './use-guest-memo-create'",
  'const memoCreate = useGuestMemoCreate({',
  'onClick={memoCreate.start}',
  'onSave={memoCreate.save}',
  'onViewTransitionEnd={memoCreate.finishViewTransition}',
]) {
  assert.ok(guestPage.includes(snippet), `guest page must consume create adapter: ${snippet}`)
}

for (const snippet of [
  "import { useMemoCreate, type MemoCreateInput } from './use-memo-create'",
  "import { buildGuestMemo } from './guest-memo-create'",
  'buildGuestMemo(memos, input)',
  'setMemos((currentMemos) => [memo, ...currentMemos])',
  "clientIdPrefix: 'guest-pending'",
]) {
  assert.ok(guestAdapter.includes(snippet), `guest memo adapter must include ${snippet}`)
}

assert.ok(guestBuilder.includes('export function buildGuestMemo('))

for (const snippet of [
  "from '@weimo/workspace-core/use-pending-create'",
  'tags: toInitialCreateTags(selectedTag)',
  'const prepareSubmission = useCallback((draft: CardDraft)',
  'persistMemo({ content, tags })',
  'formatMemoTimestamp(',
]) {
  assert.ok(createController.includes(snippet), `memo create controller must include ${snippet}`)
}

for (const forbidden of ['useCreateMemoMutation', "method: 'POST'", 'requestProtectedJson']) {
  assert.ok(!guestAdapter.includes(forbidden), `guest adapter must remain local: ${forbidden}`)
}
