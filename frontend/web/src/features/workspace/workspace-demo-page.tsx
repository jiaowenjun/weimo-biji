import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { isWdfDocumentEmpty } from 'weimo-ui-editor/components/card-composer'
import { toMarkdown } from 'weimo-wdf/markdown'
import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'
import { TagPicker } from 'weimo-ui/components/tag-picker'
import { useInfiniteListSentinel } from 'weimo-ui/lib/use-infinite-list-sentinel'

import type { CardDraft } from '@/components/note-card'
import { RefCard } from '@/components/ref-card'
import { SideBar } from '@/components/sidebar'
import { TagBread } from 'weimo-ui-tagtree/components/tag-bread'
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
  formatWorkspacePageTitle,
  toHeatmapDailyCounts,
  toSidebarTagTree,
  toTagOptions,
} from '@/features/workspace/sidebar-data'
import {
  clearWorkspaceQueries,
  getWorkspaceQueryScope,
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
import { WorkspaceShell } from '@/features/workspace/workspace-shell'
import type { Memo } from '@/features/workspace/workspace-types'
import { useWorkspaceTagActions } from '@/features/workspace/workspace-tag-actions'
import { PendingCreateCard } from '@/features/workspace/pending-create-card'
import { useAuthenticatedMemoCreate } from './use-authenticated-memo-create'
import { WorkspaceMemoDetailDialog } from './workspace-memo-detail-dialog'
import { WorkspaceMemoQuoteDialog } from './workspace-memo-quote-dialog'
import { WorkspaceTitleMenu } from './workspace-title-menu'
import { copyMemoContentToClipboard } from './workspace-memo-copy'
import { runWorkspaceTitleRefreshActions } from './workspace-title-refresh'

const EMPTY_MEMO_CARDS: Memo[] = []

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
  const { filters: memoFilters, navigation } = useWorkspacePageNavigation()
  const memoListQuery = useMemoListQuery(memoFilters)
  const deleteMemoMutation = useDeleteMemoMutation()
  const updateMemoMutation = useUpdateMemoMutation()
  const memoCreate = useAuthenticatedMemoCreate(navigation.selectedTag)
  const {
    createMemo: createWorkspaceMemo,
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
  const {
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  } = memoListQuery
  const loadMoreSentinelRef = useInfiniteListSentinel({
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  const rawMemoCards = memoListQuery.data?.items ?? EMPTY_MEMO_CARDS
  const totalMemoCount = memoListQuery.data?.totalCount ?? 0
  const workspaceQueryScope = getWorkspaceQueryScope(user)
  const {
    clear: clearMemoDisplayOverrides,
    displayedMemos: memoCards,
    remove: removeMemoDisplayOverride,
    track: trackMemoDisplayOverride,
  } = useMemoDisplayOverrides(rawMemoCards, `self:${workspaceQueryScope}`)
  const memoById = useMemo(
    () => new Map(memoCards.map((memo) => [memo.id, memo])),
    [memoCards],
  )
  const detailMemo = detailMemoId === null ? null : (memoById.get(detailMemoId) ?? null)
  const quoteMemo = quoteMemoId === null ? null : (memoById.get(quoteMemoId) ?? null)
  const memoCacheOwner = useMemo<WorkspaceMemoCacheOwner>(
    () => ({ kind: 'self', scope: workspaceQueryScope }),
    [workspaceQueryScope],
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
        summaryCache: workspaceMemoCacheIndex.getSummaryCache(),
      }),
    [memoById, workspaceMemoCacheIndex],
  )
  const memoListHasData = memoCards.length > 0
  const hasVisibleMemoCards = memoListHasData || Boolean(memoCreate.pendingCreate)

  const tagOptions = useMemo(
    () => {
      const treeTagOptions = toTagOptions(tagTreeQuery.data)
      const memoTagOptions = memoCards.flatMap((memo) => memo.tags)

      return Array.from(new Set([...treeTagOptions, ...memoTagOptions]))
    },
    [tagTreeQuery.data, memoCards],
  )

  const statItems = useMemo(
    () => buildSidebarStatItems(statsQuery.data),
    [statsQuery.data],
  )
  const dailyCounts = useMemo(
    () =>
      statsQuery.data
        ? toHeatmapDailyCounts(statsQuery.data.daily_note_count)
        : [],
    [statsQuery.data],
  )
  const tagTree = useMemo(
    () => toSidebarTagTree(tagTreeQuery.data),
    [tagTreeQuery.data],
  )

  const handleLogout = useCallback(() => {
    clearWorkspaceQueries(queryClient)
    resetWorkspaceNavigation()
    logout()
  }, [logout, queryClient])

  const handleTitleRefresh = useCallback(() => {
    clearMemoDisplayOverrides()
    void runWorkspaceTitleRefreshActions({
      refreshMemoList: () => memoListQuery.refetch(),
      refreshStats: () => statsQuery.refetch(),
      refreshTagTree: () => tagTreeQuery.refetch(),
    })
  }, [
    clearMemoDisplayOverrides,
    memoListQuery,
    statsQuery,
    tagTreeQuery,
  ])

  const handleMemoSave = useCallback((memo: Memo, draft: CardDraft) => {
    const content = draft.content
    if (isWdfDocumentEmpty(content)) return
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
    void copyMemoContentToClipboard(toMarkdown(memo.content)).catch(() => {
      window.alert('复制失败')
    })
  }, [])

  const handleMemoQuoteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setQuoteMemoId(null)
    }
  }, [])

  const handleMemoQuoteSave = useCallback((memo: Memo, draft: CardDraft) => {
    const content = draft.content
    if (isWdfDocumentEmpty(content)) return
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
      <WorkspaceShell
        pageTitle={formatWorkspacePageTitle(navigation)}
        sidebar={(api) => (
          <SideBar
            activeDate={navigation.activeDate}
            dailyCounts={dailyCounts}
            displayName={displayName}
            expandedTagTreeTags={expandedTagTreeTags}
            onClose={api.close}
            onDeleteTag={handleDeleteTag}
            onExpandedTagTreeTagsChange={setExpandedTagTreeTags}
            onLogout={handleLogout}
            onSelectDate={navigation.selectDate}
            onSelectFacet={navigation.selectFacet}
            onSelectTag={navigation.selectTag}
            onRenameTag={handleRenameTag}
            onShowAllNotes={navigation.showAllNotes}
            onShowTodayReview={navigation.showTodayReview}
            selectedFacet={navigation.selectedFacet}
            selectedTag={navigation.selectedTag}
            statItems={statItems}
            statsLoadFailed={statsQuery.isError}
            statsLoading={statsQuery.isPending}
            tagMenuEnabled
            tagTreeInitialized={tagTreeQuery.isFetched}
            tagTreeLoadFailed={tagTreeQuery.isError}
            tagTreeLoading={tagTreeQuery.isPending}
            tagTreeNodes={tagTree.nodes}
            tagTreeUntaggedCount={tagTree.untaggedCount}
          />
        )}
        topBarActions={
          <>
            <GlassIconButton aria-label="搜索">
              <Search />
            </GlassIconButton>
            <GlassIconButton
              aria-label="新建笔记"
              disabled={Boolean(memoCreate.pendingCreate) || memoCreate.isPending}
              onClick={memoCreate.start}
            >
              <Plus />
            </GlassIconButton>
            <WorkspaceTitleMenu
              memoCreatedAtSort={navigation.memoCreatedAtSort}
              onMemoCreatedAtSortChange={navigation.setMemoCreatedAtSort}
              onRefresh={handleTitleRefresh}
              selectedTag={navigation.selectedTag}
            />
          </>
        }
        topBarLeading={
          navigation.selectedTag ? (
            <TagBread
              aria-label="当前标签"
              tag={formatTagBreadTag(navigation.selectedTag)}
              onSelect={navigation.selectTag}
            />
          ) : undefined
        }
      >
        <WorkspaceFilterBar
          activeDate={navigation.activeDate}
          onClearDate={navigation.clearDateFilter}
          onClearFacet={navigation.clearFacetFilter}
          selectedFacet={navigation.selectedFacet}
        />
        {memoListQuery.isPending && !hasVisibleMemoCards ? (
          <MemoListSkeleton />
        ) : null}

        {memoListQuery.isError && !hasVisibleMemoCards ? (
          <section className="memo-list-state" role="status">
            <p className="memo-list-state__title">笔记列表加载失败</p>
            <p className="memo-list-state__body">请稍后重新加载。</p>
            <Button
              className="memo-list-state__action"
              onClick={() => void memoListQuery.refetch()}
              size="sm"
              variant="outline"
            >
              重新加载
            </Button>
          </section>
        ) : null}

        {!memoListQuery.isPending &&
        !memoListQuery.isError &&
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
                  note={toCardNote(memo)}
                  onCopySelect={() => handleMemoCopy(memo)}
                  onDelete={() => handleMemoDelete(memo)}
                  onQuoteSelect={() => setQuoteMemoId(memo.id)}
                  onSave={(draft) => handleMemoSave(memo, draft)}
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
      </WorkspaceShell>
    </>
  )
}
