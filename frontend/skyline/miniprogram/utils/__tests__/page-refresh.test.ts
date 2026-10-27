import { describe, expect, it, vi } from 'vitest'
import {
  TITLE_MENU_ALL_TAGS_ID,
  TITLE_MENU_MEMO_SORT_NEWEST_ID,
  TITLE_MENU_MEMO_SORT_OLDEST_ID,
  TITLE_MENU_MEMO_SORT_SECTION_ID,
  TITLE_REFRESH_MENU_ITEMS,
  TITLE_MENU_GUEST_AUTH_ID,
  TITLE_MENU_PARENT_TAG_ID,
  buildHomeTitleMenuItems,
  buildTitleMenuWithOptionalAllTags,
  isAllTagsTitleMenuAction,
  isGuestAuthTitleMenuAction,
  isParentTagTitleMenuAction,
  isRefreshTitleMenuAction,
  runHomePageRefreshActions,
  runSearchPageRefreshActions,
} from '../page-refresh'

const PARENT_TAG_ITEM = {
  id: TITLE_MENU_PARENT_TAG_ID,
  label: '查看上一级标签',
  icon: 'enter',
  iconExtraClass: 'weimo-popover-menu__item-icon--rot-cw-90',
}

const SEARCH_PARENT_TAG_ITEM = {
  id: TITLE_MENU_PARENT_TAG_ID,
  label: '搜索上一级标签',
  icon: 'enter',
  iconExtraClass: 'weimo-popover-menu__item-icon--rot-cw-90',
}

const SORT_ITEMS_DESC = [
  {
    id: TITLE_MENU_MEMO_SORT_SECTION_ID,
    label: '排序方式',
    description: '从新到旧',
    icon: 'arrow-up-down-1',
    sectionHeader: true,
    collapseGroupId: 'memoSort',
  },
  {
    id: TITLE_MENU_MEMO_SORT_NEWEST_ID,
    label: '最新的排最前',
    icon: 'check',
    dividerBefore: false,
    collapseMemberOf: 'memoSort',
  },
  {
    id: TITLE_MENU_MEMO_SORT_OLDEST_ID,
    label: '最旧的排最前',
    dividerBefore: false,
    collapseMemberOf: 'memoSort',
  },
]

const SORT_ITEMS_ASC = [
  {
    id: TITLE_MENU_MEMO_SORT_SECTION_ID,
    label: '排序方式',
    description: '从旧到新',
    icon: 'arrow-up-down-1',
    sectionHeader: true,
    collapseGroupId: 'memoSort',
  },
  {
    id: TITLE_MENU_MEMO_SORT_NEWEST_ID,
    label: '最新的排最前',
    dividerBefore: false,
    collapseMemberOf: 'memoSort',
  },
  {
    id: TITLE_MENU_MEMO_SORT_OLDEST_ID,
    label: '最旧的排最前',
    icon: 'check',
    dividerBefore: false,
    collapseMemberOf: 'memoSort',
  },
]

describe('TITLE_REFRESH_MENU_ITEMS', () => {
  it('exposes a single refresh item with icon', () => {
    expect(TITLE_REFRESH_MENU_ITEMS).toEqual([{ id: 'refresh', label: '刷新', icon: 'refresh' }])
  })
})

describe('isRefreshTitleMenuAction', () => {
  it('returns true only for refresh', () => {
    expect(isRefreshTitleMenuAction('refresh')).toBe(true)
    expect(isRefreshTitleMenuAction('delete')).toBe(false)
    expect(isRefreshTitleMenuAction('')).toBe(false)
  })
})

describe('buildTitleMenuWithOptionalAllTags', () => {
  it('returns sort section and refresh when no selected tag (or whitespace)', () => {
    expect(buildTitleMenuWithOptionalAllTags('')).toEqual([
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
    expect(buildTitleMenuWithOptionalAllTags('', true)).toEqual([
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('prepends 查看全部笔记 on non-search when a tag is selected', () => {
    expect(buildTitleMenuWithOptionalAllTags('a/b')).toEqual([
      PARENT_TAG_ITEM,
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
    expect(buildTitleMenuWithOptionalAllTags('a/b', false)).toEqual([
      PARENT_TAG_ITEM,
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('prepends 搜索上一级标签 and 搜索全部笔记 on search page when a nested tag is selected', () => {
    expect(buildTitleMenuWithOptionalAllTags('a/b', true)).toEqual([
      SEARCH_PARENT_TAG_ITEM,
      { id: TITLE_MENU_ALL_TAGS_ID, label: '搜索全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('does not add parent tag entry for top-level selected tag on search page', () => {
    expect(buildTitleMenuWithOptionalAllTags('工作', true)).toEqual([
      { id: TITLE_MENU_ALL_TAGS_ID, label: '搜索全部笔记', icon: 'grid-view' },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('sort section subtitle follows ascending order when memoCreatedAtSort is asc', () => {
    expect(buildTitleMenuWithOptionalAllTags('', true, 'asc')).toEqual([
      ...SORT_ITEMS_ASC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })
})

describe('buildHomeTitleMenuItems', () => {
  it('returns sort section and refresh when no tag is selected', () => {
    expect(buildHomeTitleMenuItems('', {
      memoCreatedAtSort: 'desc',
    })).toEqual([
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('keeps all-tags first on filtered home', () => {
    expect(buildHomeTitleMenuItems('工作/产品', {
      memoCreatedAtSort: 'desc',
    })).toEqual([
      PARENT_TAG_ITEM,
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('does not add parent tag entry for top-level selected tag', () => {
    expect(buildHomeTitleMenuItems('工作', {
      memoCreatedAtSort: 'desc',
    })).toEqual([
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view' },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('sort section subtitle follows ascending order when memoCreatedAtSort is asc', () => {
    expect(buildHomeTitleMenuItems('', {
      memoCreatedAtSort: 'asc',
    })).toEqual([...SORT_ITEMS_ASC, ...TITLE_REFRESH_MENU_ITEMS])
  })

  it('adds login/register for guest home', () => {
    expect(buildHomeTitleMenuItems('', {
      showGuestAuthAction: true,
      memoCreatedAtSort: 'desc',
    })).toEqual([
      { id: TITLE_MENU_GUEST_AUTH_ID, label: '登录/注册', icon: 'login' },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('prepends login/register before tag nav on filtered guest home', () => {
    expect(buildHomeTitleMenuItems('工作/产品', {
      showGuestAuthAction: true,
      memoCreatedAtSort: 'desc',
    })).toEqual([
      { id: TITLE_MENU_GUEST_AUTH_ID, label: '登录/注册', icon: 'login' },
      { ...PARENT_TAG_ITEM, dividerBefore: false },
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })

  it('does not add login/register when logged in', () => {
    expect(buildHomeTitleMenuItems('', {
      showGuestAuthAction: false,
      memoCreatedAtSort: 'desc',
    })).toEqual([...SORT_ITEMS_DESC, ...TITLE_REFRESH_MENU_ITEMS])
  })

  it('adds parent tag entry for deeply nested selected tag', () => {
    expect(buildHomeTitleMenuItems('a/b/c', {
      memoCreatedAtSort: 'desc',
    })).toEqual([
      PARENT_TAG_ITEM,
      { id: TITLE_MENU_ALL_TAGS_ID, label: '查看全部笔记', icon: 'grid-view', dividerBefore: false },
      ...SORT_ITEMS_DESC,
      ...TITLE_REFRESH_MENU_ITEMS,
    ])
  })
})

describe('isAllTagsTitleMenuAction', () => {
  it('returns true only for all-tags id', () => {
    expect(isAllTagsTitleMenuAction(TITLE_MENU_ALL_TAGS_ID)).toBe(true)
    expect(isAllTagsTitleMenuAction('refresh')).toBe(false)
    expect(isAllTagsTitleMenuAction('')).toBe(false)
  })
})

describe('isParentTagTitleMenuAction', () => {
  it('returns true only for parent-tag id', () => {
    expect(isParentTagTitleMenuAction(TITLE_MENU_PARENT_TAG_ID)).toBe(true)
    expect(isParentTagTitleMenuAction(TITLE_MENU_ALL_TAGS_ID)).toBe(false)
    expect(isParentTagTitleMenuAction('refresh')).toBe(false)
  })
})

describe('home title menu action ids', () => {
  it('recognizes only the guest auth menu id', () => {
    expect(isGuestAuthTitleMenuAction(TITLE_MENU_GUEST_AUTH_ID)).toBe(true)
    expect(isGuestAuthTitleMenuAction(TITLE_MENU_ALL_TAGS_ID)).toBe(false)
    expect(isGuestAuthTitleMenuAction('refresh')).toBe(false)
  })
})

describe('runHomePageRefreshActions', () => {
  it('calls memo list, stats, and tag tree refresh even if one action throws synchronously', async () => {
    const refreshMemoList = vi.fn(() => {
      throw new Error('memo crash')
    })
    const refreshStats = vi.fn().mockResolvedValue(undefined)
    const refreshTagTree = vi.fn().mockResolvedValue(undefined)

    await expect(
      runHomePageRefreshActions({
        refreshMemoList,
        refreshStats,
        refreshTagTree,
      }),
    ).resolves.toBeUndefined()

    expect(refreshMemoList).toHaveBeenCalledTimes(1)
    expect(refreshStats).toHaveBeenCalledTimes(1)
    expect(refreshTagTree).toHaveBeenCalledTimes(1)
  })
})

describe('runSearchPageRefreshActions', () => {
  it('only refreshes memo list and swallows async rejection', async () => {
    const refreshMemoList = vi.fn().mockRejectedValue(new Error('search fail'))

    await expect(
      runSearchPageRefreshActions({
        refreshMemoList,
      }),
    ).resolves.toBeUndefined()

    expect(refreshMemoList).toHaveBeenCalledTimes(1)
  })
})
