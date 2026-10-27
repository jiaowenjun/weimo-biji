import type { PopoverMenuItem } from '../components/weimo-popover-menu/index'

export type MemoCardPopoverMode = 'card' | 'tag'

export interface MemoCardMenuOpenDetail {
  memoId: number
  mode: MemoCardPopoverMode
  tag?: string
  triggerRect: WechatMiniprogram.BoundingClientRectCallbackResult
  items: PopoverMenuItem[]
  estimatedHeight: number
  placementPriority: string
  horizontalAlign: string
  scaleAnchor: string
  header: string
}

export interface MemoListSingletonMenuData {
  cardMenuActive: boolean
  singletonMenuActive: boolean
  singletonMenuMemoId: number
  singletonMenuMode: MemoCardPopoverMode
  singletonMenuTag: string
  singletonMenuAnchorRect: WechatMiniprogram.BoundingClientRectCallbackResult | null
  singletonMenuItems: PopoverMenuItem[]
  singletonMenuEstimatedHeight: number
  singletonMenuPlacementPriority: string
  singletonMenuHorizontalAlign: string
  singletonMenuScaleAnchor: string
  singletonMenuHeader: string
}

type MemoEvent<T extends WechatMiniprogram.IAnyObject> = WechatMiniprogram.CustomEvent<T>

interface MemoListSingletonMenuHost {
  data: MemoListSingletonMenuData
  setData: (patch: Partial<MemoListSingletonMenuData>) => void
  closeSingletonMenu: () => void
  onCardMenuActiveChange?: (active: boolean) => void
  handleMemoEdit: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoQuote: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoReferenceTap: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoDelete: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoModifyTag: (
    event: MemoEvent<{ memoId: number; tag: string; allowMultiTag?: boolean }>,
  ) => void
  handleMemoTagAdd: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoTagRemove: (event: MemoEvent<{ memoId: number; tag: string }>) => void
  handleMemoShare: (event: MemoEvent<{ memoId: number }>) => void
  handleMemoCopy: (event: MemoEvent<{ memoId: number }>) => void
}

const DEFAULT_MENU_ESTIMATED_HEIGHT_PX = 124

function eventOf<T extends WechatMiniprogram.IAnyObject>(detail: T): MemoEvent<T> {
  return { detail } as MemoEvent<T>
}

function syncCardMenuActive(this: MemoListSingletonMenuHost, active: boolean) {
  this.setData({ cardMenuActive: active })
  this.onCardMenuActiveChange?.(active)
}

export function createMemoListSingletonMenuData(): MemoListSingletonMenuData {
  return {
    cardMenuActive: false,
    singletonMenuActive: false,
    singletonMenuMemoId: 0,
    singletonMenuMode: 'card',
    singletonMenuTag: '',
    singletonMenuAnchorRect: null,
    singletonMenuItems: [],
    singletonMenuEstimatedHeight: DEFAULT_MENU_ESTIMATED_HEIGHT_PX,
    singletonMenuPlacementPriority: 'down-first',
    singletonMenuHorizontalAlign: 'end',
    singletonMenuScaleAnchor: 'end',
    singletonMenuHeader: '',
  }
}

export const memoListSingletonMenuMethods = {
  handleCardMenuChange(
    this: MemoListSingletonMenuHost,
    event: MemoEvent<{ active: boolean }>,
  ) {
    if (event.detail?.active === false) {
      this.closeSingletonMenu()
      return
    }
    syncCardMenuActive.call(this, true)
  },

  onCardMenuOpen(
    this: MemoListSingletonMenuHost,
    event: MemoEvent<MemoCardMenuOpenDetail>,
  ) {
    const detail = event.detail
    if (!detail || !detail.triggerRect) return
    this.setData({
      singletonMenuActive: true,
      singletonMenuMemoId: detail.memoId,
      singletonMenuMode: detail.mode,
      singletonMenuTag: detail.tag || '',
      singletonMenuAnchorRect: detail.triggerRect,
      singletonMenuItems: detail.items || [],
      singletonMenuEstimatedHeight: detail.estimatedHeight || DEFAULT_MENU_ESTIMATED_HEIGHT_PX,
      singletonMenuPlacementPriority: detail.placementPriority || 'down-first',
      singletonMenuHorizontalAlign: detail.horizontalAlign || 'end',
      singletonMenuScaleAnchor: detail.scaleAnchor || 'end',
      singletonMenuHeader: detail.header || '',
    })
    syncCardMenuActive.call(this, true)
  },

  closeSingletonMenu(this: MemoListSingletonMenuHost) {
    if (!this.data.singletonMenuActive && !this.data.cardMenuActive) return
    this.setData({
      singletonMenuActive: false,
    })
    syncCardMenuActive.call(this, false)
  },

  onSingletonMenuSelect(
    this: MemoListSingletonMenuHost,
    event: MemoEvent<{ id: string; item?: PopoverMenuItem }>,
  ) {
    const id = event.detail?.id || ''
    if (!id) return
    const item = ((this.data.singletonMenuItems as PopoverMenuItem[]) || []).find(
      (candidate) => candidate.id === id,
    )
    if (!item || item.disabled) return

    const memoId = this.data.singletonMenuMemoId

    if (this.data.singletonMenuMode === 'tag') {
      const tag = this.data.singletonMenuTag
      this.closeSingletonMenu()
      if (id === 'tag-edit') {
        if (!tag) return
        this.handleMemoModifyTag(eventOf({ memoId, tag, allowMultiTag: true }))
      } else if (id === 'tag-add') {
        this.handleMemoTagAdd(eventOf({ memoId }))
      } else if (id === 'tag-remove') {
        if (!tag) return
        this.handleMemoTagRemove(eventOf({ memoId, tag }))
      }
      return
    }

    this.closeSingletonMenu()
    if (id === 'edit') {
      this.handleMemoEdit(eventOf({ memoId }))
    } else if (id === 'quote') {
      this.handleMemoQuote(eventOf({ memoId }))
    } else if (id === 'memo-detail') {
      this.handleMemoReferenceTap(eventOf({ memoId }))
    } else if (id === 'delete') {
      this.handleMemoDelete(eventOf({ memoId }))
    } else if (id === 'share') {
      this.handleMemoShare(eventOf({ memoId }))
    } else if (id === 'copy') {
      this.handleMemoCopy(eventOf({ memoId }))
    }
  },
}

export type MemoListSingletonMenuMethods = typeof memoListSingletonMenuMethods

/**
 * Usage:
 * 1. Spread `createMemoListSingletonMenuData()` into page `data`.
 * 2. Spread `memoListSingletonMenuMethods` into the page object.
 * 3. Type the page object with `satisfies PageWithMemoListSingletonMenu<PageData, PageCustom>`.
 * This documents the page-mixin boundary without introducing a runtime wrapper.
 */
export type PageWithMemoListSingletonMenu<
  Data extends WechatMiniprogram.Page.DataOption,
  Custom extends WechatMiniprogram.Page.CustomOption,
> = WechatMiniprogram.Page.Options<
  Data & MemoListSingletonMenuData,
  Custom & MemoListSingletonMenuMethods
>
