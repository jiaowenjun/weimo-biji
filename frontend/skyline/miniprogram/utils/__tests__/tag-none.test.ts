import { describe, expect, it } from 'vitest'
import { pruneMemoTagNoneWhenMixed, tagsWithoutNoneForComposeBar } from '../tag-none'
import { reorderTagTreeSiblingsNoneLast } from '../tag-sort'

describe('tag-none helpers', () => {
  it('tagsWithoutNoneForComposeBar filters placeholder 无', () => {
    expect(tagsWithoutNoneForComposeBar(['无', '工作'])).toEqual(['工作'])
    expect(tagsWithoutNoneForComposeBar(['无'])).toEqual([])
  })

  it('pruneMemoTagNoneWhenMixed keeps only 无', () => {
    expect(pruneMemoTagNoneWhenMixed(['无'])).toEqual(['无'])
  })

  it('pruneMemoTagNoneWhenMixed drops 无 when another tag remains', () => {
    expect(pruneMemoTagNoneWhenMixed(['无', '工作'])).toEqual(['工作'])
    expect(pruneMemoTagNoneWhenMixed(['工作', '无'])).toEqual(['工作'])
  })

  it('reorderTagTreeSiblingsNoneLast pushes 无 to last sibling', () => {
    const nodes = [
      { label: '无', tag: '无', item_count: 0, children: [] },
      { label: '工作', tag: '工作', item_count: 1, children: [] },
    ]
    const ordered = reorderTagTreeSiblingsNoneLast(nodes)
    expect(ordered.map((n) => n.tag)).toEqual(['工作', '无'])
  })
})
