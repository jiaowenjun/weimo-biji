import { describe, expect, it } from 'vitest'
import {
  formatTagPathForNavTitle,
  HOME_NAV_TITLE_DEFAULT,
  HOME_NAV_TITLE_VISITOR,
  resolveHomeNavTitle,
  resolveSearchNavTitle,
  homeNavTitleBudget,
} from '../home-nav-title'

describe('formatTagPathForNavTitle', () => {
  it('空路径返回默认 weimo', () => {
    expect(formatTagPathForNavTitle('  ', { maxLen: 30 })).toBe(HOME_NAV_TITLE_DEFAULT)
  })

  it('短路径：# + 原路径', () => {
    expect(formatTagPathForNavTitle('文学/红楼梦', { maxLen: 30 })).toBe('#文学/红楼梦')
  })

  it('规则1：至少三段时缩略为 #头/.../尾', () => {
    const path = '文学/中国古代文学/清代/红楼梦'
    expect(path.split('/').length).toBeGreaterThanOrEqual(3)
    // 全串 #path 在 20 字内时不会触发缩略，需用更严 maxLen
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen })
    expect(out).toBe('#文学/.../红楼梦')
    expect(out.length).toBeLessThanOrEqual(maxLen)
  })

  it('规则2：#.../末级（非极窄优先带 #）', () => {
    const path = '世界与中国文学/中国古代文学/清代/红楼梦'
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen, isNarrow: false })
    expect(out).toBe('#.../红楼梦')
    expect(out.length).toBeLessThanOrEqual(maxLen)
  })

  it('规则2 极窄：优先去掉 #', () => {
    const path = '世界与中国文学/中国古代文学/清代/红楼梦'
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen, isNarrow: true })
    expect(out).toBe('.../红楼梦')
  })

  it('规则3：.../整段末级仍超长时，截断末级尾部（与「四大名著红…」同形）', () => {
    const path = '文学/一二三四五六七八九'
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen, isNarrow: true })
    expect(out).toBe('.../一二三四五...')
    expect(out.length).toBeLessThanOrEqual(maxLen)
  })
})

describe('formatTagPathForNavTitle pathPrefix none', () => {
  it('短路径无 # 前缀', () => {
    const out = formatTagPathForNavTitle('文学/红楼梦', { maxLen: 30, pathPrefix: 'none' })
    expect(out).toBe('文学/红楼梦')
    expect(out).not.toContain('#')
  })

  it('规则1：头/.../尾 无 #', () => {
    const path = '文学/中国古代文学/清代/红楼梦'
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen, pathPrefix: 'none' })
    expect(out).toBe('文学/.../红楼梦')
    expect(out).not.toContain('#')
    expect(out.length).toBeLessThanOrEqual(maxLen)
  })

  it('规则2：无 # 的 .../末级', () => {
    const path = '世界与中国文学/中国古代文学/清代/红楼梦'
    const maxLen = 12
    const out = formatTagPathForNavTitle(path, { maxLen, isNarrow: false, pathPrefix: 'none' })
    expect(out).toBe('.../红楼梦')
    expect(out).not.toContain('#')
  })
})

describe('resolveHomeNavTitle', () => {
  it('无选中标签且无 userLabel 为「游客」', () => {
    expect(resolveHomeNavTitle('', 430)).toBe(HOME_NAV_TITLE_VISITOR)
  })
  it('无选中标签且传入昵称', () => {
    expect(resolveHomeNavTitle('', 430, '小吴')).toBe('小吴')
  })
  it('无选中标签时超长昵称 ellipsize 到预算以内', () => {
    const w = 430
    const maxLen = homeNavTitleBudget(w).maxLen
    const longName = 'a'.repeat(maxLen + 20)
    const out = resolveHomeNavTitle('', w, longName)
    expect(out.endsWith('...')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(maxLen)
  })
  it('有标签为纯路径无字面 #', () => {
    const w = 430
    const out = resolveHomeNavTitle('文学/红楼梦', w)
    expect(out).toBe('文学/红楼梦')
    expect(out).not.toContain('#')
  })
})

describe('resolveSearchNavTitle', () => {
  it('与 resolveHomeNavTitle 一致', () => {
    expect(resolveSearchNavTitle('', 430)).toBe(resolveHomeNavTitle('', 430))
    expect(resolveSearchNavTitle('文学/红楼梦', 400)).toBe(
      resolveHomeNavTitle('文学/红楼梦', 400),
    )
  })
})
