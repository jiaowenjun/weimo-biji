import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openMemoComposeTagPicker } from '../../../utils/navigation'

vi.mock('../../../utils/navigation', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/navigation')>(
    '../../../utils/navigation',
  )
  return {
    ...actual,
    openMemoComposeTagPicker: vi.fn(),
  }
})

describe('search page tag picker apply', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('replaces the current selectedTag with the newly picked tag', async () => {
    const pageFactory = vi.fn((config) => config)
    vi.stubGlobal('Page', pageFactory)

    await import('../index')

    expect(pageFactory).toHaveBeenCalledTimes(1)

    const pageConfig = pageFactory.mock.calls[0][0] as {
      handleTagPick: (this: {
        data: { draft: MemoQueryDraft; targetFriend: null }
        syncDraft: (nextDraft: MemoQueryDraft) => void
        _isFriendMode: () => boolean
      }) => void
    }

    ;(openMemoComposeTagPicker as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_payload: MemoComposeTagPickerInitPayload, onApplied: (result: MemoComposeTagPickerApplyPayload) => void) => {
        onApplied({
          selectedTags: ['工作/项目', '文学/诗歌'],
        })
      },
    )

    const syncDraft = vi.fn()
    pageConfig.handleTagPick.call({
      data: {
        draft: {
          keyword: 'milk',
          selectedTag: '工作/项目',
          dateMode: 'day',
          dateValue: '2026-04-28',
        },
        targetFriend: null,
      },
      syncDraft,
      _isFriendMode: () => false,
    })

    expect(syncDraft).toHaveBeenCalledWith({
      keyword: 'milk',
      selectedTag: '文学/诗歌',
      dateMode: 'day',
      dateValue: '2026-04-28',
    })
  })

  it('passes tagTreeScope friend when in friend mode', async () => {
    const pageFactory = vi.fn((config) => config)
    vi.stubGlobal('Page', pageFactory)

    await import('../index')

    const pageConfig = pageFactory.mock.calls[0][0] as {
      handleTagPick: (this: {
        data: { draft: MemoQueryDraft; targetFriend: { username: string; nickname: string } }
        syncDraft: (nextDraft: MemoQueryDraft) => void
        _isFriendMode: () => boolean
      }) => void
    }

    const syncDraft = vi.fn()
    pageConfig.handleTagPick.call({
      data: {
        draft: {
          keyword: '',
          selectedTag: '',
          dateMode: 'day',
          dateValue: '',
        },
        targetFriend: { username: 'bob', nickname: '小吴' },
      },
      syncDraft,
      _isFriendMode: () => true,
    })

    expect(openMemoComposeTagPicker).toHaveBeenCalledWith(
      expect.objectContaining({ tagTreeScope: 'friend', friendUsername: 'bob' }),
      expect.any(Function),
      { routeType: 'cupertino' },
    )
  })
})
