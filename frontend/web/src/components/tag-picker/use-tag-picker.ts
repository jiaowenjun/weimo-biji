import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  applyTagPickerDraft,
  deriveTagPickerState,
  type TagPickerApplyPayload,
  type TagPickerDraftSource,
  type TagPickerMode,
  type TagPickerOption,
} from './tag-picker-model'

const DOUBLE_TAP_INTERVAL_MS = 300

type UseTagPickerInput = {
  open: boolean
  mode: TagPickerMode
  tagOptions: string[]
  selectedTags: string[]
  targetTag: string
  initialDraft: string
  allowEmptyRemove: boolean
  onApplyPayload: (payload: TagPickerApplyPayload) => void
}

type LastOptionTap = {
  tag: string
  at: number
}

function getInitialDraft(mode: TagPickerMode, targetTag: string, initialDraft: string) {
  if (initialDraft) return initialDraft
  if (mode === 'update') return targetTag
  return ''
}

export function useTagPicker({
  allowEmptyRemove,
  initialDraft,
  mode,
  onApplyPayload,
  open,
  selectedTags,
  tagOptions,
  targetTag,
}: UseTagPickerInput) {
  const [draft, setDraft] = useState(() =>
    getInitialDraft(mode, targetTag, initialDraft),
  )
  const [listFilterQuery, setListFilterQuery] = useState('')
  const [draftSource, setDraftSource] =
    useState<TagPickerDraftSource>('sync-init')
  const lastOptionTapRef = useRef<LastOptionTap>({ tag: '', at: 0 })

  const resetPickerState = useCallback(() => {
    setDraft(getInitialDraft(mode, targetTag, initialDraft))
    setListFilterQuery('')
    setDraftSource('sync-init')
    lastOptionTapRef.current = { tag: '', at: 0 }
  }, [initialDraft, mode, targetTag])

  // 移植自 weimo-ui 的 TagPicker:打开期间任一输入变化即重置草稿。
  // 属"prop 变化驱动重置"模式,改写为渲染期调整会引入行为漂移,
  // 此处保留原实现(豁免见调用行)。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 移植代码保留原语义
    if (open) resetPickerState()
  }, [
    allowEmptyRemove,
    initialDraft,
    mode,
    open,
    resetPickerState,
    selectedTags,
    tagOptions,
    targetTag,
  ])

  const state = useMemo(
    () =>
      deriveTagPickerState({
        allowEmptyRemove,
        draftSource,
        listFilterQuery,
        mode,
        rawDraft: draft,
        selectedTags,
        tagOptions,
        targetTag,
      }),
    [
      allowEmptyRemove,
      draft,
      draftSource,
      listFilterQuery,
      mode,
      selectedTags,
      tagOptions,
      targetTag,
    ],
  )

  // 移植自 weimo-ui 的 TagPicker:派生模型归一化后回写原始状态,
  // 保证下一次派生以规范输入运行。保留原实现(豁免见调用行)。
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 移植代码保留原语义 */
    if (state.draft !== draft) {
      setDraft(state.draft)
    }
    if (state.listFilterQuery !== listFilterQuery) {
      setListFilterQuery(state.listFilterQuery)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draft, listFilterQuery, state.draft, state.listFilterQuery])

  const applyDraft = useCallback(
    (rawDraft = state.draft) => {
      const payload = applyTagPickerDraft({
        allowEmptyRemove,
        mode,
        rawDraft,
        selectedTags,
        tagOptions,
        targetTag,
      })

      if (!payload) return false

      onApplyPayload(payload)
      return true
    },
    [
      allowEmptyRemove,
      mode,
      onApplyPayload,
      selectedTags,
      state.draft,
      tagOptions,
      targetTag,
    ],
  )

  const updateDraft = useCallback((nextDraft: string, source: TagPickerDraftSource) => {
    setDraft(nextDraft)
    setDraftSource(source)
  }, [])

  const handleInputChange = useCallback(
    (nextDraft: string) => {
      lastOptionTapRef.current = { tag: '', at: 0 }
      updateDraft(nextDraft, 'input')
    },
    [updateDraft],
  )

  const handleClearDraft = useCallback(() => {
    lastOptionTapRef.current = { tag: '', at: 0 }
    updateDraft('', 'input')
  }, [updateDraft])

  const handleOptionPress = useCallback(
    (option: TagPickerOption) => {
      if (option.disabled) return

      const now = Date.now()
      const lastTap = lastOptionTapRef.current

      if (
        lastTap.tag === option.tag &&
        now - lastTap.at <= DOUBLE_TAP_INTERVAL_MS
      ) {
        lastOptionTapRef.current = { tag: '', at: 0 }
        applyDraft(option.tag)
        return
      }

      lastOptionTapRef.current = { tag: option.tag, at: now }
      updateDraft(option.tag, 'list-tap')
    },
    [applyDraft, updateDraft],
  )

  return {
    applyDraft,
    draft,
    handleClearDraft,
    handleInputChange,
    handleOptionPress,
    resetPickerState,
    state,
  }
}
