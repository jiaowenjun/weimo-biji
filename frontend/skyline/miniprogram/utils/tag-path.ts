/**
 * 标签路径使用 `/` 分隔（与 TagTree、memo 标签一致）。
 */

/**
 * 返回标签路径的直接父路径；一级标签或无效路径返回 null。
 */
export function parentTagPath(tagPath: string): string | null {
  const tag = String(tagPath || '').trim()
  const slash = tag.lastIndexOf('/')
  if (slash <= 0) return null
  const parent = tag.slice(0, slash).trim()
  return parent || null
}

/**
 * 重命名标签后，将当前选中标签路径映射到新路径。
 * - selectedTag 正好等于 oldTag → 返回 newTag
 * - selectedTag 是 oldTag 的后代 → 替换前缀
 * - 其余情况保持不变
 */
export function remapSelectedTagPath(selectedTag: string, oldTag: string, newTag: string): string {
  const current = String(selectedTag || '').trim()
  const from = String(oldTag || '').trim()
  const to = String(newTag || '').trim()

  if (!current || !from || !to) {
    return current
  }

  if (current === from) {
    return to
  }

  const prefix = `${from}/`
  if (current.startsWith(prefix)) {
    return `${to}${current.slice(from.length)}`
  }

  return current
}
