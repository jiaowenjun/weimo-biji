import { useState } from 'react'
import {
  Bell,
  CalendarDays,
  Grid2X2,
  Hash,
  Heading1,
  List,
  LogOut,
  MessageSquareText,
  Quote,
  Settings,
} from 'lucide-react'

import { GhostIconButton } from 'weimo-ui/components/ghost-icon-button'
import { Heatmap, type HeatmapDailyCount } from 'weimo-ui/components/heatmap'
import { StatGroup, type StatGroupItem } from 'weimo-ui/components/stat-group'
import { TagTree, type TagTreeMenuAction, type TagTreeNode } from 'weimo-ui/components/tag-tree'

import './biji-side-bar.css'

const allNotesNavTag = 'nav/all-notes'
const todayReviewNavTag = 'nav/today-review'
const facetNavTagPrefix = 'nav/all-notes/'

const sampleNavNodes: TagTreeNode[] = [
  {
    tag: allNotesNavTag,
    label: '全部笔记',
    icon: <Grid2X2 aria-hidden="true" />,
    children: [
      {
        tag: `${facetNavTagPrefix}annotation`,
        label: '有批注',
        icon: <MessageSquareText aria-hidden="true" />,
      },
      {
        tag: `${facetNavTagPrefix}heading`,
        label: '有标题',
        icon: <Heading1 aria-hidden="true" />,
      },
      {
        tag: `${facetNavTagPrefix}unordered-list`,
        label: '有列表',
        icon: <List aria-hidden="true" />,
      },
      {
        tag: `${facetNavTagPrefix}markdown-quote`,
        label: '有引用',
        icon: <Quote aria-hidden="true" />,
      },
    ],
  },
  {
    tag: todayReviewNavTag,
    label: '今日回顾',
    icon: <CalendarDays aria-hidden="true" />,
  },
]

type BijiSideBarProps = {
  activeDate: string
  dailyCounts: HeatmapDailyCount[]
  displayName: string
  expandedTagTreeTags: string[]
  onLogout: () => void
  onDeleteTag: (tag: string) => void
  onExpandedTagTreeTagsChange: (tags: string[]) => void
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

export function BijiSideBar({
  activeDate,
  dailyCounts,
  displayName,
  expandedTagTreeTags,
  onLogout,
  onDeleteTag,
  onExpandedTagTreeTagsChange,
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
  tagMenuEnabled = true,
  tagTreeInitialized,
  tagTreeLoadFailed,
  tagTreeLoading,
  tagTreeNodes,
  tagTreeUntaggedCount,
}: BijiSideBarProps) {
  const [navExpandedTags, setNavExpandedTags] = useState<string[]>([])
  const [lastMenuAction, setLastMenuAction] = useState('')
  const showStatsLoading = statsLoading && statItems.length === 0
  const showStatsError = statsLoadFailed && statItems.length === 0
  const showTagTreeLoading = tagTreeLoading && !tagTreeInitialized
  const showTagTreeError = tagTreeLoadFailed && tagTreeNodes.length === 0
  const allNotesSelected = !selectedTag && !activeDate && selectedFacet === 'none'
  const selectedNavTag = activeDate && !selectedTag
    ? todayReviewNavTag
    : selectedFacet !== 'none'
      ? `${facetNavTagPrefix}${selectedFacet}`
      : allNotesSelected
        ? allNotesNavTag
        : undefined

  function clearToAllNotes() {
    onShowAllNotes()
  }

  function handleFacetSelect(facet: string) {
    onSelectFacet(facet)
  }

  function handleTodayReview() {
    onShowTodayReview()
  }

  function handleNavSelect(tag: string) {
    if (tag === allNotesNavTag) {
      clearToAllNotes()
      return
    }

    if (tag === todayReviewNavTag) {
      handleTodayReview()
      return
    }

    if (tag.startsWith(facetNavTagPrefix)) {
      handleFacetSelect(tag.slice(facetNavTagPrefix.length))
    }
  }

  function handleTagSelect(tag: string) {
    onSelectTag(tag)
  }

  function handleTagMenuAction(action: TagTreeMenuAction, tag: string) {
    setLastMenuAction(`${action}:${tag}`)
    if (action === 'rename') {
      onRenameTag(tag)
    }
    if (action === 'delete') {
      onDeleteTag(tag)
    }
  }

  return (
    <div className="biji-side-bar" data-last-menu-action={lastMenuAction || undefined}>
      <header className="biji-side-bar__header">
        <div className="biji-side-bar__identity">{displayName}</div>
        <div className="biji-side-bar__header-actions">
          <GhostIconButton
            aria-label="打开通知"
            className="biji-side-bar__header-button"
            size="sm"
          >
            <Bell aria-hidden="true" />
          </GhostIconButton>
          <GhostIconButton
            aria-label="打开设置"
            className="biji-side-bar__header-button"
            size="sm"
          >
            <Settings aria-hidden="true" />
          </GhostIconButton>
          <GhostIconButton
            aria-label="退出登录"
            className="biji-side-bar__header-button"
            onClick={onLogout}
            size="sm"
          >
            <LogOut aria-hidden="true" />
          </GhostIconButton>
        </div>
      </header>

      <div className="biji-side-bar__body">
        <section className="biji-side-bar__stats" aria-label="笔记统计">
          {showStatsLoading ? (
            <div className="biji-side-bar__status" role="status">
              统计加载中...
            </div>
          ) : showStatsError ? (
            <div className="biji-side-bar__status" role="status">
              统计加载失败
            </div>
          ) : (
            <>
              <StatGroup items={statItems} />
              <Heatmap
                activeDate={activeDate}
                dailyCounts={dailyCounts}
                onDateSelect={(date) => onSelectDate(date)}
              />
            </>
          )}
        </section>

        <nav className="biji-side-bar__nav" aria-label="笔记范围">
          <TagTree
            aria-label="笔记范围"
            expandedTags={navExpandedTags}
            nodes={sampleNavNodes}
            onExpandedTagsChange={setNavExpandedTags}
            onSelect={handleNavSelect}
            selectedTag={selectedNavTag}
            variant="no-action"
          />
        </nav>

        <section
          className="biji-side-bar__tags"
          aria-label={`标签，未标签 ${tagTreeUntaggedCount} 条`}
        >
          <div className="biji-side-bar__section-hint">标签</div>
          {showTagTreeLoading ? (
            <div className="biji-side-bar__status" role="status">
              标签加载中...
            </div>
          ) : showTagTreeError ? (
            <div className="biji-side-bar__status" role="status">
              标签加载失败
            </div>
          ) : (
            <TagTree
              defaultIcon={<Hash aria-hidden="true" />}
              expandedTags={expandedTagTreeTags}
              nodes={tagTreeNodes}
              onExpandedTagsChange={onExpandedTagTreeTagsChange}
              onMenuAction={tagMenuEnabled ? handleTagMenuAction : undefined}
              onSelect={handleTagSelect}
              selectedTag={selectedTag}
            />
          )}
        </section>
      </div>
    </div>
  )
}
