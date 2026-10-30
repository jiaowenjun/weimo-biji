import assert from 'node:assert/strict'

process.env.TZ = 'Asia/Shanghai'

const {
  mergeMemoSearchPages,
  formatMemoTimestamp,
  formatMemoCardDateBarText,
  mapMemo,
  mapMemoSearchPage,
  memoUtcArrayToIso,
  toCardNote,
} = await import('../src/features/workspace/memo-data.ts')
const memoDisplayModule = await import(
  '../src/features/workspace/workspace-memo-display.ts'
)
const {
  applyMemoDisplayOverrides,
  clearMemoDisplayOverrideWhenSettled,
  getMemoDisplayOverridesForScope,
  memoDisplayOverridesReducer,
  removeMemoDisplayOverride,
  removeScopedMemoDisplayOverride,
  setScopedMemoDisplayOverride,
  trackMemoDisplayOverrideOperation,
} = memoDisplayModule

const reducerDraft = { content: 'reducer draft', tags: ['new'] }
const reducerStarted = memoDisplayOverridesReducer({}, {
  type: 'set',
  scope: 'self:alice',
  id: 42,
  draft: reducerDraft,
})
assert.deepEqual(reducerStarted, {
  'self:alice': { 42: reducerDraft },
})
assert.equal(
  memoDisplayOverridesReducer(reducerStarted, {
    type: 'remove',
    scope: 'self:alice',
    id: 42,
    expected: { content: 'older draft', tags: ['old'] },
  }),
  reducerStarted,
  'an older completion must not remove a newer scoped memo display override.',
)
assert.deepEqual(
  memoDisplayOverridesReducer(reducerStarted, {
    type: 'remove',
    scope: 'self:alice',
    id: 42,
    expected: reducerDraft,
  }),
  {},
)
assert.deepEqual(
  memoDisplayOverridesReducer(reducerStarted, { type: 'clear' }),
  {},
)

let trackedReducerState = {}
const syncFailureCleanup = trackMemoDisplayOverrideOperation(
  (action) => {
    trackedReducerState = memoDisplayOverridesReducer(trackedReducerState, action)
  },
  'self:alice',
  42,
  reducerDraft,
  () => {
    throw new Error('synchronous mutation setup failure')
  },
)
assert.deepEqual(trackedReducerState, {
  'self:alice': { 42: reducerDraft },
})
await syncFailureCleanup
assert.deepEqual(
  trackedReducerState,
  {},
  'a synchronous operation failure must not leave a scoped display override.',
)

assert.equal(
  typeof clearMemoDisplayOverrideWhenSettled,
  'function',
  'memo display overrides need per-request settlement cleanup.',
)
assert.equal(
  'dropSyncedMemoDisplayOverrides' in memoDisplayModule,
  false,
  'synced display overrides must be removed from state, never hidden by a render-only projection.',
)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

const memoDto = {
  id: 42,
  ct_utc: [2026, 99, 2, 3, 4, 0, 0, 0, 0],
  mt_utc: [2026, 100, 5, 6, 7, 8_000_000, 0, 0, 0],
  tags: ['test', '后端'],
  content: '第一条真实笔记',
  refs: ['  abc  ', ''],
  referenced_by: undefined,
}

const looseMemoDto = {
  ...memoDto,
  refs: [12, '  abc  ', '', null],
}

assert.equal(
  memoUtcArrayToIso([2026, 99, 2, 3, 4, 0, 0, 0, 0]),
  '2026-04-09T02:03:04.000Z',
)
assert.equal(
  memoUtcArrayToIso([2026, 100, 5, 6, 7, 8_000_000, 0, 0, 0]),
  '2026-04-10T05:06:07.008Z',
)
assert.equal(memoUtcArrayToIso([2026, 367, 0, 0, 0, 0, 0, 0, 0]), null)

assert.equal(
  formatMemoTimestamp('2026-04-09T02:03:04.000Z'),
  '2026-04-09 10:03',
)
assert.equal(formatMemoTimestamp('not-a-date'), '')

// 卡片日期栏三级相对格式:与 skyline components/memo-card/date-display.ts 对齐
const dateBarNow = new Date(2026, 4, 21, 12, 0)
assert.equal(formatMemoCardDateBarText('2026-05-21 09:05', dateBarNow), '9:05')
assert.equal(formatMemoCardDateBarText('2026-05-21 09:05', new Date(2026, 4, 22)), '5/21')
assert.equal(formatMemoCardDateBarText('2026-05-20 09:05', dateBarNow), '5/20')
assert.equal(formatMemoCardDateBarText('2026-05-20', dateBarNow), '5/20')
assert.equal(formatMemoCardDateBarText('2025-01-03 09:05', dateBarNow), '2025/1/3')
assert.equal(formatMemoCardDateBarText('not-a-timestamp', dateBarNow), 'not-a-timestamp')
assert.equal(formatMemoCardDateBarText('', dateBarNow), '')

assert.deepEqual(mapMemo(looseMemoDto), {
  id: 42,
  createdAt: '2026-04-09T02:03:04.000Z',
  updatedAt: '2026-04-10T05:06:07.008Z',
  tags: ['test', '后端'],
  content: '第一条真实笔记',
  refs: ['12', 'abc'],
  referencedBy: [],
})

assert.deepEqual(mapMemo(memoDto), {
  id: 42,
  createdAt: '2026-04-09T02:03:04.000Z',
  updatedAt: '2026-04-10T05:06:07.008Z',
  tags: ['test', '后端'],
  content: '第一条真实笔记',
  refs: ['abc'],
  referencedBy: [],
})

assert.deepEqual(
  mapMemoSearchPage({
    items: [memoDto],
    next_cursor: 'cursor-2',
    has_more: true,
    total_count: 9,
  }),
  {
    items: [
      {
        id: 42,
        createdAt: '2026-04-09T02:03:04.000Z',
        updatedAt: '2026-04-10T05:06:07.008Z',
        tags: ['test', '后端'],
        content: '第一条真实笔记',
        refs: ['abc'],
        referencedBy: [],
      },
    ],
    nextCursor: 'cursor-2',
    hasMore: true,
    totalCount: 9,
  },
)

const firstMemoPage = mapMemoSearchPage({
  items: [memoDto],
  next_cursor: 'cursor-2',
  has_more: true,
  total_count: 2,
})
const secondMemoPage = mapMemoSearchPage({
  items: [
    {
      ...memoDto,
      id: 43,
      tags: ['next'],
      content: '第二页笔记',
    },
  ],
  next_cursor: null,
  has_more: false,
  total_count: 2,
})
assert.deepEqual(mergeMemoSearchPages([firstMemoPage, secondMemoPage]), {
  items: [
    {
      id: 42,
      createdAt: '2026-04-09T02:03:04.000Z',
      updatedAt: '2026-04-10T05:06:07.008Z',
      tags: ['test', '后端'],
      content: '第一条真实笔记',
      refs: ['abc'],
      referencedBy: [],
    },
    {
      id: 43,
      createdAt: '2026-04-09T02:03:04.000Z',
      updatedAt: '2026-04-10T05:06:07.008Z',
      tags: ['next'],
      content: '第二页笔记',
      refs: ['abc'],
      referencedBy: [],
    },
  ],
  nextCursor: null,
  hasMore: false,
  totalCount: 2,
})
assert.deepEqual(mergeMemoSearchPages([]), {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: 0,
})

assert.deepEqual(
  toCardNote({
    id: 1,
    createdAt: '2026-04-09T02:03:04.000Z',
    updatedAt: '2026-04-09T02:03:04.000Z',
    tags: ['test'],
    content: '卡片内容',
    refs: [],
    referencedBy: [],
  }),
  {
    content: '卡片内容',
    createdAtText: '2026-04-09 10:03',
    tags: ['test'],
  },
)

assert.deepEqual(
  toCardNote({
    id: 2,
    createdAt: '',
    updatedAt: '',
    tags: [],
    content: '没有标签',
    refs: [],
    referencedBy: [],
  }),
  {
    content: '没有标签',
    createdAtText: '',
    tags: undefined,
  },
)

const memoDisplayItems = [
  {
    id: 42,
    createdAt: '2026-04-09T02:03:04.000Z',
    updatedAt: '2026-04-10T05:06:07.008Z',
    tags: ['old'],
    content: '旧内容',
    refs: ['old-ref'],
    referencedBy: ['child'],
  },
  {
    id: 7,
    createdAt: '2026-04-01T02:03:04.000Z',
    updatedAt: '2026-04-01T05:06:07.008Z',
    tags: ['keep'],
    content: '保持不变',
    refs: ['keep-ref'],
    referencedBy: [],
  },
]

const overriddenDisplayItems = applyMemoDisplayOverrides(memoDisplayItems, {
  42: {
    content: '新内容\n\n新增一行让高度变化',
    tags: ['new', 'tag'],
  },
})

assert.deepEqual(overriddenDisplayItems, [
  {
    id: 42,
    createdAt: '2026-04-09T02:03:04.000Z',
    updatedAt: '2026-04-10T05:06:07.008Z',
    tags: ['new', 'tag'],
    content: '新内容\n\n新增一行让高度变化',
    refs: ['old-ref'],
    referencedBy: ['child'],
  },
  memoDisplayItems[1],
])
assert.equal(overriddenDisplayItems === memoDisplayItems, false)
assert.equal(overriddenDisplayItems[0] === memoDisplayItems[0], false)
assert.equal(overriddenDisplayItems[1], memoDisplayItems[1])
assert.equal(applyMemoDisplayOverrides(memoDisplayItems, {}), memoDisplayItems)

const scopedDisplayOverrides = setScopedMemoDisplayOverride(
  {},
  'self:alice',
  42,
  {
    content: 'alice pending draft',
    tags: ['self'],
  },
)
assert.deepEqual(
  getMemoDisplayOverridesForScope(scopedDisplayOverrides, 'self:alice')[42],
  { content: 'alice pending draft', tags: ['self'] },
)
assert.deepEqual(
  getMemoDisplayOverridesForScope(scopedDisplayOverrides, 'self:bob'),
  {},
  'a self-workspace draft must not leak into another workspace scope with the same numeric id.',
)
assert.deepEqual(
  removeScopedMemoDisplayOverride(scopedDisplayOverrides, 'self:alice', 42),
  {},
)

const displayOverrides = {
  42: {
    content: '新内容\n\n新增一行让高度变化',
    tags: ['new', 'tag'],
  },
  404: {
    content: '未命中',
    tags: [],
  },
}

assert.deepEqual(removeMemoDisplayOverride(displayOverrides, 42), {
  404: {
    content: '未命中',
    tags: [],
  },
})
assert.equal(removeMemoDisplayOverride(displayOverrides, 999), displayOverrides)
assert.equal(
  removeMemoDisplayOverride(displayOverrides, 42, {
    content: '不是当前保存内容',
    tags: ['new', 'tag'],
  }),
  displayOverrides,
)

const firstDraft = { content: 'first', tags: ['old/first'] }
const secondDraft = { content: 'second', tags: ['old/second'] }
let concurrentOverrides = { 1: firstDraft, 2: secondDraft }
const firstSave = deferred()
const secondSave = deferred()
const firstCleanup = clearMemoDisplayOverrideWhenSettled(firstSave.promise, () => {
  concurrentOverrides = removeMemoDisplayOverride(concurrentOverrides, 1, firstDraft)
})
const secondCleanup = clearMemoDisplayOverrideWhenSettled(secondSave.promise, () => {
  concurrentOverrides = removeMemoDisplayOverride(concurrentOverrides, 2, secondDraft)
})

firstSave.reject(new Error('first save failed'))
await firstCleanup
assert.deepEqual(concurrentOverrides, { 2: secondDraft })
secondSave.resolve(2)
await secondCleanup
assert.deepEqual(concurrentOverrides, {})

const olderDraft = { content: 'older', tags: ['old'] }
const newerDraft = { content: 'newer', tags: ['new'] }
let sameMemoOverrides = { 1: newerDraft }
const olderSave = deferred()
const newerSave = deferred()
const olderCleanup = clearMemoDisplayOverrideWhenSettled(olderSave.promise, () => {
  sameMemoOverrides = removeMemoDisplayOverride(sameMemoOverrides, 1, olderDraft)
})
const newerCleanup = clearMemoDisplayOverrideWhenSettled(newerSave.promise, () => {
  sameMemoOverrides = removeMemoDisplayOverride(sameMemoOverrides, 1, newerDraft)
})

olderSave.resolve(1)
await olderCleanup
assert.deepEqual(sameMemoOverrides, { 1: newerDraft })
newerSave.resolve(1)
await newerCleanup
assert.deepEqual(sameMemoOverrides, {})
