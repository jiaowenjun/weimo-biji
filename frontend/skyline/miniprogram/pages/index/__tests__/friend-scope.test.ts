import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('index friend memo scope contract', () => {
  const ts = readFileSync(resolve(__dirname, '../index.ts'), 'utf8')
  const wxml = readFileSync(resolve(__dirname, '../index.wxml'), 'utf8')

  function methodSource(name: string, nextName: string) {
    const markers = [`\n  ${name}(`, `\n  async ${name}(`]
    const nextMarkers = [`\n  ${nextName}(`, `\n  async ${nextName}(`]
    const starts = markers
      .map((marker) => ts.indexOf(marker))
      .filter((index) => index >= 0)
    const start = starts.length ? Math.min(...starts) : -1
    const ends = nextMarkers
      .map((marker) => ts.indexOf(marker, start + name.length))
      .filter((index) => index >= 0)
    const end = ends.length ? Math.min(...ends) : -1
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    return ts.slice(start, end)
  }

  it('declares HomeMemoScope and friend scope handlers', () => {
    expect(ts).toContain('type HomeMemoScope =')
    expect(ts).toContain("kind: 'friend'")
    expect(ts).toContain("targetFriend: FriendProfile")
    expect(ts).toContain('switchToSelfScope')
    expect(ts).toContain('switchToFriendScope')
    expect(wxml).not.toContain('bind:friendselect="handleSidebarFriendSelect"')
  })

  it('loads friend memos through the strategy', () => {
    expect(ts).toContain('createMemoScopeStrategy')
    expect(ts).toContain('refreshFriendMemoList')
    expect(ts).toContain('loadMoreFriendMemoList')
    expect(ts).toContain('this._strategy.getCurrentQuery(this.data)')
    expect(ts).not.toContain('searchFriendMemos')
    expect(ts).not.toContain('collectCachedFriendReferencedOwnMemos')
    expect(ts).not.toContain('loadFriendMemoRelationMemos')
  })

  it('declares independent friend sidebar state', () => {
    expect(ts).toContain('friendProfiles: FriendProfile[]')
    expect(ts).toContain('selectedFriendUsername: string')
    expect(ts).toContain('resolveSelectedFriendProfile')
    expect(ts).not.toContain('friendProfile: FriendProfile | null')
    expect(ts).not.toMatch(/summary\.friend\b/)
    expect(ts).toContain('friendMemoQuery')
    expect(ts).toContain('friendMemoDateLabel')
    expect(ts).toContain('friendMemoFacetLabel')
    expect(ts).toContain('friendStats')
    expect(ts).toContain('friendStatsLoading')
    expect(ts).toContain('friendTagTreeNodes')
    expect(ts).toContain('friendTagTreeLoading')
    expect(ts).toContain('friendTagTreeInitialized')
    expect(ts).toContain('friendTagTreeLoadFailed')
    expect(ts).toContain('ensureFriendSidebarData')
    expect(ts).toContain('refreshFriendSidebarStats')
    expect(ts).toContain('refreshFriendTagTree')
  })

  it('binds sidebar identity stats heatmap and tag tree by scope', () => {
    expect(wxml).toContain(`user-nickname="{{homeMemoScope.kind === 'friend' ? (homeMemoScope.targetFriend.nickname || homeMemoScope.targetFriend.username) : (session.user ? session.user.nickname : '')}}"`)
    expect(wxml).not.toContain('user-avatar-url')
    expect(wxml).toContain(`stats="{{homeMemoScope.kind === 'friend' ? friendStats : stats}}"`)
    expect(wxml).toContain(`stats-loading="{{homeMemoScope.kind === 'friend' ? friendStatsLoading : statsLoading}}"`)
    expect(wxml).toContain(`tag-tree-nodes="{{homeMemoScope.kind === 'friend' ? friendTagTreeNodes : tagTreeNodes}}"`)
    expect(wxml).toContain(`tag-menu-enabled="{{homeMemoScope.kind === 'self' && !!session.accessToken}}"`)
  })

  it('binds memo list filter labels by scope', () => {
    expect(wxml).toContain(
      `value="{{homeMemoScope.kind === 'friend' ? friendMemoDateLabel : memoDateLabel}}"`,
    )
    expect(wxml).toContain(
      `value="{{homeMemoScope.kind === 'friend' ? friendMemoFacetLabel : memoFacetLabel}}"`,
    )
    expect(wxml).toContain(`selected-tag="{{homeMemoScope.kind === 'friend' ? friendMemoQuery.selectedTag : memoQuery.selectedTag}}"`)
  })

  it('hydrates cross-user reference previews in the self memo list', () => {
    expect(ts).toContain('createSelfMemoListOnChange')
    expect(ts).toContain('_friendReferenceHydrator')
    expect(ts).toContain('createFriendReferencePreviewHydrator')
    expect(ts).toContain('resolveReferencePreview')
    const hydrator = readFileSync(
      resolve(__dirname, '../../../utils/friend-reference-preview-hydrator.ts'),
      'utf8',
    )
    expect(hydrator).toContain('buildCachedEntryFromMemo')
  })

  it('hydrates incoming friend referenced-by previews in the self memo list', () => {
    const hydrator = readFileSync(
      resolve(__dirname, '../../../utils/friend-reference-preview-hydrator.ts'),
      'utf8',
    )
    expect(hydrator).toContain('collectFriendMemoReferencedByRefs')
    expect(hydrator).toContain('...collectFriendMemoReferencedByRefs')
    expect(ts).not.toContain(
      "relation === 'reference' ? this._friendReferencePreviews.get(ref) : undefined",
    )
  })

  it('renders friend cards readonly and hides FAB in friend scope', () => {
    expect(wxml).toContain(
      `viewer-role="{{viewerRole}}"`,
    )
    expect(ts).toContain("viewerRole: 'self'")
    expect(ts).toContain('viewerRole: this._selfViewerRole()')
    expect(ts).toContain('viewerRole: this.data.homeMemoScope.kind === \'friend\' ? \'friend\' : this._selfViewerRole()')
    expect(ts).toContain("viewerRole: 'friend'")
    expect(wxml).toContain(
      `owner-username="{{homeMemoScope.kind === 'friend' ? homeMemoScope.targetFriend.username : ''}}"`,
    )
    expect(wxml).toContain(`wx:if="{{homeMemoScope.kind === 'self'}}"`)
  })

  it('recomputes self-scope viewerRole from the current session after returning from settings', () => {
    const selfViewerRole = methodSource('_selfViewerRole', '_currentListKey')
    const onShow = methodSource('onShow', 'onHide')
    const switchToSelfScope = methodSource('switchToSelfScope', 'switchToFriendScope')

    expect(selfViewerRole).toContain("return hasSession() ? 'self' : 'visitor'")
    expect(onShow).toContain(
      "viewerRole: this.data.homeMemoScope.kind === 'friend' ? 'friend' : this._selfViewerRole()",
    )
    expect(switchToSelfScope).toContain("viewerRole: this._selfViewerRole()")
  })

  it('refreshes the friend memo list after saving a friend annotation via strategy', () => {
    expect(ts).toContain('dispatchMemoCardTap(this, memoId)')
    expect(ts).toContain('dispatchMemoQuote(this, memoId)')
    expect(ts).toContain('refreshList: () => this.refreshMemoList()')
  })

  it('resolves relations through the strategy for friend memo list projection', () => {
    expect(ts).toContain('refreshFriendMemoList(this, this._strategy.getCurrentQuery(this.data), PAGE_SIZE)')
    expect(ts).toContain('loadMoreFriendMemoList(this, this._strategy.getCurrentQuery(this.data), PAGE_SIZE)')
  })

  it('routes friend card interactions through the strategy', () => {
    const cardTap = methodSource('handleMemoCardTap', 'handleMemoEdit')
    const quoteTap = methodSource('handleMemoQuote', 'handleMemoReferenceTap')
    const referenceTap = methodSource('handleMemoReferenceTap', 'handleMemoDelete')

    expect(cardTap).toContain('dispatchMemoCardTap(this, memoId)')
    expect(quoteTap).toContain('dispatchMemoQuote(this, memoId)')
    expect(referenceTap).toContain('dispatchMemoReferenceTap(this, memoId)')
  })

  it('uses strategy friend accessor for friend profile consumers', () => {
    const cardContext = methodSource('_cardActionContext', '_currentListKey')
    const searchTap = methodSource('handleSearchTap', 'handleLogout')
    const tagTap = methodSource('handleMemoTagTap', 'clearMemoDateFilter')

    expect(cardContext).toContain('this._strategy.getFriend()')
    expect(cardContext).not.toContain('this.data.homeMemoScope.targetFriend')
    expect(searchTap).toContain('this._strategy.getFriend()')
    expect(tagTap).not.toContain('this._strategy.getFriend()')
  })

  it('syncs the selected target friend snapshot and exits friend scope when it disappears', () => {
    const syncFriendSummary = methodSource('syncFriendSummary', 'startFriendUnreadPolling')

    expect(syncFriendSummary).toContain('const selectedFriend = resolveSelectedFriendProfile(')
    expect(syncFriendSummary).toContain('selectedFriendUsername: selectedFriend?.username || \'\'')
    expect(syncFriendSummary).toContain("{ kind: 'friend', targetFriend: selectedFriend }")
    expect(syncFriendSummary).toContain("this.setData(patch, () => {")
    expect(syncFriendSummary).toContain('this.switchToSelfScope()')
  })

  it('keeps sidebar tag and date filters in friend scope', () => {
    const helper = methodSource('applyCurrentScopeSelectedTag', 'handleSidebarTagSelect')
    const tagSelect = methodSource('handleSidebarTagSelect', 'handleSidebarShowAll')
    const showAll = methodSource('handleSidebarShowAll', 'handleSidebarTodayReview')
    const todayReview = methodSource('handleSidebarTodayReview', 'handleMemoTagTap')
    const heatmap = methodSource('handleHeatmapDateSelect', 'handleSidebarTagSelect')

    expect(tagSelect).toContain('this.applyCurrentScopeSelectedTag(tag)')
    expect(helper).toContain("this.data.homeMemoScope.kind === 'friend'")
    expect(helper).toContain('this.applyFriendMemoQuery')
    expect(tagSelect).not.toContain('this.switchToSelfScope')

    expect(showAll).toContain("this.data.homeMemoScope.kind === 'friend'")
    expect(showAll).toContain('this.applyFriendMemoQuery(createEmptyMemoQueryDraft()')
    expect(showAll).not.toContain('this.switchToSelfScope')

    expect(todayReview).toContain("this.data.homeMemoScope.kind === 'friend'")
    expect(todayReview).toContain('this.applyFriendMemoQuery')
    expect(todayReview).not.toContain('this.switchToSelfScope')

    expect(heatmap).toContain("this.data.homeMemoScope.kind === 'friend'")
    expect(heatmap).toContain('this.applyFriendMemoQuery')
    expect(heatmap).not.toContain('this.switchToSelfScope')
  })

  it('filters the selected target friend list from friend memo card tag capsules', () => {
    const tagTap = methodSource('handleMemoTagTap', 'clearMemoDateFilter')

    expect(ts).not.toContain('openFriendIndexTagDrill')
    expect(tagTap).toContain('this.applyCurrentScopeSelectedTag(tag)')
    expect(tagTap).not.toContain('wx.navigateBack')
    expect(tagTap).not.toContain('openFriendIndexTagDrill(')
  })

  it('does not initialize friend scope from tag drill route options', () => {
    const onLoad = methodSource('onLoad', 'onReady')
    const onShow = methodSource('onShow', 'onHide')

    expect(ts).not.toContain('friendProfileFromIndexRouteOptions')
    expect(ts).not.toContain("options.scope === 'friend'")
    expect(ts).not.toContain('isFriendTagDrillPage')
    expect(onLoad).not.toContain("options.scope === 'friend'")
    expect(onLoad).not.toContain('routeFriend')
    expect(onLoad).toContain("const initialScope: HomeMemoScope = { kind: 'self' }")
    expect(onShow).toContain('friendNavTitle(')
    expect(onShow).toContain('this._strategy.getCurrentQuery(this.data)')
  })

  it('reuses the same tag selection helper for sidebar rows and card capsules', () => {
    const helper = methodSource('applyCurrentScopeSelectedTag', 'handleSidebarTagSelect')
    const tagSelect = methodSource('handleSidebarTagSelect', 'handleSidebarShowAll')
    const tagTap = methodSource('handleMemoTagTap', 'clearMemoDateFilter')

    expect(helper).toContain('shouldNoOpExactHomeTagReselect(currentQuery.selectedTag, tag)')
    expect(helper).toContain('this.applyFriendMemoQuery')
    expect(helper).toContain("dateValue: '',")
    expect(helper).toContain('this.applyMemoQuery')
    expect(tagSelect).toContain('this.applyCurrentScopeSelectedTag(tag)')
    expect(tagTap).toContain('this.applyCurrentScopeSelectedTag(tag)')
    expect(tagTap).not.toContain('openIndexTagDrill')
    expect(tagTap).not.toContain('openFriendIndexTagDrill')
    expect(tagTap).not.toContain('isStrictDescendantTag')
  })

  it('uses strategy query accessors for create compose initial tags', () => {
    const fabTap = methodSource('handleFabTap', 'handleMemoCardTap')

    expect(fabTap).toContain('this._strategy.getCurrentQuery(this.data)')
    expect(fabTap).not.toContain('this.data.memoQuery.selectedTag')
  })

  it('loads and paginates friend memos through the strategy with friend query', () => {
    const refresh = methodSource('refreshMemoList', 'loadMoreMemoList')
    const loadMore = methodSource('loadMoreMemoList', 'handleTitleMenuSelect')

    expect(refresh).toContain("this._strategy.kind === 'friend'")
    expect(refresh).toContain('refreshFriendMemoList(this, this._strategy.getCurrentQuery(this.data), PAGE_SIZE)')
    expect(refresh).toContain('this._strategy.getCurrentQuery(this.data)')
    expect(loadMore).toContain("this._strategy.kind === 'friend'")
    expect(loadMore).toContain('loadMoreFriendMemoList(this, this._strategy.getCurrentQuery(this.data), PAGE_SIZE)')
    expect(loadMore).toContain('this._strategy.getCurrentQuery(this.data)')
  })

  it('clear actions clear friend filters instead of switching to self', () => {
    const clearDate = methodSource('clearMemoDateFilter', 'clearSelectedTag')
    const clearTag = methodSource('clearSelectedTag', 'clearMemoSearch')
    const emptyAction = methodSource('handleEmptyAction', 'handleFabTap')

    expect(clearDate).toContain('this.applyFriendMemoQuery')
    expect(clearDate).not.toContain('this.switchToSelfScope')
    expect(clearTag).toContain('this.applyFriendMemoQuery')
    expect(clearTag).not.toContain('this.switchToSelfScope')
    expect(emptyAction).toContain("this.data.homeMemoScope.kind === 'friend'")
    expect(emptyAction).toContain('this._strategy.getCurrentQuery(this.data)')
  })
})
