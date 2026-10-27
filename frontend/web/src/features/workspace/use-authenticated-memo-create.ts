import { useCallback } from 'react'

import { useMemoCreate, type MemoCreateInput } from './use-memo-create'
import { useCreateMemoMutation } from './workspace-queries'
import type { MemoWriteRequest } from './workspace-types'

export function useAuthenticatedMemoCreate(selectedTag: string) {
  const { isPending, mutateAsync } = useCreateMemoMutation()
  const createMemo = useCallback(
    (payload: MemoWriteRequest) => mutateAsync({ payload }),
    [mutateAsync],
  )
  const persistMemo = useCallback(async ({ content, tags }: MemoCreateInput) => {
    await mutateAsync({
      payload: { content, tags, refs: [] },
    })

    return null
  }, [mutateAsync])

  const memoCreate = useMemoCreate({
    clientIdPrefix: 'pending',
    isPending,
    persistMemo,
    selectedTag,
  })

  return { ...memoCreate, createMemo }
}
