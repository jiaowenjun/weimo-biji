import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useWorkspaceTagActions } from '../src/use-workspace-tag-actions.ts'

describe('useWorkspaceTagActions', () => {
  it('applies the complete guest rename result through the adapter', () => {
    const setItems = vi.fn()
    const setTagTree = vi.fn()
    const selectTag = vi.fn()
    const { result } = renderHook(() =>
      useWorkspaceTagActions({
        items: [{ id: 1, tags: ['文学/古代'] }],
        mode: 'guest',
        selectedTag: '文学/古代',
        selectTag,
        setItems,
        setTagTree,
        tagTree: {
          label: '全部标签',
          tag: '',
          item_count: 1,
          children: [
            {
              label: '文学',
              tag: '文学',
              item_count: 1,
              children: [],
            },
          ],
        },
      }),
    )

    act(() => result.current.setExpandedTags(['文学']))
    act(() => result.current.handleRenameTag('文学'))
    act(() => result.current.handleRenameTagApply({
      draft: '文学/中国文学',
      selectedTags: [],
    }))

    expect(setItems).toHaveBeenCalledWith([
      { id: 1, tags: ['文学/中国文学/古代'] },
    ])
    expect(setTagTree).toHaveBeenCalledOnce()
    expect(selectTag).toHaveBeenCalledWith('文学/中国文学/古代')
    expect(result.current.expandedTags).toEqual(['文学/中国文学', '文学'])
    expect(result.current.renamingTag).toBeNull()
  })

  it('uses the latest authenticated selection after an async rename', async () => {
    let resolveRename: (() => void) | undefined
    const renameTag = vi.fn(() => new Promise<void>((resolve) => {
      resolveRename = resolve
    }))
    const selectTag = vi.fn()
    const options = (selectedTag: string) => ({
      canManageTag: () => true,
      confirmDelete: () => true,
      deleteTag: vi.fn(async () => undefined),
      mode: 'authenticated' as const,
      onError: vi.fn(),
      renameTag,
      selectedTag,
      selectTag,
      showAllItems: vi.fn(),
    })
    const { result, rerender } = renderHook(
      ({ selectedTag }) => useWorkspaceTagActions(options(selectedTag)),
      { initialProps: { selectedTag: '文学' } },
    )

    act(() => result.current.handleRenameTag('文学'))
    await act(async () => {
      result.current.handleRenameTagApply({
        draft: '文学/中国文学',
        selectedTags: [],
      })
      await Promise.resolve()
    })
    rerender({ selectedTag: '文学/古代' })
    await act(async () => {
      resolveRename?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(renameTag).toHaveBeenCalledWith('文学', '文学/中国文学')
    expect(selectTag).toHaveBeenCalledWith('文学/中国文学/古代')
  })
})
