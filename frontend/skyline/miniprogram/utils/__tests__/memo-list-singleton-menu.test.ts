import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  createMemoListSingletonMenuData,
  memoListSingletonMenuMethods,
} from '../memo-list-singleton-menu'

const miniprogramRoot = path.join(__dirname, '..', '..')

function createHost(overrides: Record<string, unknown> = {}) {
  const data = {
    ...createMemoListSingletonMenuData(),
    ...overrides,
  }
  const host: any = {
    data,
    setData(patch: Record<string, unknown>) {
      this.data = { ...this.data, ...patch }
    },
    closeSingletonMenu: memoListSingletonMenuMethods.closeSingletonMenu,
    handleMemoEdit: vi.fn(),
    handleMemoQuote: vi.fn(),
    handleMemoReferenceTap: vi.fn(),
    handleMemoDelete: vi.fn(),
    handleMemoModifyTag: vi.fn(),
    handleMemoTagAdd: vi.fn(),
    handleMemoTagRemove: vi.fn(),
    handleMemoShare: vi.fn(),
    handleMemoCopy: vi.fn(),
    onCardMenuActiveChange: vi.fn(),
  }
  Object.assign(host, memoListSingletonMenuMethods)
  return host
}

describe('memo-list-singleton-menu methods', () => {
  it('notifies the host when a shared card menu opens', () => {
    const host = createHost()
    const rect = { top: 20, right: 340, bottom: 56, left: 304, width: 36, height: 36 }

    host.onCardMenuOpen({
      detail: {
        memoId: 7,
        ownerUsername: 'alice',
        mode: 'card',
        triggerRect: rect,
        items: [{ id: 'edit', label: '编辑' }],
        estimatedHeight: 124,
        placementPriority: 'down-first',
        horizontalAlign: 'end',
        scaleAnchor: 'end',
        header: '',
      },
    })

    expect(host.data.singletonMenuActive).toBe(true)
    expect(host.data.cardMenuActive).toBe(true)
    expect(host.onCardMenuActiveChange).toHaveBeenCalledWith(true)
  })

  it('notifies the host when the shared card menu closes', () => {
    const host = createHost({
      singletonMenuActive: true,
      cardMenuActive: true,
    })

    host.closeSingletonMenu()

    expect(host.data.singletonMenuActive).toBe(false)
    expect(host.data.cardMenuActive).toBe(false)
    expect(host.onCardMenuActiveChange).toHaveBeenCalledWith(false)
  })

  it('routes copy from the shared card menu to the host copy handler', () => {
    const host = createHost({
      singletonMenuActive: true,
      singletonMenuMemoId: 17,
      singletonMenuOwnerUsername: 'alice',
      singletonMenuMode: 'card',
      singletonMenuItems: [{ id: 'copy', label: '复制', icon: 'copy' }],
    })

    host.onSingletonMenuSelect({
      detail: {
        id: 'copy',
        item: { id: 'copy', label: '复制', icon: 'copy' },
      },
    })

    expect(host.handleMemoCopy).toHaveBeenCalledWith({
      detail: { memoId: 17, ownerUsername: 'alice' },
    })
    expect(host.data.singletonMenuActive).toBe(false)
  })

  it('documents the page type alias used by home and search pages', () => {
    const helperTs = fs.readFileSync(
      path.join(miniprogramRoot, 'utils/memo-list-singleton-menu.ts'),
      'utf8',
    )
    const indexTs = fs.readFileSync(path.join(miniprogramRoot, 'pages/index/index.ts'), 'utf8')
    const searchTs = fs.readFileSync(path.join(miniprogramRoot, 'pages/search/index.ts'), 'utf8')

    expect(helperTs).toContain('export type PageWithMemoListSingletonMenu')
    expect(helperTs).toContain('Usage:')
    expect(indexTs).toContain('satisfies PageWithMemoListSingletonMenu<IndexPageData, IndexPageCustom>')
    expect(searchTs).toContain('satisfies PageWithMemoListSingletonMenu<SearchPageData, SearchPageCustom>')
    expect(indexTs).not.toContain('Page<IndexPageData & MemoListSingletonMenuData')
    expect(searchTs).not.toContain('Page<SearchPageData & MemoListSingletonMenuData')
  })
})
