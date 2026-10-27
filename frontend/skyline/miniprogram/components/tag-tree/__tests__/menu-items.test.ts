import { describe, expect, it } from 'vitest'
import { buildTagTreeMenuItems } from '../menu-items'

describe('buildTagTreeMenuItems', () => {
  it('returns edit and delete items for authenticated users', () => {
    expect(buildTagTreeMenuItems(true)).toEqual([
      { id: 'edit', label: '重命名', icon: 'edit' },
      { id: 'delete', label: '删除', icon: 'delete', danger: true },
    ])
  })

  it('returns no menu items for visitor mode', () => {
    expect(buildTagTreeMenuItems(false)).toEqual([])
  })
})
