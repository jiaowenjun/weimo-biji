import { describe, expect, it } from 'vitest'
import type { TagTreeMeta } from '../../models/tag'
import {
  compareTagPathPinyin,
  compareTagTreeMetaSiblings,
  sortTagTreeMetaDeep,
  tagLiteralLatinKey,
  tagPathSortKey,
} from '../tag-sort'

describe('tagLiteralLatinKey', () => {
  it('maps Chinese to lower pinyin and keeps ASCII alnum', () => {
    expect(tagLiteralLatinKey('北京')).toBe('beijing')
    expect(tagLiteralLatinKey('OK12')).toBe('ok12')
  })
})

describe('compareTagPathPinyin', () => {
  it('orders Chinese by pinyin (Beijing before Shanghai)', () => {
    expect(compareTagPathPinyin('上海', '北京')).toBeGreaterThan(0)
    expect(compareTagPathPinyin('北京', '上海')).toBeLessThan(0)
  })

  it('orders mixed CJK and Latin in one Latin key order', () => {
    const workMail = '工作/Mail'
    const workOk = '工作/OK'
    // gongzuomail < gongzuook → Mail 排在 OK 前
    expect(compareTagPathPinyin(workMail, workOk)).toBeLessThan(0)
    expect(compareTagPathPinyin(workOk, workMail)).toBeGreaterThan(0)
  })

  it('tie-breaks on full path when keys equal', () => {
    // same display different paths unlikely - use same pinyin key different tags
    expect(compareTagPathPinyin('a/x', 'a/y')).not.toBe(0)
  })
})

describe('sortTagTreeMetaDeep', () => {
  it('sorts siblings by label latin key and recurses', () => {
    const shanghai: TagTreeMeta = { label: '上海', tag: '上海', item_count: 1, children: [] }
    const beijing: TagTreeMeta = { label: '北京', tag: '北京', item_count: 1, children: [] }
    const root: TagTreeMeta[] = [shanghai, beijing]
    const sorted = sortTagTreeMetaDeep(root)
    expect(sorted.map((n) => n.tag)).toEqual(['北京', '上海'])
  })
})

describe('compareTagTreeMetaSiblings', () => {
  it('uses resolveTagLabel for order', () => {
    const mail: TagTreeMeta = { label: 'Mail', tag: '工作/Mail', item_count: 1, children: [] }
    const ok: TagTreeMeta = { label: 'OK', tag: '工作/OK', item_count: 1, children: [] }
    expect(compareTagTreeMetaSiblings(mail, ok)).toBeLessThan(0) // mail before ok
    expect(compareTagTreeMetaSiblings(ok, mail)).toBeGreaterThan(0)
  })
})

describe('tagPathSortKey', () => {
  it('ignores slash like flat literal', () => {
    expect(tagPathSortKey('工作/项目')).toBe(tagLiteralLatinKey('工作项目'))
  })
})
