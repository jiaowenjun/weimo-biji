import { tagLiteralLatinKey } from './tag-sort'

/**
 * 标签选择页搜索：
 * - 去掉路径 "/" 后，对查询与标签文本做「有序子序列」匹配（与既有中文检索一致）；
 * - 若查询仅含拉丁字母与数字，则额外对「汉字无声调全拼 + 标签内拉丁片段」拼接串做同一套有序子序列匹配（全拼 / 首字母 / 混合均覆盖）。
 * - 查询为空（trim 后）时视为匹配任意标签。
 * - 与排序共用 `tagLiteralLatinKey`（见 tag-sort），保证行为一致。
 */

function orderedSubsequence(query: string, haystack: string): boolean {
  let from = 0
  for (const ch of query) {
    const idx = haystack.indexOf(ch, from)
    if (idx === -1) {
      return false
    }
    from = idx + 1
  }
  return true
}

/** 查询是否走拼音轨：去掉空白后仅含 A–Z / a–z / 0–9 */
function isLatinDigitQuery(raw: string): boolean {
  const compact = raw.replace(/\s+/g, '')
  return compact.length > 0 && /^[A-Za-z0-9]+$/.test(compact)
}

export function tagMatchesSearchQuery(tagPath: string, rawQuery: string): boolean {
  const query = rawQuery.replace(/\//g, '').trim()
  if (!query) {
    return true
  }
  const literal = tagPath.replace(/\//g, '')
  if (orderedSubsequence(query, literal)) {
    return true
  }
  if (!isLatinDigitQuery(query)) {
    return false
  }
  const q = query.replace(/\s+/g, '').toLowerCase()
  const pinyinStack = tagLiteralLatinKey(literal)
  return orderedSubsequence(q, pinyinStack)
}

export function filterTagPathsByQuery(tags: string[], rawQuery: string): string[] {
  return tags.filter((t) => tagMatchesSearchQuery(t, rawQuery))
}

export function resolveTagPickerSearchDraft(
  mode: MemoComposeTagPickerMode,
  draft: string,
  targetTag: string,
): string {
  if (mode === 'update' && draft === targetTag) {
    return ''
  }
  return draft
}

export type TagPickerDraftSource = 'input' | 'list-tap' | 'sync-init'

/**
 * 列表筛选用查询串：
 * - `sync-init`：首次由 opener 注入 `initialDraft` 时；**`mode: 'pick'`** 下非空草稿仅用于输入框展示与确认，**不**作为首帧列表筛选（避免「重选」一打开就只剩一行）。
 * - `input`：与 `resolveTagPickerSearchDraft` 一致。
 * - `list-tap`：沿用上一帧筛选用串，避免首击即重筛导致双击第二击落空。
 */
export function resolveTagPickerListFilterQuery(
  mode: MemoComposeTagPickerMode,
  draft: string,
  targetTag: string,
  previousListFilterQuery: string,
  draftSource: TagPickerDraftSource,
): string {
  if (draftSource === 'sync-init') {
    const d = draft.trim()
    if (mode === 'pick' && d.length > 0) {
      return ''
    }
    return resolveTagPickerSearchDraft(mode, draft, targetTag)
  }
  if (draftSource === 'list-tap') {
    return previousListFilterQuery
  }
  return resolveTagPickerSearchDraft(mode, draft, targetTag)
}

interface ResolveTagPickerConfirmDisabledInput {
  mode: MemoComposeTagPickerMode
  draft: string
  targetTag: string
  selectedTags: string[]
  rawTagOptions: string[]
  allowEmptyRemove?: boolean
}

export function resolveTagPickerConfirmDisabled({
  mode,
  draft,
  targetTag,
  selectedTags,
  rawTagOptions,
  allowEmptyRemove = true,
}: ResolveTagPickerConfirmDisabledInput): boolean {
  const normalizedDraft = draft.trim()
  const excludedTags = mode === 'update'
    ? selectedTags.filter((tag) => tag !== targetTag)
    : selectedTags
  const isDuplicate = normalizedDraft.length > 0 && excludedTags.includes(normalizedDraft)
  const isUnchanged = mode === 'update' && normalizedDraft.length > 0 && normalizedDraft === targetTag

  if (mode === 'pick') {
    const isExistingOption = normalizedDraft.length > 0 && rawTagOptions.includes(normalizedDraft)
    return !(isExistingOption && !isDuplicate && !isUnchanged)
  }

  // add / replace
  if (mode === 'update') {
    if (normalizedDraft.length === 0) {
      return !allowEmptyRemove
    }
    return isDuplicate || isUnchanged
  }

  // mode === 'insert'
  return normalizedDraft.length === 0 || isDuplicate
}
