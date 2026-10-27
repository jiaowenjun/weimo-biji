import type { PopoverMenuItem } from '../weimo-popover-menu/index'

export type TagTreeMenuItem = PopoverMenuItem

const EDIT_ITEM: TagTreeMenuItem = { id: 'edit', label: '重命名', icon: 'edit' }
const DELETE_ITEM: TagTreeMenuItem = { id: 'delete', label: '删除', icon: 'delete', danger: true }

export function buildTagTreeMenuItems(authenticated: boolean): TagTreeMenuItem[] {
  return authenticated ? [EDIT_ITEM, DELETE_ITEM] : []
}
