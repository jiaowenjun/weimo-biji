import type { MemoCardMenuItem } from './menu-items'

/** 与 `weimo-popover-menu` 默认 124px（约 2 项菜单）对齐的壳体像素 */
const POPOVER_SHELL_PX = 8
/** 由 (124 - shell) / 2 得来，使 2 项时估算高度仍为 124 */
const POPOVER_PER_ITEM_PX = 58
const POPOVER_MIN_HEIGHT_PX = 124

function countMenuDividers(items: ReadonlyArray<MemoCardMenuItem>): number {
  let n = 0
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    if (item.dividerBefore === true || (item.dividerBefore == null && idx > 0)) {
      n += 1
    }
  }
  return n
}

/**
 * memo-card 弹出菜单项数已多于早期「编辑+删除」两态；须传入偏大的估算高度，
 * 否则 `weimo-popover-menu` 会误判 fitsBelow，底部列表靠近安全区时菜单被裁切。
 */
export function estimateMemoCardMenuPopoverHeightPx(
  items: ReadonlyArray<MemoCardMenuItem>,
): number {
  const count = items.length
  if (count <= 0) return POPOVER_MIN_HEIGHT_PX
  const dividers = countMenuDividers(items)
  const raw = POPOVER_SHELL_PX + POPOVER_PER_ITEM_PX * count + dividers
  return Math.max(POPOVER_MIN_HEIGHT_PX, Math.ceil(raw))
}
