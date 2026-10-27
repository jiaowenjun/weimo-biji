import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceStore } from '../../../store/workspace-store'
import { loadTagOptionsFromWorkspace } from '../tag-options-source'
import { deriveTagPickerViewState } from '../view-state'

type TagTreeNode = {
  label: string
  tag: string
  item_count: number
  children: TagTreeNode[]
}

function makeStoreMock(data: TagTreeNode[] | null): WorkspaceStore {
  const ensureTagTree = vi.fn().mockResolvedValue(undefined)
  return {
    ensureTagTree,
    getState: () => ({
      memos: { detail: new Map(), list: new Map() },
      stats: { status: 'idle', error: null, dataUpdatedAt: 0, data: null },
      tagTree: { status: data ? 'success' : 'idle', error: null, dataUpdatedAt: 1, data },
      exitingMemoIds: new Set<number>(),
    }),
  } as unknown as WorkspaceStore
}

describe('deriveTagPickerViewState', () => {
  it('hides memo placeholder path 无 in insert option list while pick still lists it', () => {
    const raw = ['工作/项目', '无', '文学/诗歌']

    expect(
      deriveTagPickerViewState({
        mode: 'insert',
        targetTag: '',
        selectedTags: [],
        rawDraft: '',
        rawTagOptions: raw,
        listFilterQuery: '',
        draftSource: 'sync-init',
      }).options.map((o) => o.tag),
    ).toEqual(['工作/项目', '文学/诗歌'])

    expect(
      deriveTagPickerViewState({
        mode: 'pick',
        targetTag: '',
        selectedTags: [],
        rawDraft: '',
        rawTagOptions: raw,
        listFilterQuery: '',
        draftSource: 'sync-init',
      }).options.map((o) => o.tag),
    ).toEqual(['工作/项目', '无', '文学/诗歌'])
  })

  it('hides memo placeholder path 无 in update option list', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'update',
        targetTag: '工作/项目',
        selectedTags: ['工作/项目'],
        rawDraft: '#工作/项目',
        rawTagOptions: ['工作/项目', '无', '归档'],
        listFilterQuery: '',
        draftSource: 'input',
      }).options.map((o) => o.tag),
    ).toEqual(['工作/项目', '归档'])
  })

  it('derives insert state from sync-init draft', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'insert',
        targetTag: '',
        selectedTags: ['工作/项目'],
        rawDraft: '#文诗  ',
        rawTagOptions: ['工作/项目', '文学/古代/唐诗', '文学/诗歌', '归档'],
        listFilterQuery: '',
        draftSource: 'sync-init',
      }),
    ).toEqual({
      draft: '文诗',
      listFilterQuery: '文诗',
      confirmDisabled: false,
      options: [
        { tag: '文学/古代/唐诗', disabled: false },
        { tag: '文学/诗歌', disabled: false },
      ],
    })
  })

  it('derives update state: target row disabled with 原标签, other selected rows 已选', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'update',
        targetTag: '工作/项目',
        selectedTags: ['工作/项目', '文学'],
        rawDraft: '#工作/项目',
        rawTagOptions: ['工作/项目', '文学', '归档'],
        listFilterQuery: '文',
        draftSource: 'input',
      }),
    ).toEqual({
      draft: '工作/项目',
      listFilterQuery: '',
      confirmDisabled: true,
      options: [
        { tag: '工作/项目', disabled: true, optionBadge: '原标签' },
        { tag: '文学', disabled: true, optionBadge: '已选' },
        { tag: '归档', disabled: false },
      ],
    })
  })

  it('keeps pick sync-init draft out of first-frame list filtering', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'pick',
        targetTag: '',
        selectedTags: ['工作/项目'],
        rawDraft: '#文学',
        rawTagOptions: ['工作/项目', '文学', '文学/诗歌'],
        listFilterQuery: '工作',
        draftSource: 'sync-init',
      }),
    ).toEqual({
      draft: '文学',
      listFilterQuery: '',
      confirmDisabled: false,
      options: [
        { tag: '工作/项目', disabled: true, optionBadge: '已选' },
        { tag: '文学', disabled: false },
        { tag: '文学/诗歌', disabled: false },
      ],
    })
  })

  it('preserves the current list filter query when re-deriving after tag options load', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'pick',
        targetTag: '',
        selectedTags: ['工作/项目'],
        rawDraft: '文学',
        rawTagOptions: ['工作/项目', '文学', '文学/诗歌', '归档'],
        listFilterQuery: '文',
      }),
    ).toEqual({
      draft: '文学',
      listFilterQuery: '文',
      confirmDisabled: false,
      options: [
        { tag: '文学', disabled: false },
        { tag: '文学/诗歌', disabled: false },
      ],
    })
  })

  it('keeps list-tap on the previous listFilterQuery while updating draft and options', () => {
    expect(
      deriveTagPickerViewState({
        mode: 'insert',
        targetTag: '',
        selectedTags: ['工作/项目'],
        rawDraft: '文学/诗歌',
        rawTagOptions: ['工作/项目', '文学/古代/唐诗', '文学/诗歌', '归档'],
        listFilterQuery: '文',
        draftSource: 'list-tap',
      }),
    ).toEqual({
      draft: '文学/诗歌',
      listFilterQuery: '文',
      confirmDisabled: false,
      options: [
        { tag: '文学/古代/唐诗', disabled: false },
        { tag: '文学/诗歌', disabled: false },
      ],
    })
  })
})

describe('loadTagOptionsFromWorkspace', () => {
  it('returns flattened tags from workspace state (无 pinned after locale sort)', async () => {
    const store = makeStoreMock([
      { label: '工作', tag: '工作', item_count: 1, children: [] },
      { label: '无', tag: '无', item_count: 1, children: [] },
      { label: '项目', tag: '项目/alpha', item_count: 1, children: [] },
    ])

    const tags = await loadTagOptionsFromWorkspace(store)
    expect(tags[tags.length - 1]).toBe('无')
    expect(tags.slice(0, -1)).toEqual(expect.arrayContaining(['工作', '项目/alpha']))
    expect(tags).toHaveLength(3)
  })

  it('throws when workspace ensureTagTree fails', async () => {
    const store = {
      ensureTagTree: vi.fn().mockRejectedValue(new Error('401')),
      getState: vi.fn(),
    } as unknown as WorkspaceStore

    await expect(loadTagOptionsFromWorkspace(store)).rejects.toThrow('401')
  })

  it('returns empty array when tag tree is empty', async () => {
    const store = makeStoreMock([])
    await expect(loadTagOptionsFromWorkspace(store)).resolves.toEqual([])
  })
})

describe('memo-compose-tag-picker page', () => {
  it('empty draft with replace calls handleRemove when allowEmptyRemove', async () => {
    vi.resetModules()

    const pageFactory = vi.fn((config) => config)
    const navigateBack = vi.fn()
    vi.stubGlobal('Page', pageFactory)
    vi.stubGlobal('wx', { navigateBack })

    await import('../index')

    expect(pageFactory).toHaveBeenCalledTimes(1)

    const pageConfig = pageFactory.mock.calls[0][0] as {
      applyPickedTag: (this: {
        data: {
          mode: MemoComposeTagPickerMode
          targetTag: string
          selectedTags: string[]
          allowEmptyRemove: boolean
        }
        handleRemove: () => void
        emitApply: () => void
        handleClose: () => void
      }, rawDraft: string) => void
    }

    const handleRemove = vi.fn()
    const emitApply = vi.fn()
    const handleClose = vi.fn()

    pageConfig.applyPickedTag.call(
      {
        data: {
          mode: 'update',
          targetTag: '工作/项目',
          selectedTags: ['工作/项目', '文学'],
          allowEmptyRemove: true,
        },
        handleRemove,
        emitApply,
        handleClose,
      },
      '',
    )

    expect(handleRemove).toHaveBeenCalledOnce()
    expect(emitApply).not.toHaveBeenCalled()
    expect(handleClose).not.toHaveBeenCalled()
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('does not delete on empty draft for replace + allowEmptyRemove=false', async () => {
    vi.resetModules()

    const pageFactory = vi.fn((config) => config)
    const navigateBack = vi.fn()
    vi.stubGlobal('Page', pageFactory)
    vi.stubGlobal('wx', { navigateBack })

    await import('../index')

    const pageConfig = pageFactory.mock.calls[0][0] as {
      applyPickedTag: (this: {
        data: {
          mode: MemoComposeTagPickerMode
          targetTag: string
          selectedTags: string[]
          allowEmptyRemove: boolean
        }
        handleRemove: () => void
        emitApply: () => void
        handleClose: () => void
      }, rawDraft: string) => void
    }

    const handleRemove = vi.fn()
    const emitApply = vi.fn()
    const handleClose = vi.fn()

    pageConfig.applyPickedTag.call(
      {
        data: {
          mode: 'update',
          targetTag: '工作/项目',
          selectedTags: ['工作/项目'],
          allowEmptyRemove: false,
        },
        handleRemove,
        emitApply,
        handleClose,
      },
      '',
    )

    expect(handleRemove).not.toHaveBeenCalled()
    expect(emitApply).not.toHaveBeenCalled()
    expect(handleClose).not.toHaveBeenCalled()
    expect(navigateBack).not.toHaveBeenCalled()
  })
})
