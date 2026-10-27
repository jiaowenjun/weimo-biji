import type { PopoverMenuItem } from '../weimo-popover-menu/index'
import { resolvePermissions, type MemoPermissions } from '../../utils/memo-permissions'

export type MemoCardMenuItem = PopoverMenuItem

export interface BuildMemoCardMenuOptions {
  permissions?: MemoPermissions
  /** 与引用栏可见条件一致时为 true，插入「查看详情」。 */
  showMemoDetailPage?: boolean
  menuReadonly?: boolean
}

const EDIT_ITEM: MemoCardMenuItem = { id: 'edit', label: '编辑', icon: 'edit' }
const SHARE_ITEM: MemoCardMenuItem = { id: 'share', label: '分享', icon: 'share' }
const COPY_ITEM: MemoCardMenuItem = { id: 'copy', label: '复制', icon: 'copy' }
const QUOTE_ITEM: MemoCardMenuItem = { id: 'quote', label: '批注', icon: 'arrow-left-up-circle' }
const MEMO_DETAIL_ITEM: MemoCardMenuItem = {
  id: 'memo-detail',
  label: '查看详情',
  icon: 'arrow-up-down-circle',
  iconExtraClass: 'weimo-popover-menu__item-icon--rot-ccw-45',
}
const DELETE_ITEM: MemoCardMenuItem = { id: 'delete', label: '删除', danger: true, icon: 'delete' }

/**
 * 构造 memo-card 三点菜单项（结构与标签个数无关；改标签可走标签长按菜单）。
 *
 * 顺序与分组（组内无分割线，组间有分割线）：
 * - self：编辑、批注（同组）
 * - （可选）查看详情、分享
 * - 删除
 *
 * 「查看详情」仅当 `showMemoDetailPage` 为 true 时出现。
 *
 * 返回新数组。普通模式下除带 `dividerBefore` 的浅拷贝项外仍复用模块内常量；
 * 只读禁用模式在组好菜单后再为每项补上 `disabled`。
 */
export function buildMemoCardMenuItems(
  _tags: ReadonlyArray<string>,
  options: BuildMemoCardMenuOptions = {},
): MemoCardMenuItem[] {
  const p = options.permissions ?? resolvePermissions('self')
  const withDetail = !!options.showMemoDetailPage

  const items: MemoCardMenuItem[] = []

  if (p.canEdit) items.push(EDIT_ITEM)
  if (p.canQuote) items.push({ ...QUOTE_ITEM, dividerBefore: false })

  const priorGroupExists = p.canEdit || p.canQuote
  let secondGroupStarted = false

  if (withDetail && p.canSeeDetailEntry) {
    items.push({ ...MEMO_DETAIL_ITEM, dividerBefore: priorGroupExists })
    secondGroupStarted = true
  }
  if (p.canShare) {
    items.push({ ...SHARE_ITEM, dividerBefore: secondGroupStarted ? false : priorGroupExists })
    secondGroupStarted = true
  }
  if (p.canCopy) {
    items.push({ ...COPY_ITEM, dividerBefore: false })
  }

  if (p.canDelete) items.push({ ...DELETE_ITEM, dividerBefore: true })

  if (!options.menuReadonly) return items
  return items.map((item) =>
    item.id === 'share' || item.id === 'copy' ? item : { ...item, disabled: true })
}
