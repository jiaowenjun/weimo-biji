import assert from 'node:assert/strict'

const { runWorkspaceTitleRefreshActions } = await import(
  '../src/features/workspace/workspace-title-refresh.ts'
)

{
  const calls = []
  await runWorkspaceTitleRefreshActions({
    refreshMemoList: () => {
      calls.push('memo')
      throw new Error('memo crash')
    },
    refreshStats: async () => {
      calls.push('stats')
    },
    refreshTagTree: async () => {
      calls.push('tagTree')
    },
  })

  assert.deepEqual(
    calls,
    ['memo', 'stats', 'tagTree'],
    'workspace title refresh must invoke every visible data refresh even when one throws.',
  )
}

{
  const calls = []
  await runWorkspaceTitleRefreshActions({
    refreshMemoList: async () => {
      calls.push('memo')
    },
    refreshStats: async () => {
      calls.push('stats')
      throw new Error('stats failed')
    },
    refreshTagTree: async () => {
      calls.push('tagTree')
    },
  })

  assert.deepEqual(
    calls,
    ['memo', 'stats', 'tagTree'],
    'workspace title refresh must swallow async rejection after every action is started.',
  )
}
