import assert from 'node:assert/strict'

const {
  createPendingCreateState,
  pendingCreateReducer,
} = await import('../src/pending-create.ts')

const initial = createPendingCreateState('pending-1', {
  content: '',
  tags: ['work'],
})

assert.deepEqual(initial, {
  clientId: 'pending-1',
  content: '',
  createSettled: false,
  status: 'editing',
  tags: ['work'],
  viewTransitionEnded: false,
})

const creating = pendingCreateReducer(initial, {
  type: 'submit',
  changes: { content: 'draft', tags: ['work/rust'] },
})
assert.deepEqual(creating, {
  clientId: 'pending-1',
  content: 'draft',
  createSettled: false,
  status: 'creating',
  tags: ['work/rust'],
  viewTransitionEnded: false,
})

const transitionFirst = pendingCreateReducer(creating, {
  type: 'view-transition-end',
})
assert.equal(transitionFirst.viewTransitionEnded, true)
assert.equal(
  pendingCreateReducer(transitionFirst, { type: 'succeed' }),
  null,
)

const requestFirst = pendingCreateReducer(creating, { type: 'succeed' })
assert.equal(requestFirst.createSettled, true)
assert.equal(
  pendingCreateReducer(requestFirst, { type: 'view-transition-end' }),
  null,
)

const requestWithResult = pendingCreateReducer(creating, {
  type: 'succeed',
  changes: { content: 'persisted draft' },
})
assert.equal(requestWithResult.content, 'persisted draft')

const failed = pendingCreateReducer(creating, {
  type: 'fail',
  changes: { content: 'retry draft' },
})
assert.equal(failed.content, 'retry draft')
assert.equal(failed.createSettled, false)
assert.equal(failed.status, 'failed')
assert.equal(failed.viewTransitionEnded, false)

const closing = pendingCreateReducer(initial, { type: 'cancel' })
assert.equal(closing.status, 'closing')
assert.equal(
  pendingCreateReducer(closing, { type: 'exit-animation-end' }),
  null,
)
