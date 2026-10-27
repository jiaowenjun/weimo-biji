import type { PopoverMenuItem } from '../components/weimo-popover-menu/index'
import type { MemoCreatedAtSort } from './memo-list-sort-prefs'
import { parentTagPath } from './tag-path'

type RefreshAction = () => Promise<unknown>

export const TITLE_REFRESH_MENU_ITEMS: PopoverMenuItem[] = [
  { id: 'refresh', label: '刷新', icon: 'refresh' },
]

/** 标题菜单：有选中标签时在「刷新」之上展示分项，id 与 handler 不变；文案随是否搜索页区分 */
export const TITLE_MENU_ALL_TAGS_ID = 'allTags'
export const TITLE_MENU_PARENT_TAG_ID = 'parentTag'
export const TITLE_MENU_VIEW_FRIEND_MEMOS_ID = 'viewFriendMemos'
export const TITLE_MENU_VIEW_MY_MEMOS_ID = 'viewMyMemos'
export const TITLE_MENU_GUEST_AUTH_ID = 'guestAuth'
export const TITLE_MENU_MEMO_SORT_SECTION_ID = 'memoSortSection'
export const TITLE_MENU_MEMO_SORT_NEWEST_ID = 'memoSortNewestFirst'
export const TITLE_MENU_MEMO_SORT_OLDEST_ID = 'memoSortOldestFirst'
const MEMO_SORT_COLLAPSE_GROUP = 'memoSort'

/** 与首页列表当前创建时间排序方向对应的短文说明（用于标题菜单「排序方式」副标题） */
function memoCreatedAtSortSummaryLabel(sort: MemoCreatedAtSort): string {
  return sort === 'desc' ? '从新到旧' : '从旧到新'
}

type HomeTitleMenuScope = 'self' | 'friend'

function buildOptionalAllTagsTitleMenuItem(
  selectedTag: string,
  isSearchPage = false,
): PopoverMenuItem[] {
  if (!String(selectedTag || '').trim()) {
    return []
  }
  const label = isSearchPage ? '搜索全部笔记' : '查看全部笔记'
  return [{ id: TITLE_MENU_ALL_TAGS_ID, label, icon: 'grid-view' }]
}

function buildOptionalParentTagTitleMenuItem(
  selectedTag: string,
  isSearchPage = false,
): PopoverMenuItem[] {
  if (!parentTagPath(selectedTag)) {
    return []
  }
  return [{
    id: TITLE_MENU_PARENT_TAG_ID,
    label: isSearchPage ? '搜索上一级标签' : '查看上一级标签',
    icon: 'enter',
    iconExtraClass: 'weimo-popover-menu__item-icon--rot-cw-90',
  }]
}

function buildTagNavTitleMenuItems(selectedTag: string, isSearchPage = false): PopoverMenuItem[] {
  const parentItems = buildOptionalParentTagTitleMenuItem(selectedTag, isSearchPage)
  const allTagsItems = buildOptionalAllTagsTitleMenuItem(selectedTag, isSearchPage)
  if (parentItems.length === 0) {
    return allTagsItems
  }
  if (allTagsItems.length === 0) {
    return parentItems
  }
  return [
    ...parentItems,
    { ...allTagsItems[0]!, dividerBefore: false },
    ...allTagsItems.slice(1),
  ]
}

function memoSortTitleMenuItems(memoCreatedAtSort: MemoCreatedAtSort): PopoverMenuItem[] {
  return [
    {
      id: TITLE_MENU_MEMO_SORT_SECTION_ID,
      label: '排序方式',
      description: memoCreatedAtSortSummaryLabel(memoCreatedAtSort),
      icon: 'arrow-up-down-1',
      sectionHeader: true,
      collapseGroupId: MEMO_SORT_COLLAPSE_GROUP,
    },
    {
      id: TITLE_MENU_MEMO_SORT_NEWEST_ID,
      label: '最新的排最前',
      dividerBefore: false,
      collapseMemberOf: MEMO_SORT_COLLAPSE_GROUP,
      ...(memoCreatedAtSort === 'desc' ? { icon: 'check' as const } : {}),
    },
    {
      id: TITLE_MENU_MEMO_SORT_OLDEST_ID,
      label: '最旧的排最前',
      dividerBefore: false,
      collapseMemberOf: MEMO_SORT_COLLAPSE_GROUP,
      ...(memoCreatedAtSort === 'asc' ? { icon: 'check' as const } : {}),
    },
  ]
}

export function buildTitleMenuWithOptionalAllTags(
  selectedTag: string,
  isSearchPage = false,
  memoCreatedAtSort: MemoCreatedAtSort = 'desc',
): PopoverMenuItem[] {
  return [
    ...buildTagNavTitleMenuItems(selectedTag, isSearchPage),
    ...memoSortTitleMenuItems(memoCreatedAtSort),
    ...TITLE_REFRESH_MENU_ITEMS,
  ]
}

export function buildHomeTitleMenuItems(
  selectedTag: string,
  options: {
    scope: HomeTitleMenuScope
    canViewFriendMemos?: boolean
    showGuestAuthAction?: boolean
    memoCreatedAtSort: MemoCreatedAtSort
  },
): PopoverMenuItem[] {
  const scopeSwitchItem: PopoverMenuItem | null = options.scope === 'friend'
    ? { id: TITLE_MENU_VIEW_MY_MEMOS_ID, label: '查看我的笔记', icon: 'home' }
    : options.canViewFriendMemos
      ? { id: TITLE_MENU_VIEW_FRIEND_MEMOS_ID, label: '查看好友笔记', icon: 'member' }
      : null

  const guestAuthItem: PopoverMenuItem | null =
    options.scope === 'self' && options.showGuestAuthAction
      ? { id: TITLE_MENU_GUEST_AUTH_ID, label: '登录/注册', icon: 'login' }
      : null

  const tagNavItems = buildTagNavTitleMenuItems(selectedTag)
  const navScopeItems: PopoverMenuItem[] = []
  if (guestAuthItem) {
    navScopeItems.push(guestAuthItem)
  }
  if (tagNavItems.length > 0) {
    navScopeItems.push(
      guestAuthItem
        ? { ...tagNavItems[0]!, dividerBefore: false }
        : tagNavItems[0]!,
    )
    navScopeItems.push(...tagNavItems.slice(1))
  }
  if (scopeSwitchItem) {
    navScopeItems.push(
      tagNavItems.length > 0
        ? { ...scopeSwitchItem, dividerBefore: false }
        : scopeSwitchItem,
    )
  }

  return [
    ...navScopeItems,
    ...memoSortTitleMenuItems(options.memoCreatedAtSort),
    ...TITLE_REFRESH_MENU_ITEMS,
  ]
}

export function isAllTagsTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_ALL_TAGS_ID
}

export function isParentTagTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_PARENT_TAG_ID
}

export function isViewFriendMemosTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_VIEW_FRIEND_MEMOS_ID
}

export function isViewMyMemosTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_VIEW_MY_MEMOS_ID
}

export function isGuestAuthTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_GUEST_AUTH_ID
}

export function isMemoSortNewestFirstTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_MEMO_SORT_NEWEST_ID
}

export function isMemoSortOldestFirstTitleMenuAction(id: string): boolean {
  return id === TITLE_MENU_MEMO_SORT_OLDEST_ID
}

export function isRefreshTitleMenuAction(id: string): boolean {
  return id === 'refresh'
}

function invokeRefresh(action: RefreshAction): Promise<unknown> {
  return Promise.resolve().then(action)
}

export function runHomePageRefreshActions(actions: {
  refreshMemoList: RefreshAction
  refreshStats: RefreshAction
  refreshTagTree: RefreshAction
}): Promise<void> {
  return Promise.allSettled([
    invokeRefresh(actions.refreshMemoList),
    invokeRefresh(actions.refreshStats),
    invokeRefresh(actions.refreshTagTree),
  ]).then(() => {})
}

export function runSearchPageRefreshActions(actions: {
  refreshMemoList: RefreshAction
}): Promise<void> {
  return Promise.allSettled([
    invokeRefresh(actions.refreshMemoList),
  ]).then(() => {})
}
