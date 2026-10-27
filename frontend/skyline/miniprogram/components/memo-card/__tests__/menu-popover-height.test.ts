import { describe, expect, it } from 'vitest'
import { resolvePermissions } from '../../../utils/memo-permissions'
import { estimateMemoCardMenuPopoverHeightPx } from '../menu-popover-height'
import { buildMemoCardMenuItems } from '../menu-items'
import type { MemoCardMenuItem } from '../menu-items'

describe('estimateMemoCardMenuPopoverHeightPx', () => {
  it('matches legacy ~124px scale for two plain rows (divider before 2nd)', () => {
    const items: MemoCardMenuItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    expect(estimateMemoCardMenuPopoverHeightPx(items)).toBeLessThanOrEqual(130)
    expect(estimateMemoCardMenuPopoverHeightPx(items)).toBeGreaterThanOrEqual(124)
  })

  it('is much larger for full editable memo menu than default popover constant', () => {
    const full = buildMemoCardMenuItems(['only'], {
      permissions: resolvePermissions('self'),
      showMemoDetailPage: true,
    })
    expect(full.length).toBeGreaterThanOrEqual(5)
    expect(estimateMemoCardMenuPopoverHeightPx(full)).toBeGreaterThan(250)
  })
})
