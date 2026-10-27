export const HOME_NAV_TITLE_DEFAULT = 'weimo'
export const HOME_NAV_TITLE_VISITOR = '游客'

const MID = '...'

export interface TagNavTitleOptions {
  maxLen: number
  isNarrow?: boolean
  /** 默认 `hash`：字面 `#` + 路径（仅单测/兼容）；首页与搜索导航栏在 UI 用前导 icon，解析均用 `pathPrefix: 'none'`。 */
  pathPrefix?: 'hash' | 'none'
}

function splitTagSegments(tagPath: string): string[] {
  return tagPath
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** 有选中标签时：按 maxLen / 极窄 生成导航栏标题；无分段时回退默认。 */
export function formatTagPathForNavTitle(tagPath: string, options: TagNavTitleOptions): string {
  const maxLen = Math.max(4, options.maxLen)
  const isNarrow = options.isNarrow ?? false
  const useHash = (options.pathPrefix ?? 'hash') === 'hash'
  const raw = tagPath.trim()
  const segments = splitTagSegments(raw)
  if (segments.length === 0) {
    return HOME_NAV_TITLE_DEFAULT
  }

  const full = useHash ? `#${raw}` : raw
  if (full.length <= maxLen) {
    return full
  }

  if (segments.length >= 3) {
    const r1 = useHash
      ? `#${segments[0]}/.../${segments[segments.length - 1]}`
      : `${segments[0]}/.../${segments[segments.length - 1]}`
    if (r1.length <= maxLen) {
      return r1
    }
  }

  const last = segments[segments.length - 1]!

  const tryRule2 = (withHash: boolean): string | null => {
    const s = withHash ? `#.../${last}` : `.../${last}`
    return s.length <= maxLen ? s : null
  }
  const order2 = useHash ? (isNarrow ? [false, true] : [true, false]) : [false]
  for (const h of order2) {
    const t = tryRule2(h)
    if (t) return t
  }

  const tryRule3 = (withHash: boolean): string | null => {
    const prefix = withHash ? '#.../' : '.../'
    if (prefix.length + last.length <= maxLen) {
      return prefix + last
    }
    const room = maxLen - prefix.length
    const trail = '...'
    if (room < trail.length + 1) {
      return null
    }
    const headLen = room - trail.length
    if (headLen < 1) {
      return null
    }
    return prefix + last.slice(0, headLen) + trail
  }
  const order3 = useHash ? (isNarrow ? [false, true] : [true, false]) : [false]
  for (const h of order3) {
    const t = tryRule3(h)
    if (t != null) {
      return t
    }
  }

  return last.slice(0, Math.max(1, maxLen - MID.length)) + MID
}

export function homeNavTitleBudget(windowWidthPx: number): { maxLen: number; isNarrow: boolean } {
  const isNarrow = windowWidthPx < 360
  const est = Math.floor((windowWidthPx - 180) / 14)
  const maxLen = Math.min(28, Math.max(10, est))
  return { maxLen, isNarrow }
}

function ellipsizeText(text: string, maxLen: number): string {
  const limit = Math.max(1, maxLen)
  if (text.length <= limit) {
    return text
  }
  if (limit <= MID.length) {
    return text.slice(0, limit)
  }
  return text.slice(0, Math.max(1, limit - MID.length)) + MID
}

function resolveSelfHomeBaseTitle(userLabel?: string | null): string {
  const label = typeof userLabel === 'string' ? userLabel.trim() : ''
  return label.length > 0 ? label : HOME_NAV_TITLE_VISITOR
}

/** 主列表/搜索 导航栏标题文字：有标签为缩略纯路径，无标签为登录用户昵称或「游客」；`#` 由各自导航栏的 hash/search 前导 icon 表示。 */
export function resolveHomeNavTitle(
  selectedTag: string,
  windowWidthPx: number,
  userLabel?: string | null,
): string {
  const t = String(selectedTag || '').trim()
  if (!t) {
    const { maxLen } = homeNavTitleBudget(windowWidthPx)
    return ellipsizeText(resolveSelfHomeBaseTitle(userLabel), maxLen)
  }
  const { maxLen, isNarrow } = homeNavTitleBudget(windowWidthPx)
  return formatTagPathForNavTitle(t, { maxLen, isNarrow, pathPrefix: 'none' })
}

/** 搜索页导航标题：与 {@link resolveHomeNavTitle} 相同。 */
export function resolveSearchNavTitle(
  selectedTag: string,
  windowWidthPx: number,
): string {
  return resolveHomeNavTitle(selectedTag, windowWidthPx)
}
