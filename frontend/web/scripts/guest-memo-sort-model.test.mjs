import assert from 'node:assert/strict'

const { filterGuestMemos } = await import(
  '../src/features/workspace/guest-workspace-data.ts'
)

function wdfDocument(text) {
  return {
    schema: 'weimo.document',
    version: 1,
    root: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  }
}

function memo(id, createdAt, tags = []) {
  return {
    id,
    content: wdfDocument(`memo-${id}`),
    createdAt,
    updatedAt: createdAt,
    tags,
    refs: [],
    referencedBy: [],
  }
}

const memos = [
  memo(1, '2026-06-19T20:05:00.000+08:00', ['开发']),
  memo(2, '2026-06-25T09:30:00.000+08:00', ['开发/调试']),
  memo(3, '2026-06-21T16:45:00.000+08:00', ['文学']),
]

assert.deepEqual(
  filterGuestMemos(memos).map((item) => item.id),
  [2, 3, 1],
  'guest memos must default to newest first.',
)

assert.deepEqual(
  filterGuestMemos(memos, { created_at_sort: 'asc' }).map((item) => item.id),
  [1, 3, 2],
  'guest memos must support oldest first.',
)

assert.deepEqual(
  filterGuestMemos(memos, { created_at_sort: 'asc', tag: '开发' }).map(
    (item) => item.id,
  ),
  [1, 2],
  'guest memo sorting must preserve the current tag filter.',
)

assert.deepEqual(
  memos.map((item) => item.id),
  [1, 2, 3],
  'guest memo sorting must not mutate the source list.',
)
