/**
 * 把 memoCards 数组前后两版差异编译成 setData payload。
 *
 * 核心动机：Skyline `<scroll-view type="list" enhanced>` 的虚拟列表内部
 * 以"setData 字段路径"识别"数组追加"还是"整数组替换"。
 *
 *   setData({ memoCards: newArray })            → list-view 视为整数组替换 → 全量 layout pass → 抖动
 *   setData({ "memoCards[8]": item, ... })       → list-view 视为索引位置赋值 → 仅新增项 layout → 不抖
 *
 * 所以当 nextCards 在引用层面是 lastCards 的「引用前缀超集」（前 N 项 ===，长度 > N）时，
 * 必须用字段路径 setData 仅 append 新项，避免触发 list-view 整组 layout。
 */
export function buildArrayFieldPatch<T>(
  fieldName: string,
  lastCards: T[] | null,
  nextCards: T[],
): Record<string, unknown> {
  if (lastCards === nextCards) return {}
  if (lastCards === null) return { [fieldName]: nextCards }
  if (
    nextCards.length > lastCards.length &&
    isReferencePrefix(lastCards, nextCards)
  ) {
    const patch: Record<string, unknown> = {}
    for (let i = lastCards.length; i < nextCards.length; i++) {
      patch[`${fieldName}[${i}]`] = nextCards[i]
    }
    return patch
  }
  if (nextCards.length === lastCards.length) {
    const patch: Record<string, unknown> = {}
    for (let i = 0; i < nextCards.length; i++) {
      if (nextCards[i] !== lastCards[i]) {
        patch[`${fieldName}[${i}]`] = nextCards[i]
      }
    }
    return patch
  }
  if (nextCards.length === lastCards.length - 1) {
    const deleteIndex = findSingleDeleteIndex(lastCards, nextCards)
    if (deleteIndex !== null) {
      const patch: Record<string, unknown> = {}
      for (let i = deleteIndex; i < nextCards.length; i++) {
        if (nextCards[i] !== lastCards[i]) {
          patch[`${fieldName}[${i}]`] = nextCards[i]
        }
      }
      patch[fieldName] = nextCards
      return patch
    }
  }
  return { [fieldName]: nextCards }
}

export function buildMemoCardsPatch<T>(
  lastCards: T[] | null,
  nextCards: T[],
): Record<string, unknown> {
  return buildArrayFieldPatch('memoCards', lastCards, nextCards)
}

export function findSingleDeleteIndex<T>(last: T[], next: T[]): number | null {
  for (let deleteIndex = 0; deleteIndex < last.length; deleteIndex++) {
    let matches = true
    for (let j = 0; j < deleteIndex; j++) {
      if (last[j] !== next[j]) {
        matches = false
        break
      }
    }
    if (!matches) continue
    for (let j = deleteIndex; j < next.length; j++) {
      if (last[j + 1] !== next[j]) {
        matches = false
        break
      }
    }
    if (matches) return deleteIndex
  }
  return null
}

function isReferencePrefix<T>(prefix: T[], full: T[]): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== full[i]) return false
  }
  return true
}
