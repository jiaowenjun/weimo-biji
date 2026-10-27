import type { MemoCardMenuItem } from './menu-items'

const TAG_EDIT_ITEM: MemoCardMenuItem = { id: 'tag-edit', label: '编辑标签', icon: 'edit' }
const TAG_ADD_ITEM: MemoCardMenuItem = { id: 'tag-add', label: '新增标签', icon: 'add' }
const TAG_REMOVE_ITEM: MemoCardMenuItem = {
  id: 'tag-remove',
  label: '删除标签',
  danger: true,
  icon: 'delete',
}

/** 占位「无」：仅「新增标签」 */
export function buildMemoCardTagPopoverItems(isPlaceholderNone: boolean): MemoCardMenuItem[] {
  if (isPlaceholderNone) {
    return [{ ...TAG_ADD_ITEM }]
  }
  return [
    TAG_EDIT_ITEM,
    { ...TAG_ADD_ITEM, dividerBefore: false },
    { ...TAG_REMOVE_ITEM, dividerBefore: true },
  ]
}
