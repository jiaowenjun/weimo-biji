import { useCallback, type Dispatch, type SetStateAction } from 'react'

import { buildGuestMemo } from './guest-memo-create'
import { useMemoCreate, type MemoCreateInput } from './use-memo-create'
import type { Memo } from './workspace-types'

export function useGuestMemoCreate({
  memos,
  selectedTag,
  setMemos,
}: {
  memos: Memo[]
  selectedTag: string
  setMemos: Dispatch<SetStateAction<Memo[]>>
}) {
  const persistMemo = useCallback(
    (input: MemoCreateInput) => buildGuestMemo(memos, input),
    [memos],
  )
  const commitCreatedMemo = useCallback((memo: Memo) => {
    setMemos((currentMemos) => [memo, ...currentMemos])
  }, [setMemos])

  return useMemoCreate({
    clientIdPrefix: 'guest-pending',
    commitCreatedMemo,
    isPending: false,
    persistMemo,
    selectedTag,
  })
}
