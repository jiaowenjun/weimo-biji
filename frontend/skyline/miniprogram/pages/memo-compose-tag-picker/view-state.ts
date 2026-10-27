import { isTagNoneTreeNodePath } from '../../utils/tag-none'
import {
  filterTagPathsByQuery,
  resolveTagPickerConfirmDisabled,
  resolveTagPickerListFilterQuery,
  type TagPickerDraftSource,
} from '../../utils/tag-search'

export type TagPickerOptionBadge = '已选' | '原标签'

export interface TagPickerOption {
  tag: string
  disabled: boolean
  /** 禁行右侧说明；可点行无此字段 */
  optionBadge?: TagPickerOptionBadge
}

interface DeriveTagPickerViewStateInput {
  mode: MemoComposeTagPickerMode
  targetTag: string
  selectedTags: string[]
  rawDraft: string
  rawTagOptions: string[]
  listFilterQuery: string
  draftSource?: TagPickerDraftSource
  allowEmptyRemove?: boolean
}

interface TagPickerViewState {
  draft: string
  listFilterQuery: string
  confirmDisabled: boolean
  options: TagPickerOption[]
}

function normalizeTagPickerDraft(rawDraft: string): string {
  return rawDraft.replace(/^#+/, '').trim()
}

function resolveExcludedTags(
  mode: MemoComposeTagPickerMode,
  targetTag: string,
  selectedTags: string[],
): string[] {
  return mode === 'update'
    ? selectedTags.filter((tag) => tag !== targetTag)
    : [...selectedTags]
}

export function deriveTagPickerViewState({
  mode,
  targetTag,
  selectedTags,
  rawDraft,
  rawTagOptions,
  listFilterQuery,
  draftSource,
  allowEmptyRemove,
}: DeriveTagPickerViewStateInput): TagPickerViewState {
  const draft = normalizeTagPickerDraft(rawDraft)
  const nextListFilterQuery = draftSource
    ? resolveTagPickerListFilterQuery(
        mode,
        draft,
        targetTag,
        listFilterQuery,
        draftSource,
      )
    : listFilterQuery
  const excludedTags = resolveExcludedTags(mode, targetTag, selectedTags)
  const optionSource =
    mode === 'insert' || mode === 'update'
      ? rawTagOptions.filter((t) => !isTagNoneTreeNodePath(t))
      : rawTagOptions
  const options = filterTagPathsByQuery(optionSource, nextListFilterQuery).map((tag) => {
    if (mode === 'update' && tag === targetTag) {
      return { tag, disabled: true, optionBadge: '原标签' as const }
    }
    const disabled = excludedTags.includes(tag)
    return {
      tag,
      disabled,
      ...(disabled ? { optionBadge: '已选' as const } : {}),
    }
  })
  const confirmDisabled = resolveTagPickerConfirmDisabled({
    mode,
    draft,
    targetTag,
    selectedTags,
    rawTagOptions,
    allowEmptyRemove,
  })

  return {
    draft,
    listFilterQuery: nextListFilterQuery,
    confirmDisabled,
    options,
  }
}
