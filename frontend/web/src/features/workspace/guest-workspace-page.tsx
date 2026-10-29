import { useCallback, useMemo, useState } from 'react'
import { buildGuestWorkspaceTagTree } from '@weimo/workspace-core/guest-workspace'
import { Plus, Search } from 'lucide-react'
import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'
import { isWdfDocumentEmpty } from 'weimo-ui-editor/components/card-composer'
import { toMarkdown } from 'weimo-wdf/markdown'
import { TagPicker } from '@/components/tag-picker'

import type { CardDraft } from '@/components/note-card'
import { RefCard } from '@/components/ref-card'
import { SideBar } from '@/components/sidebar'
import { TagBread } from 'weimo-ui-tagtree/components/tag-bread'
import { Button } from '@/components/ui/button'
import {
  buildMemoReferencePreviews,
  createMemoReferencePreviewResolver,
  toCardNote,
} from '@/features/workspace/memo-data'
import {
  buildSidebarStatItems,
  formatTagBreadTag,
  formatWorkspacePageTitle,
  toHeatmapDailyCounts,
  toSidebarTagTree,
  toTagOptions,
} from '@/features/workspace/sidebar-data'
import {
  resetWorkspaceNavigation,
} from '@/features/workspace/workspace-navigation-store'
import { useWorkspacePageNavigation } from '@/features/workspace/use-workspace-page-navigation'
import { WorkspaceFilterBar } from '@/features/workspace/workspace-filter-bar'
import { WorkspaceShell } from '@/features/workspace/workspace-shell'
import { PendingCreateCard } from './pending-create-card'
import { runWorkspaceTitleRefreshActions } from './workspace-title-refresh'
import {
  filterGuestMemos,
  guestMemoCards,
  guestStats,
  guestTagTree,
} from './guest-workspace-data'
import type { Memo, TagTreeMeta } from './workspace-types'
import { WorkspaceMemoDetailDialog } from './workspace-memo-detail-dialog'
import { WorkspaceMemoQuoteDialog } from './workspace-memo-quote-dialog'
import { WorkspaceTitleMenu } from './workspace-title-menu'
import { copyMemoContentToClipboard } from './workspace-memo-copy'
import { useGuestMemoCreate } from './use-guest-memo-create'
import { useGuestWorkspaceTagActions } from './use-guest-workspace-tag-actions'

function createGuestMemoId(memos: Memo[]) {
  return memos.reduce((maxId, memo) => Math.max(maxId, memo.id), 0) + 1
}

export function GuestWorkspacePage() {
  const { filters: memoFilters, navigation } = useWorkspacePageNavigation()
  const [memos, setMemos] = useState<Memo[]>(guestMemoCards)
  const memoCreate = useGuestMemoCreate({
    memos,
    selectedTag: navigation.selectedTag,
    setMemos,
  })
  const [tagTreeMeta, setTagTreeMeta] = useState<TagTreeMeta>(guestTagTree)
  const liveTagTreeMeta = useMemo(
    () => buildGuestWorkspaceTagTree(memos, toTagOptions(tagTreeMeta)),
    [memos, tagTreeMeta],
  )
  const {
    expandedTags: expandedTagTreeTags,
    handleDeleteTag,
    handleRenameTag,
    handleRenameTagApply,
    handleRenameTagOpenChange,
    renamingTag,
    setExpandedTags: setExpandedTagTreeTags,
  } = useGuestWorkspaceTagActions({
    memos,
    selectTag: navigation.selectTag,
    selectedTag: navigation.selectedTag,
    setMemos,
    setTagTreeMeta,
    tagTreeMeta: liveTagTreeMeta,
  })
  const [detailMemoId, setDetailMemoId] = useState<number | null>(null)
  const [quoteMemoId, setQuoteMemoId] = useState<number | null>(null)

  const memoCards = useMemo(
    () => filterGuestMemos(memos, memoFilters),
    [memoFilters, memos],
  )
  const memoById = useMemo(
    () => new Map(memos.map((memo) => [memo.id, memo])),
    [memos],
  )
  const detailMemo = detailMemoId === null ? null : (memoById.get(detailMemoId) ?? null)
  const quoteMemo = quoteMemoId === null ? null : (memoById.get(quoteMemoId) ?? null)
  const referencePreviewResolver = useMemo(
    () =>
      createMemoReferencePreviewResolver({
        getMemoById: (id) => memoById.get(id),
      }),
    [memoById],
  )
  const memoListHasData = memoCards.length > 0
  const hasVisibleMemoCards = memoListHasData || Boolean(memoCreate.pendingCreate)
  const tagOptions = useMemo(
    () => {
      const treeTagOptions = toTagOptions(liveTagTreeMeta)
      const memoTagOptions = memos.flatMap((memo) => memo.tags)

      return Array.from(new Set([...treeTagOptions, ...memoTagOptions]))
    },
    [liveTagTreeMeta, memos],
  )
  const statItems = useMemo(
    () => buildSidebarStatItems(guestStats),
    [],
  )
  const dailyCounts = useMemo(
    () => toHeatmapDailyCounts(guestStats.daily_note_count),
    [],
  )
  const tagTree = useMemo(
    () => toSidebarTagTree(liveTagTreeMeta),
    [liveTagTreeMeta],
  )

  const handleGuestExit = useCallback(() => {
    resetWorkspaceNavigation()
    window.location.assign('/')
  }, [])

  const handleTitleRefresh = useCallback(() => {
    void runWorkspaceTitleRefreshActions({
      refreshMemoList: () => {
        setMemos(guestMemoCards)
      },
      refreshStats: () => {},
      refreshTagTree: () => {
        setTagTreeMeta(guestTagTree)
        setExpandedTagTreeTags([])
      },
    })
  }, [setExpandedTagTreeTags])

  const handleMemoSave = useCallback((memo: Memo, draft: CardDraft) => {
    const content = draft.content
    if (isWdfDocumentEmpty(content)) return
    const tags = [...draft.tags]

    setMemos((currentMemos) =>
      currentMemos.map((currentMemo) =>
        currentMemo.id === memo.id
          ? {
              ...currentMemo,
              content,
              tags,
              updatedAt: new Date().toISOString(),
            }
          : currentMemo,
      ),
    )
  }, [])

  const handleMemoDelete = useCallback((memo: Memo) => {
    if (!window.confirm('确定删除这条笔记吗？删除后不可恢复。')) return

    setMemos((currentMemos) =>
      currentMemos.filter((currentMemo) => currentMemo.id !== memo.id),
    )
  }, [])

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
    const now = new Date().toISOString()
    const quotedMemoRef = String(memo.id)
    const createdMemo: Memo = {
      id: createGuestMemoId(memos),
      content,
      tags,
      createdAt: now,
      updatedAt: now,
      refs: [quotedMemoRef],
      referencedBy: [],
    }

    setMemos((currentMemos) => [
      createdMemo,
      ...currentMemos.map((currentMemo) =>
        currentMemo.id === memo.id
          ? {
              ...currentMemo,
              referencedBy: Array.from(
                new Set([...currentMemo.referencedBy, String(createdMemo.id)]),
              ),
            }
          : currentMemo,
      ),
    ])
    setQuoteMemoId(null)
  }, [memos])

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
        memos={memos}
        onOpenChange={handleMemoDetailOpenChange}
        open={detailMemo !== null}
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
            displayName="游客模式"
            expandedTagTreeTags={expandedTagTreeTags}
            onClose={api.close}
            onDeleteTag={handleDeleteTag}
            onExpandedTagTreeTagsChange={setExpandedTagTreeTags}
            onLogout={handleGuestExit}
            onSelectDate={navigation.selectDate}
            onSelectFacet={navigation.selectFacet}
            onSelectTag={navigation.selectTag}
            onRenameTag={handleRenameTag}
            onShowAllNotes={navigation.showAllNotes}
            onShowTodayReview={navigation.showTodayReview}
            selectedFacet={navigation.selectedFacet}
            selectedTag={navigation.selectedTag}
            statItems={statItems}
            statsLoadFailed={false}
            statsLoading={false}
            tagTreeInitialized
            tagTreeLoadFailed={false}
            tagTreeLoading={false}
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
              disabled={Boolean(memoCreate.pendingCreate)}
              onClick={memoCreate.start}
            >
              <Plus />
            </GlassIconButton>
            <WorkspaceTitleMenu
              memoCreatedAtSort={navigation.memoCreatedAtSort}
              onMemoCreatedAtSortChange={navigation.setMemoCreatedAtSort}
              onRefresh={handleTitleRefresh}
              selectedTag={navigation.selectedTag}
              showGuestAuthAction
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
        {!hasVisibleMemoCards ? (
          <section className="memo-list-state" role="status">
            <p className="memo-list-state__title">暂无匹配笔记</p>
            <p className="memo-list-state__body">
              当前游客示例数据没有符合筛选条件的笔记。
            </p>
            <Button
              className="memo-list-state__action"
              onClick={navigation.showAllNotes}
              size="sm"
              variant="outline"
            >
              查看全部
            </Button>
          </section>
        ) : (
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
                  onReferenceClick={() => setDetailMemoId(memo.id)}
                  onSave={(draft) => handleMemoSave(memo, draft)}
                  onTagClick={navigation.selectTag}
                  referencePreview={referencePreviews.referencePreview}
                  referencedByPreviews={referencePreviews.referencedByPreviews}
                  tagOptions={tagOptions}
                />
              )
            })}
            <p className="memo-list-footer">
              游客模式 · 已显示 {memoCards.length} 条示例笔记
            </p>
          </>
        )}
      </WorkspaceShell>
    </>
  )
}
