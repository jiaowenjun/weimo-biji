/** 笔记「暂无真实标签」时的占位字面；UI 上以 # 前缀显示为「#无」 */
export const TAG_NONE_LITERAL = '无'

export function isTagNoneMemoPlaceholder(tag: string): boolean {
  return tag === TAG_NONE_LITERAL
}

/** 笔记编辑页标签行展示的胶囊列表（不向用户展示占位「无」） */
export function tagsWithoutNoneForComposeBar(tags: readonly string[]): string[] {
  return tags.filter((t) => !isTagNoneMemoPlaceholder(t))
}

/**
 * 当笔记同时具备占位「无」与其他真实标签时，去掉「无」。
 * 仅「无」时保留，避免误判为清空标签语义。
 */
export function pruneMemoTagNoneWhenMixed(tags: readonly string[]): string[] {
  const others = tags.filter((t) => !isTagNoneMemoPlaceholder(t))
  if (others.length === 0) {
    return [...tags]
  }
  return others
}

/** 标签树 / 扁平标签路径：`tag === '无'` 的根或节点视为占位项，不参与 insert/update 选择列表「无」行展示；排序时置于同类末位 */
export function isTagNoneTreeNodePath(tagPath: string): boolean {
  return tagPath === TAG_NONE_LITERAL
}
