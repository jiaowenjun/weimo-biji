import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}))

import { renameTag } from '../tag'

describe('renameTag', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('encodes slash-separated oldTag as pipe-delimited path param', async () => {
    requestMock.mockResolvedValue('ok')

    const result = await renameTag('work/rust', 'work/backend')

    expect(result).toBe('ok')
    expect(requestMock).toHaveBeenCalledWith({
      url: '/tag/work%7Crust',
      method: 'PUT',
      data: { new_tag: 'work/backend' },
    })
  })
})
