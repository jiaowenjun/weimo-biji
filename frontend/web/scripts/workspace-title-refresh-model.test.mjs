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
    refreshReferencePreviews: async () => {
      calls.push('references')
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
    ['memo', 'references', 'stats', 'tagTree'],
    'workspace title refresh must invoke every visible data refresh even when one throws.',
  )
}

{
  const calls = []
  await runWorkspaceTitleRefreshActions({
    refreshMemoList: async () => {
      calls.push('memo')
    },
    refreshReferencePreviews: async () => {
      calls.push('references')
      throw new Error('reference refresh failed')
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
    ['memo', 'references', 'stats', 'tagTree'],
    'workspace title refresh must swallow async rejection after every action is started.',
  )
}
