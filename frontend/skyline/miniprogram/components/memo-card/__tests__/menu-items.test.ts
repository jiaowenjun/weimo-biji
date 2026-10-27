import { describe, expect, it } from 'vitest'
import { resolvePermissions } from '../../../utils/memo-permissions'
import { buildMemoCardMenuItems, type MemoCardMenuItem } from '../menu-items'

function ids(items: MemoCardMenuItem[]): string[] {
  return items.map((item) => item.id)
}

describe('buildMemoCardMenuItems', () => {
  it('self menu keeps edit quote share copy delete order without detail', () => {
    const items = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('self'),
    })

    expect(ids(items)).toEqual(['edit', 'quote', 'share', 'copy', 'delete'])
    expect(items.find((item) => item.id === 'edit')?.icon).toBe('edit')
    expect(items.find((item) => item.id === 'share')?.icon).toBe('share')
    expect(items.find((item) => item.id === 'copy')?.icon).toBe('copy')
    expect(items.find((item) => item.id === 'quote')?.icon).toBe('arrow-left-up-circle')
    expect(items.find((item) => item.id === 'delete')?.icon).toBe('delete')
    expect(items.find((item) => item.id === 'modify-tag')).toBeUndefined()
    expect(items.find((item) => item.id === 'quote')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'share')?.dividerBefore).toBe(true)
    expect(items.find((item) => item.id === 'copy')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'delete')?.dividerBefore).toBe(true)
  })

  it('self menu inserts detail before share and copy and keeps delete in its own group', () => {
    const items = buildMemoCardMenuItems(['工作'], {
      permissions: resolvePermissions('self'),
      showMemoDetailPage: true,
    })

    expect(ids(items)).toEqual(['edit', 'quote', 'memo-detail', 'share', 'copy', 'delete'])
    expect(items.find((item) => item.id === 'quote')?.dividerBefore).toBe(false)
    const detail = items.find((item) => item.id === 'memo-detail')
    expect(detail?.label).toBe('查看详情')
    expect(detail?.icon).toBe('arrow-up-down-circle')
    expect(detail?.iconExtraClass).toBe('weimo-popover-menu__item-icon--rot-ccw-45')
    expect(detail?.dividerBefore).toBe(true)
    expect(items.find((item) => item.id === 'share')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'copy')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'delete')?.dividerBefore).toBe(true)
  })

  it('friend menu includes a divider after quote before detail share and copy', () => {
    const items = buildMemoCardMenuItems(['friend'], {
      permissions: resolvePermissions('friend'),
      showMemoDetailPage: true,
    })

    expect(ids(items)).toEqual(['quote', 'memo-detail', 'share', 'copy'])
    expect(items.find((item) => item.id === 'quote')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'memo-detail')?.dividerBefore).toBe(true)
    expect(items.find((item) => item.id === 'share')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'copy')?.dividerBefore).toBe(false)
    expect(items.every((item) => !item.disabled)).toBe(true)
  })

  it('friend menu keeps the divider before share when detail entry is not visible', () => {
    const items = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('friend'),
    })

    expect(ids(items)).toEqual(['quote', 'share', 'copy'])
    expect(items.find((item) => item.id === 'quote')?.dividerBefore).toBe(false)
    expect(items.find((item) => item.id === 'share')?.dividerBefore).toBe(true)
    expect(items.find((item) => item.id === 'copy')?.dividerBefore).toBe(false)
  })

  it('visitor menu remains edit and delete only', () => {
    const items = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('visitor'),
      showMemoDetailPage: true,
    })

    expect(ids(items)).toEqual(['edit', 'delete'])
  })

  it('denied menu is empty', () => {
    const items = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('denied'),
      showMemoDetailPage: true,
    })

    expect(items).toEqual([])
  })

  it('menuReadonly disables all visible role actions except share and copy', () => {
    const items = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('self'),
      menuReadonly: true,
    })

    expect(ids(items)).toEqual(['edit', 'quote', 'share', 'copy', 'delete'])
    expect(
      items
        .filter((item) => item.id !== 'share' && item.id !== 'copy')
        .every((item) => item.disabled === true),
    ).toBe(true)
    expect(items.find((item) => item.id === 'share')?.disabled).toBeUndefined()
    expect(items.find((item) => item.id === 'copy')?.disabled).toBeUndefined()
  })

  it('delete item keeps danger true for writable roles', () => {
    const del = buildMemoCardMenuItems(['x', 'y'], {
      permissions: resolvePermissions('self'),
    }).find((item) => item.id === 'delete')

    expect(del?.danger).toBe(true)
  })

  it('returns a fresh array without polluting shared item references', () => {
    const a = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('self'),
    })
    const b = buildMemoCardMenuItems([], {
      permissions: resolvePermissions('self'),
    })

    expect(a).not.toBe(b)
    a.push({ id: 'x', label: 'x' })
    expect(ids(b)).toEqual(['edit', 'quote', 'share', 'copy', 'delete'])
  })
})
