import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/friend', () => ({
  getFriendTagTree: vi.fn(),
}))

import { getFriendTagTree } from '../../../services/friend'
import { loadTagOptionsFromFriend } from '../tag-options-source'

describe('loadTagOptionsFromFriend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flattens and sorts friend tag tree nodes by pinyin', async () => {
    ;(getFriendTagTree as ReturnType<typeof vi.fn>).mockResolvedValue({
      label: '',
      tag: '',
      item_count: 0,
      children: [
        {
          label: '文学',
          tag: '文学',
          item_count: 3,
          children: [
            { label: '诗歌', tag: '文学/诗歌', item_count: 1, children: [] },
            { label: '小说', tag: '文学/小说', item_count: 2, children: [] },
          ],
        },
        {
          label: '工作',
          tag: '工作',
          item_count: 5,
          children: [],
        },
      ],
    })

    const result = await loadTagOptionsFromFriend('bob')

    expect(getFriendTagTree).toHaveBeenCalledTimes(1)
    expect(getFriendTagTree).toHaveBeenCalledWith('bob')
    expect(result).toContain('文学')
    expect(result).toContain('文学/诗歌')
    expect(result).toContain('文学/小说')
    expect(result).toContain('工作')
    expect(result.length).toBe(4)
  })

  it('returns empty array when friend has no tags', async () => {
    ;(getFriendTagTree as ReturnType<typeof vi.fn>).mockResolvedValue({
      label: '',
      tag: '',
      item_count: 0,
      children: [],
    })

    const result = await loadTagOptionsFromFriend('bob')

    expect(getFriendTagTree).toHaveBeenCalledWith('bob')
    expect(result).toEqual([])
  })
})
