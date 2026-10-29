export type TagPickerMode = 'insert' | 'update' | 'pick'
export type TagPickerDraftSource = 'input' | 'list-tap' | 'sync-init'
export type TagPickerOptionBadge = '已选' | '原标签'

export type TagPickerOption = {
  tag: string
  disabled: boolean
  optionBadge?: TagPickerOptionBadge
}

export type TagPickerApplyPayload = {
  selectedTags: string[]
  draft: string
  mode: TagPickerMode
}

type ResolveTagPickerListFilterQueryInput = {
  mode: TagPickerMode
  draft: string
  targetTag: string
  previousListFilterQuery: string
  draftSource: TagPickerDraftSource
}

type DeriveTagPickerStateInput = {
  mode: TagPickerMode
  targetTag: string
  selectedTags: string[]
  rawDraft: string
  tagOptions: string[]
  listFilterQuery: string
  draftSource?: TagPickerDraftSource
  allowEmptyRemove?: boolean
}

type ApplyTagPickerDraftInput = {
  mode: TagPickerMode
  targetTag: string
  selectedTags: string[]
  rawDraft: string
  tagOptions: string[]
  allowEmptyRemove?: boolean
}

function orderedSubsequence(query: string, haystack: string): boolean {
  let from = 0
  for (const ch of query) {
    const idx = haystack.indexOf(ch, from)
    if (idx === -1) return false
    from = idx + 1
  }
  return true
}

function normalizeSearchText(value: string): string {
  return value.replace(/\//g, '').trim()
}

function resolveExcludedTags(
  mode: TagPickerMode,
  targetTag: string,
  selectedTags: string[],
): string[] {
  return mode === 'update'
    ? selectedTags.filter((tag) => tag !== targetTag)
    : [...selectedTags]
}

export function normalizeTagPickerDraft(rawDraft: string): string {
  return String(rawDraft || '').trim().replace(/^#+/, '').trim()
}

export function tagMatchesPickerQuery(tagPath: string, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery)
  if (!query) return true
  return orderedSubsequence(query, normalizeSearchText(tagPath))
}

export function filterTagPickerOptions(
  tagOptions: string[],
  rawQuery: string,
): string[] {
  return tagOptions.filter((tag) => tagMatchesPickerQuery(tag, rawQuery))
}

export function resolveTagPickerSearchDraft(
  mode: TagPickerMode,
  draft: string,
  targetTag: string,
): string {
  if (mode === 'update' && draft === targetTag) return ''
  return draft
}

export function resolveTagPickerListFilterQuery({
  mode,
  draft,
  targetTag,
  previousListFilterQuery,
  draftSource,
}: ResolveTagPickerListFilterQueryInput): string {
  if (draftSource === 'sync-init') {
    if (mode === 'pick' && draft.trim().length > 0) return ''
    return resolveTagPickerSearchDraft(mode, draft, targetTag)
  }
  if (draftSource === 'list-tap') return previousListFilterQuery
  return resolveTagPickerSearchDraft(mode, draft, targetTag)
}

export function resolveTagPickerConfirmDisabled({
  mode,
  targetTag,
  selectedTags,
  rawDraft,
  tagOptions,
  allowEmptyRemove = true,
}: Omit<DeriveTagPickerStateInput, 'listFilterQuery' | 'draftSource'>): boolean {
  const draft = normalizeTagPickerDraft(rawDraft)
  const excludedTags = resolveExcludedTags(mode, targetTag, selectedTags)
  const isDuplicate = draft.length > 0 && excludedTags.includes(draft)

  if (mode === 'pick') {
    return !(draft.length > 0 && tagOptions.includes(draft) && !isDuplicate)
  }
  if (mode === 'update') {
    if (draft.length === 0) return !allowEmptyRemove
    return draft === targetTag || isDuplicate
  }
  return draft.length === 0 || isDuplicate
}

export function deriveTagPickerState({
  mode,
  targetTag,
  selectedTags,
  rawDraft,
  tagOptions,
  listFilterQuery,
  draftSource,
  allowEmptyRemove,
}: DeriveTagPickerStateInput) {
  const draft = normalizeTagPickerDraft(rawDraft)
  const nextListFilterQuery = draftSource
    ? resolveTagPickerListFilterQuery({
        mode,
        draft,
        targetTag,
        previousListFilterQuery: listFilterQuery,
        draftSource,
      })
    : listFilterQuery
  const excludedTags = resolveExcludedTags(mode, targetTag, selectedTags)
  const options = filterTagPickerOptions(tagOptions, nextListFilterQuery).map((tag) => {
    if (mode === 'update' && tag === targetTag) {
      return { tag, disabled: true, optionBadge: '原标签' as const }
    }
    const disabled = excludedTags.includes(tag)
    return { tag, disabled, ...(disabled ? { optionBadge: '已选' as const } : {}) }
  })

  return {
    draft,
    listFilterQuery: nextListFilterQuery,
    confirmDisabled: resolveTagPickerConfirmDisabled({
      mode,
      targetTag,
      selectedTags,
      rawDraft: draft,
      tagOptions,
      allowEmptyRemove,
    }),
    options,
  }
}

export function applyTagPickerDraft({
  mode,
  targetTag,
  selectedTags,
  rawDraft,
  tagOptions,
  allowEmptyRemove = true,
}: ApplyTagPickerDraftInput): TagPickerApplyPayload | null {
  const draft = normalizeTagPickerDraft(rawDraft)
  const confirmDisabled = resolveTagPickerConfirmDisabled({
    mode,
    targetTag,
    selectedTags,
    rawDraft: draft,
    tagOptions,
    allowEmptyRemove,
  })
  if (confirmDisabled) return null

  if (mode === 'update' && draft.length === 0) {
    return { selectedTags: selectedTags.filter((tag) => tag !== targetTag), draft, mode }
  }
  if (mode === 'insert' || mode === 'pick') {
    return { selectedTags: [...selectedTags, draft], draft, mode }
  }

  const nextTags = [...selectedTags]
  const targetIndex = nextTags.indexOf(targetTag)
  if (targetIndex === -1) nextTags.push(draft)
  else nextTags[targetIndex] = draft
  return { selectedTags: nextTags, draft, mode }
}
