import { describe, expect, it } from 'vitest'
import { parentTagPath, remapSelectedTagPath } from '../tag-path'

describe('parentTagPath', () => {
  it('returns null for empty or top-level tag', () => {
    expect(parentTagPath('')).toBeNull()
    expect(parentTagPath('工作')).toBeNull()
  })

  it('returns direct parent for nested tag paths', () => {
    expect(parentTagPath('工作/笔记')).toBe('工作')
    expect(parentTagPath('a/b/c')).toBe('a/b')
  })

  it('returns null when slash is at the start', () => {
    expect(parentTagPath('/笔记')).toBeNull()
  })

  it('returns parent segment when tag ends with slash', () => {
    expect(parentTagPath('工作/')).toBe('工作')
  })
})

describe('remapSelectedTagPath', () => {
  it('renames exact selected tag', () => {
    expect(remapSelectedTagPath('项目', '项目', '归档')).toBe('归档')
  })

  it('renames descendant selected tag by prefix', () => {
    expect(remapSelectedTagPath('项目/重构', '项目', '归档')).toBe('归档/重构')
  })

  it('keeps unrelated selected tag unchanged', () => {
    expect(remapSelectedTagPath('生活/阅读', '项目', '归档')).toBe('生活/阅读')
  })

  it('does not treat non-segment prefix as a match', () => {
    expect(remapSelectedTagPath('项目集', '项目', '归档')).toBe('项目集')
  })
})
