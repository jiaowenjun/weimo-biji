import { describe, expect, it } from 'vitest'
import { shouldNoOpExactHomeTagReselect } from '../tag-selection'

describe('shouldNoOpExactHomeTagReselect', () => {
  it('no-ops only on exact path match and still switches for ancestor or descendant tags', () => {
    expect(shouldNoOpExactHomeTagReselect('工作/项目', '工作/项目')).toBe(true)

    expect(shouldNoOpExactHomeTagReselect('工作/项目', '工作')).toBe(false)
    expect(shouldNoOpExactHomeTagReselect('工作/项目', '工作/项目/子项')).toBe(false)
    expect(shouldNoOpExactHomeTagReselect('工作', '工作/项目')).toBe(false)
    expect(shouldNoOpExactHomeTagReselect('工作/项目', '工作/其他')).toBe(false)
  })
})
