import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PanelLeft, Plus, Search } from 'lucide-react'
import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'
import { TagBread } from 'weimo-ui/components/tag-bread'
import { TagPicker } from 'weimo-ui/components/tag-picker'
import { useInfiniteListSentinel } from 'weimo-ui/lib/use-infinite-list-sentinel'

import type { CardDraft } from '@/components/card'
import { RefCard } from '@/components/ref-card'
import { SideBar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import {
  buildMemoReferencePreviews,
  createMemoReferencePreviewResolver,
  toCardNote,
} from '@/features/workspace/memo-data'
import {
  createWorkspaceMemoCacheIndex,
  type WorkspaceMemoCacheOwner,
} from '@/features/workspace/workspace-cache'
import { useMemoDisplayOverrides } from '@/features/workspace/workspace-memo-display'
import { WorkspaceFilterBar } from '@/features/workspace/workspace-filter-bar'
import {
  buildSidebarStatItems,
  formatTagBreadTag,
  toHeatmapDailyCounts,
  toSidebarTagTree,
  toTagOptions,
} from '@/features/workspace/sidebar-data'
import {
  clearWorkspaceQueries,
  getWorkspaceQueryScope,
  useFriendReferencePreviewMap,
  useFriendSummaryQuery,
  useFriendMemoListQuery,
  useFriendTagTreeQuery,
  useFriendWorkspaceStatsQuery,
  useDeleteMemoMutation,
  useMemoListQuery,
  useTagTreeQuery,
  useUpdateMemoMutation,
  useWorkspaceStatsQuery,
} from '@/features/workspace/workspace-queries'
import {
  resetWorkspaceNavigation,
} from '@/features/workspace/workspace-navigation-store'
import { useWorkspacePageNavigation } from '@/features/workspace/use-workspace-page-navigation'
import type { FriendProfile, Memo } from '@/features/workspace/workspace-types'
import { useWorkspaceTagActions } from '@/features/workspace/workspace-tag-actions'
import { PendingCreateCard } from '@/features/workspace/pending-create-card'
import { useAuthenticatedMemoCreate } from './use-authenticated-memo-create'
import { WorkspaceMemoDetailDialog } from './workspace-memo-detail-dialog'
import { WorkspaceMemoQuoteDialog } from './workspace-memo-quote-dialog'
import { WorkspaceTitleMenu } from './workspace-title-menu'
import { copyMemoContentToClipboard } from './workspace-memo-copy'
import { runWorkspaceTitleRefreshActions } from './workspace-title-refresh'

const EMPTY_MEMO_CARDS: Memo[] = []
const EMPTY_FRIEND_PROFILES: FriendProfile[] = []

type HomeMemoScope = { kind: 'self' } | { kind: 'friend'; targetFriend: FriendProfile }

function resolveSelectedFriendProfile(
  friendProfiles: FriendProfile[],
  scope: HomeMemoScope,
) {
  if (scope.kind === 'friend') {
    const currentFriend = friendProfiles.find(
      (friend) => friend.username === scope.targetFriend.username,
    )

    if (currentFriend) return currentFriend
  }

  return friendProfiles.find((friend) => friend.username.trim()) ?? null
}

function friendDisplayName(friend: FriendProfile) {
  return friend.nickname?.trim() || friend.username
}

function MemoListSkeleton() {
  return (
    <div aria-label="笔记加载中" className="memo-list-skeleton">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="memo-list-skeleton__card" key={index}>
          <div className="memo-list-skeleton__line memo-list-skeleton__line--short" />
          <div className="memo-list-skeleton__line" />
          <div className="memo-list-skeleton__line" />
          <div className="memo-list-skeleton__chips">
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  )
}

export function WorkspaceDemoPage() {
  const { displayName, logout, user } = useAuth()
  const queryClient = useQueryClient()
  const statsQuery = useWorkspaceStatsQuery()
  const tagTreeQuery = useTagTreeQuery()
  const friendSummaryQuery = useFriendSummaryQuery()
  const { filters: memoFilters, navigation } = useWorkspacePageNavigation()
  const memoListQuery = useMemoListQuery(memoFilters)
  const deleteMemoMutation = useDeleteMemoMutation()
  const updateMemoMutation = useUpdateMemoMutation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [homeMemoScope, setHomeMemoScope] = useState<HomeMemoScope>({ kind: 'self' })
  const memoCreate = useAuthenticatedMemoCreate(navigation.selectedTag)
  const {
    createMemo: createWorkspaceMemo,
    reset: resetMemoCreate,
  } = memoCreate
  const {
    expandedTags: expandedTagTreeTags,
    handleDeleteTag,
    handleRenameTag,
    handleRenameTagApply,
    handleRenameTagOpenChange,
    renamingTag,
    setExpandedTags: setExpandedTagTreeTags,
  } = useWorkspaceTagActions({
    selectedTag: navigation.selectedTag,
    selectTag: navigation.selectTag,
    showAllNotes: navigation.showAllNotes,
  })
  const [detailMemoId, setDetailMemoId] = useState<number | null>(null)
  const [quoteMemoId, setQuoteMemoId] = useState<number | null>(null)
  const friendProfiles = friendSummaryQuery.data?.friends ?? EMPTY_FRIEND_PROFILES
  const selectedFriendUsername = homeMemoScope.kind === 'friend'
    ? homeMemoScope.targetFriend.username
    : ''
  const canViewFriendMemos = homeMemoScope.kind === 'self' &&
    friendProfiles.some((friend) => friend.username.trim())
  const friendStatsQuery = useFriendWorkspaceStatsQuery(selectedFriendUsername)
  const friendTagTreeQuery = useFriendTagTreeQuery(selectedFriendUsername)
  const friendMemoListQuery = useFriendMemoListQuery(
    selectedFriendUsername,
    memoFilters,
  )
  const activeStatsQuery = homeMemoScope.kind === 'friend' ? friendStatsQuery : statsQuery
  const activeTagTreeQuery = homeMemoScope.kind === 'friend' ? friendTagTreeQuery : tagTreeQuery
  const activeMemoListQuery = homeMemoScope.kind === 'friend' ? friendMemoListQuery : memoListQuery
  const {
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  } = activeMemoListQuery
  const loadMoreSentinelRef = useInfiniteListSentinel({
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  const rawMemoCards = activeMemoListQuery.data?.items ?? EMPTY_MEMO_CARDS
  const totalMemoCount = activeMemoListQuery.data?.totalCount ?? 0
  const workspaceQueryScope = getWorkspaceQueryScope(user)
  const activeMemoOwnerScope = homeMemoScope.kind === 'friend'
    ? `friend:${selectedFriendUsername}`
    : `self:${workspaceQueryScope}`
  const {
    clear: clearMemoDisplayOverrides,
    displayedMemos: memoCards,
    remove: removeMemoDisplayOverride,
    track: trackMemoDisplayOverride,
  } = useMemoDisplayOverrides(rawMemoCards, activeMemoOwnerScope)
  const memoById = useMemo(
    () => new Map(memoCards.map((memo) => [memo.id, memo])),
    [memoCards],
  )
  const detailMemo = detailMemoId === null ? null : (memoById.get(detailMemoId) ?? null)
  const quoteMemo = quoteMemoId === null ? null : (memoById.get(quoteMemoId) ?? null)
  const friendReferenceDetails = useFriendReferencePreviewMap(
    memoCards,
    selectedFriendUsername,
  )
  const memoCacheOwner = useMemo<WorkspaceMemoCacheOwner>(
    () => homeMemoScope.kind === 'friend'
      ? {
          kind: 'friend',
          scope: workspaceQueryScope,
          friendUsername: selectedFriendUsername,
        }
      : { kind: 'self', scope: workspaceQueryScope },
    [homeMemoScope.kind, selectedFriendUsername, workspaceQueryScope],
  )
  const workspaceMemoCacheIndex = useMemo(
    () => createWorkspaceMemoCacheIndex(queryClient, memoCacheOwner, rawMemoCards),
    [memoCacheOwner, queryClient, rawMemoCards],
  )
  const referencePreviewResolver = useMemo(
    () =>
      createMemoReferencePreviewResolver({
        getMemoById: (id) => {
          const currentMemo = memoById.get(id)
          if (currentMemo) return currentMemo

          const cachedMemo = workspaceMemoCacheIndex.getMemoById(id)
          return cachedMemo
        },
        resolveReferenceMemo: (id) => friendReferenceDetails.memos.get(id),
        resolveReferencePreview: (id) => friendReferenceDetails.previews.get(id),
        summaryCache: workspaceMemoCacheIndex.getSummaryCache(),
      }),
    [friendReferenceDetails, memoById, workspaceMemoCacheIndex],
  )
  const memoListHasData = memoCards.length > 0
  const hasVisibleMemoCards = memoListHasData || Boolean(memoCreate.pendingCreate)

  const tagOptions = useMemo(
    () => {
      const treeTagOptions = toTagOptions(activeTagTreeQuery.data)
      const memoTagOptions = memoCards.flatMap((memo) => memo.tags)

      return Array.from(new Set([...treeTagOptions, ...memoTagOptions]))
    },
    [activeTagTreeQuery.data, memoCards],
  )

  const statItems = useMemo(
    () => buildSidebarStatItems(activeStatsQuery.data),
    [activeStatsQuery.data],
  )
  const dailyCounts = useMemo(
    () =>
      activeStatsQuery.data
        ? toHeatmapDailyCounts(activeStatsQuery.data.daily_note_count)
        : [],
    [activeStatsQuery.data],
  )
  const tagTree = useMemo(
    () => toSidebarTagTree(activeTagTreeQuery.data),
    [activeTagTreeQuery.data],
  )

  const openSidebar = useCallback(() => {
    setSidebarOpen(true)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleLogout = useCallback(() => {
    clearWorkspaceQueries(queryClient)
    resetWorkspaceNavigation()
    logout()
  }, [logout, queryClient])

  const handleTitleRefresh = useCallback(() => {
    clearMemoDisplayOverrides()
    void runWorkspaceTitleRefreshActions({
      refreshMemoList: () => activeMemoListQuery.refetch(),
      refreshReferencePreviews: () => friendReferenceDetails.refetch(),
      refreshStats: () => activeStatsQuery.refetch(),
      refreshTagTree: () => activeTagTreeQuery.refetch(),
    })
  }, [
    activeMemoListQuery,
    activeStatsQuery,
    activeTagTreeQuery,
    clearMemoDisplayOverrides,
    friendReferenceDetails,
  ])

  const handleViewFriendMemos = useCallback(() => {
    const friend = resolveSelectedFriendProfile(friendProfiles, homeMemoScope)
    if (!friend) return

    setHomeMemoScope({ kind: 'friend', targetFriend: friend })
    resetMemoCreate()
  }, [friendProfiles, homeMemoScope, resetMemoCreate])

  const handleViewMyMemos = useCallback(() => {
    setHomeMemoScope({ kind: 'self' })
  }, [])

  const handleMemoSave = useCallback((memo: Memo, draft: CardDraft) => {
    const content = draft.content.trim()
    if (!content) return
    const tags = [...draft.tags]

    void trackMemoDisplayOverride(
      memo.id,
      { content, tags },
      () => updateMemoMutation.mutateAsync(
        {
          id: memo.id,
          payload: { content, tags, refs: [...memo.refs] },
        },
      ),
    )
  }, [trackMemoDisplayOverride, updateMemoMutation])

  const handleMemoDelete = useCallback((memo: Memo) => {
    if (deleteMemoMutation.isPending) return
    if (!window.confirm('确定删除这条笔记吗？删除后不可恢复。')) return

    void deleteMemoMutation.mutateAsync({ id: memo.id }).then(
      () => {
        removeMemoDisplayOverride(memo.id)
      },
      (error) => {
        window.alert(error instanceof Error ? error.message : '删除笔记失败')
      },
    )
  }, [deleteMemoMutation, removeMemoDisplayOverride])

  const handleMemoDetailOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDetailMemoId(null)
    }
  }, [])

  const handleMemoCopy = useCallback((memo: Memo) => {
    void copyMemoContentToClipboard(memo.content).catch(() => {
      window.alert('复制失败')
    })
  }, [])

  const handleMemoQuoteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setQuoteMemoId(null)
    }
  }, [])

  const handleMemoQuoteSave = useCallback((memo: Memo, draft: CardDraft) => {
    const content = draft.content.trim()
    if (!content) return
    const tags = [...draft.tags]

    void createWorkspaceMemo({ content, tags, refs: [String(memo.id)] }).then(
      () => {
        setQuoteMemoId(null)
      },
      (error) => {
        window.alert(error instanceof Error ? error.message : '批注笔记失败')
      },
    )
  }, [createWorkspaceMemo])

  return (
    <>
      <SideBar
        activeDate={navigation.activeDate}
        dailyCounts={dailyCounts}
        displayName={
          homeMemoScope.kind === 'friend'
            ? friendDisplayName(homeMemoScope.targetFriend)
            : displayName
        }
        expandedTagTreeTags={expandedTagTreeTags}
        onClose={closeSidebar}
        onDeleteTag={handleDeleteTag}
        onExpandedTagTreeTagsChange={setExpandedTagTreeTags}
        onLogout={handleLogout}
        onSelectDate={navigation.selectDate}
        onSelectFacet={navigation.selectFacet}
        onSelectTag={navigation.selectTag}
        onRenameTag={handleRenameTag}
        onShowAllNotes={navigation.showAllNotes}
        onShowTodayReview={navigation.showTodayReview}
        open={sidebarOpen}
        selectedFacet={navigation.selectedFacet}
        selectedTag={navigation.selectedTag}
        statItems={statItems}
        statsLoadFailed={activeStatsQuery.isError}
        statsLoading={activeStatsQuery.isPending}
        tagMenuEnabled={homeMemoScope.kind === 'self'}
        tagTreeInitialized={activeTagTreeQuery.isFetched}
        tagTreeLoadFailed={activeTagTreeQuery.isError}
        tagTreeLoading={activeTagTreeQuery.isPending}
        tagTreeNodes={tagTree.nodes}
        tagTreeUntaggedCount={tagTree.untaggedCount}
      />
      <TagPicker
        allowEmptyRemove={false}
        initialDraft={renamingTag ?? ''}
        mode="update"
        onApply={handleRenameTagApply}
        onOpenChange={handleRenameTagOpenChange}
        open={Boolean(renamingTag)}
        selectedTags={renamingTag ? [renamingTag] : []}
        tagOptions={tagOptions}
        targetTag={renamingTag ?? ''}
      />
      <WorkspaceMemoDetailDialog
        memo={detailMemo}
        memos={memoCards}
        onOpenChange={handleMemoDetailOpenChange}
        open={detailMemo !== null}
        referencePreviewResolver={referencePreviewResolver}
        tagOptions={tagOptions}
      />
      <WorkspaceMemoQuoteDialog
        memo={quoteMemo}
        onOpenChange={handleMemoQuoteOpenChange}
        onSave={handleMemoQuoteSave}
        open={quoteMemo !== null}
        tagOptions={tagOptions}
      />
      <TopBar
        className="workspace-top-bar"
        leftSlot={
          <>
            <GlassIconButton
              aria-label="打开侧栏"
              className="md:hidden"
              onClick={openSidebar}
            >
              <PanelLeft />
            </GlassIconButton>
            {navigation.selectedTag ? (
              <TagBread
                aria-label="当前标签"
                tag={formatTagBreadTag(navigation.selectedTag)}
                onSelect={navigation.selectTag}
              />
            ) : null}
          </>
        }
        rightSlot={
          <>
            <GlassIconButton aria-label="搜索">
              <Search />
            </GlassIconButton>
            {homeMemoScope.kind === 'self' ? (
              <GlassIconButton
                aria-label="新建笔记"
                disabled={Boolean(memoCreate.pendingCreate) || memoCreate.isPending}
                onClick={memoCreate.start}
              >
                <Plus />
              </GlassIconButton>
            ) : null}
            <WorkspaceTitleMenu
              canViewFriendMemos={canViewFriendMemos}
              homeMemoScope={homeMemoScope.kind}
              memoCreatedAtSort={navigation.memoCreatedAtSort}
              onMemoCreatedAtSortChange={navigation.setMemoCreatedAtSort}
              onViewFriendMemos={handleViewFriendMemos}
              onViewMyMemos={handleViewMyMemos}
              onRefresh={handleTitleRefresh}
              selectedTag={navigation.selectedTag}
            />
          </>
        }
      />
      <main className="app-shell">
        <WorkspaceFilterBar
          activeDate={navigation.activeDate}
          onClearDate={navigation.clearDateFilter}
          onClearFacet={navigation.clearFacetFilter}
          selectedFacet={navigation.selectedFacet}
        />
        <div className="app-shell__layout">
          <div aria-hidden="true" className="app-shell__sidebar-space" />
          <div className="app-shell__content">
            {activeMemoListQuery.isPending && !hasVisibleMemoCards ? (
              <MemoListSkeleton />
            ) : null}

            {activeMemoListQuery.isError && !hasVisibleMemoCards ? (
              <section className="memo-list-state" role="status">
                <p className="memo-list-state__title">笔记列表加载失败</p>
                <p className="memo-list-state__body">请稍后重新加载。</p>
                <Button
                  className="memo-list-state__action"
                  onClick={() => void activeMemoListQuery.refetch()}
                  size="sm"
                  variant="outline"
                >
                  重新加载
                </Button>
              </section>
            ) : null}

            {!activeMemoListQuery.isPending &&
            !activeMemoListQuery.isError &&
            !hasVisibleMemoCards ? (
              <section className="memo-list-state" role="status">
                <p className="memo-list-state__title">暂无笔记</p>
                <p className="memo-list-state__body">登录账号下还没有可展示的笔记。</p>
              </section>
            ) : null}

            {hasVisibleMemoCards ? (
              <>
                {memoCreate.pendingCreate && memoCreate.pendingCreateNote ? (
                  <PendingCreateCard
                    key={memoCreate.pendingCreate.clientId}
                    clientId={memoCreate.pendingCreate.clientId}
                    isClosing={memoCreate.pendingCreate.status === 'closing'}
                    initialMode={
                      memoCreate.pendingCreate.status === 'editing' ||
                      memoCreate.pendingCreate.status === 'closing'
                        ? 'edit'
                        : 'view'
                    }
                    note={memoCreate.pendingCreateNote}
                    onCancel={memoCreate.cancel}
                    onExitAnimationEnd={memoCreate.finishExitAnimation}
                    onSave={memoCreate.save}
                    onViewTransitionEnd={memoCreate.finishViewTransition}
                    onTagClick={navigation.selectTag}
                    tagOptions={tagOptions}
                  />
                ) : null}
                {memoCards.map((memo) => {
                  const referencePreviews = buildMemoReferencePreviews(
                    memo,
                    referencePreviewResolver,
                  )

                  return (
                    <RefCard
                      key={memo.id}
                      disabled={homeMemoScope.kind === 'friend'}
                      note={toCardNote(memo)}
                      onCopySelect={() => handleMemoCopy(memo)}
                      onDelete={homeMemoScope.kind === 'self' ? () => handleMemoDelete(memo) : undefined}
                      onQuoteSelect={homeMemoScope.kind === 'self' ? () => setQuoteMemoId(memo.id) : undefined}
                      onSave={homeMemoScope.kind === 'self' ? (draft) => handleMemoSave(memo, draft) : undefined}
                      onReferenceClick={() => setDetailMemoId(memo.id)}
                      onTagClick={navigation.selectTag}
                      referencePreview={referencePreviews.referencePreview}
                      referencedByPreviews={referencePreviews.referencedByPreviews}
                      tagOptions={tagOptions}
                    />
                  )
                })}
                {hasNextPage && !isFetchNextPageError ? (
                  <div
                    aria-hidden="true"
                    className="memo-list-load-more-sentinel"
                    ref={loadMoreSentinelRef}
                  />
                ) : null}
                {isFetchingNextPage ||
                isFetchNextPageError ||
                (!hasNextPage && totalMemoCount > 0) ? (
                  <div className="memo-list-footer" role="status">
                    {isFetchingNextPage ? (
                      <span>正在加载更多笔记...</span>
                    ) : null}
                    {isFetchNextPageError ? (
                      <Button
                        className="memo-list-footer__action"
                        onClick={() => void fetchNextPage()}
                        size="sm"
                        variant="outline"
                      >
                        重试加载更多
                      </Button>
                    ) : null}
                    {!hasNextPage && totalMemoCount > 0 ? (
                      <span>已加载全部笔记</span>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}
