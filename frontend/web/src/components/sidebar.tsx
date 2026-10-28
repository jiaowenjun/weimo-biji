import type { HeatmapDailyCount } from 'weimo-ui-stats/components/heatmap'
import type { StatGroupItem } from 'weimo-ui-stats/components/stat-group'
import type { TagTreeNode } from 'weimo-ui-tagtree/components/tag-tree'

import { BijiSideBar } from '@/components/biji-side-bar'

type SideBarProps = {
  activeDate: string
  dailyCounts: HeatmapDailyCount[]
  displayName: string
  expandedTagTreeTags: string[]
  onClose: () => void
  onDeleteTag: (tag: string) => void
  onExpandedTagTreeTagsChange: (tags: string[]) => void
  onLogout: () => void
  onSelectDate: (date: string) => void
  onSelectFacet: (facet: string) => void
  onSelectTag: (tag: string) => void
  onRenameTag: (tag: string) => void
  onShowAllNotes: () => void
  onShowTodayReview: () => void
  selectedFacet: string
  selectedTag: string
  statItems: StatGroupItem[]
  statsLoadFailed: boolean
  statsLoading: boolean
  tagMenuEnabled?: boolean
  tagTreeInitialized: boolean
  tagTreeLoadFailed: boolean
  tagTreeLoading: boolean
  tagTreeNodes: TagTreeNode[]
  tagTreeUntaggedCount: number
}

/**
 * 工作区侧边栏适配器：抽屉面板由 SiteTemplate 的 sidebar 插槽提供，
 * 这里负责把每个选中回调包上一层 onClose，保持窄屏抽屉选中即收起。
 */
export function SideBar({
  activeDate,
  dailyCounts,
  displayName,
  expandedTagTreeTags,
  onClose,
  onDeleteTag,
  onExpandedTagTreeTagsChange,
  onLogout,
  onSelectDate,
  onSelectFacet,
  onSelectTag,
  onRenameTag,
  onShowAllNotes,
  onShowTodayReview,
  selectedFacet,
  selectedTag,
  statItems,
  statsLoadFailed,
  statsLoading,
  tagMenuEnabled,
  tagTreeInitialized,
  tagTreeLoadFailed,
  tagTreeLoading,
  tagTreeNodes,
  tagTreeUntaggedCount,
}: SideBarProps) {
  function handleShowAllNotes() {
    onShowAllNotes()
    onClose()
  }

  function handleShowTodayReview() {
    onShowTodayReview()
    onClose()
  }

  function handleSelectDate(date: string) {
    onSelectDate(date)
    onClose()
  }

  function handleSelectFacet(facet: string) {
    onSelectFacet(facet)
    onClose()
  }

  function handleSelectTag(tag: string) {
    onSelectTag(tag)
    onClose()
  }

  function handleRenameTag(tag: string) {
    onClose()
    onRenameTag(tag)
  }

  function handleDeleteTag(tag: string) {
    onClose()
    onDeleteTag(tag)
  }

  return (
    <BijiSideBar
      activeDate={activeDate}
      dailyCounts={dailyCounts}
      displayName={displayName}
      expandedTagTreeTags={expandedTagTreeTags}
      onDeleteTag={handleDeleteTag}
      onExpandedTagTreeTagsChange={onExpandedTagTreeTagsChange}
      onLogout={onLogout}
      onSelectDate={handleSelectDate}
      onSelectFacet={handleSelectFacet}
      onSelectTag={handleSelectTag}
      onRenameTag={handleRenameTag}
      onShowAllNotes={handleShowAllNotes}
      onShowTodayReview={handleShowTodayReview}
      selectedFacet={selectedFacet}
      selectedTag={selectedTag}
      statItems={statItems}
      statsLoadFailed={statsLoadFailed}
      statsLoading={statsLoading}
      tagMenuEnabled={tagMenuEnabled}
      tagTreeInitialized={tagTreeInitialized}
      tagTreeLoadFailed={tagTreeLoadFailed}
      tagTreeLoading={tagTreeLoading}
      tagTreeNodes={tagTreeNodes}
      tagTreeUntaggedCount={tagTreeUntaggedCount}
    />
  )
}
