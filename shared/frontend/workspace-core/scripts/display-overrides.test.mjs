import assert from 'node:assert/strict'

const {
  applyDisplayOverrides,
  createDisplayOverridesReducer,
  createScopedDisplayOverridesReducer,
  getScopedDisplayOverrides,
  trackDisplayOverrideOperation,
  trackScopedDisplayOverrideOperation,
} = await import('../src/display-overrides.ts')

const sameDraft = (left, right) =>
  left.content === right.content && left.tags.join('\u0000') === right.tags.join('\u0000')
const reducer = createDisplayOverridesReducer(sameDraft)
const scopedReducer = createScopedDisplayOverridesReducer(sameDraft)
const draft = { content: 'new', tags: ['new'] }

const overridden = applyDisplayOverrides(
  [{ id: 1, content: 'old', tags: ['old'] }, { id: 2, content: 'keep', tags: [] }],
  { 1: draft },
  (item, override) => ({ ...item, ...override, tags: [...override.tags] }),
)
assert.deepEqual(overridden, [
  { id: 1, content: 'new', tags: ['new'] },
  { id: 2, content: 'keep', tags: [] },
])

assert.deepEqual(
  applyDisplayOverrides(
    [{ id: 1, enabled: true }],
    { 1: false },
    (item, enabled) => ({ ...item, enabled }),
  ),
  [{ id: 1, enabled: false }],
  'falsy override values must still be applied.',
)

const booleanReducer = createDisplayOverridesReducer((left, right) => left === right)
assert.deepEqual(
  booleanReducer({ 1: false }, { type: 'remove', id: 1, expected: true }),
  { 1: false },
  'a falsy current override must still participate in expected-value checks.',
)
assert.deepEqual(
  booleanReducer({ 1: false }, { type: 'remove', id: 1, expected: false }),
  {},
)

let state = {}
const dispatch = (action) => {
  state = reducer(state, action)
}
const cleanup = trackDisplayOverrideOperation(dispatch, 1, draft, () => {
  throw new Error('sync setup failure')
})
assert.deepEqual(state, { 1: draft })
await cleanup
assert.deepEqual(state, {})

let scopedState = {}
const scopedDispatch = (action) => {
  scopedState = scopedReducer(scopedState, action)
}
const scopedCleanup = trackScopedDisplayOverrideOperation(
  scopedDispatch,
  'self:alice',
  1,
  draft,
  () => Promise.resolve(1),
)
assert.deepEqual(getScopedDisplayOverrides(scopedState, 'self:alice'), { 1: draft })
assert.deepEqual(getScopedDisplayOverrides(scopedState, 'friend:bob'), {})
await scopedCleanup
assert.deepEqual(scopedState, {})

const olderDraft = { content: 'older', tags: ['old'] }
const newerDraft = { content: 'newer', tags: ['new'] }
let orderedState = reducer({}, { type: 'set', id: 1, draft: newerDraft })
orderedState = reducer(orderedState, {
  type: 'remove',
  id: 1,
  expected: olderDraft,
})
assert.deepEqual(orderedState, { 1: newerDraft })
