import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const indexTsPath = path.join(__dirname, '..', 'index.ts')
const indexWxmlPath = path.join(__dirname, '..', 'index.wxml')
const source = readFileSync(indexTsPath, 'utf8')
const wxml = readFileSync(indexWxmlPath, 'utf8')

describe('index page scroll reset contract', () => {
  it('adds a stable scroll-view id for programmatic reset', () => {
    expect(wxml).toContain('id="index-page-scroll"')
    expect(wxml).toContain('type="custom"')
    expect(wxml).not.toContain('scroll-top="{{indexPageScrollTop}}"')
  })

  it('routes sidebar filter entry points through applyMemoQuery with resetScroll enabled', () => {
    expect(source).toMatch(
      /handleHeatmapDateSelect[\s\S]*void this\.applyMemoQuery\(\s*\{[\s\S]*dateMode:\s*'day',[\s\S]*dateValue:\s*date,[\s\S]*\},\s*\{\s*resetScroll:\s*true\s*\}\s*\)/,
    )
    expect(source).toMatch(
      /handleSidebarTagSelect[\s\S]*void this\.applyMemoQuery\(\s*\{[\s\S]*selectedTag:\s*tag,[\s\S]*\},\s*\{\s*resetScroll:\s*true\s*\}\s*\)/,
    )
    expect(source).toMatch(
      /handleSidebarShowAll\(\)[\s\S]*void this\.applyMemoQuery\(\s*createEmptyMemoQueryDraft\(\)\s*,\s*\{\s*resetScroll:\s*true\s*\}\s*\)/,
    )
    expect(source).toMatch(
      /handleSidebarTodayReview[\s\S]*void this\.applyMemoQuery\(\s*\{[\s\S]*selectedTag:\s*'',[\s\S]*dateMode:\s*'day',[\s\S]*dateValue:\s*date,[\s\S]*\},\s*\{\s*resetScroll:\s*true\s*\}\s*\)/,
    )
  })

  it('adds a dedicated animated reset helper and caches the index scroll-view context', () => {
    expect(source).toContain(
      '_indexPageScrollView: WechatMiniprogram.ScrollViewContext | null',
    )
    expect(source).not.toContain('_pendingIndexPageScrollReset')
    expect(source).not.toContain('indexPageScrollTop')
    expect(source).toContain('cacheIndexPageScrollView: () => void')
    expect(source).toContain('resetIndexPageScroll: () => void')
    expect(source).toContain('const query = this.createSelectorQuery().in(this)')
    expect(source).toContain("query.select('#index-page-scroll').node()")
    expect(source).not.toContain('resetScrollViewToTop')
    expect(source).not.toContain("scrollTopKey: 'indexPageScrollTop'")
    expect(source).toMatch(
      /resetIndexPageScroll\(\)\s*\{[\s\S]*this\._indexPageScrollView\?\.scrollTo\(\{\s*top:\s*0,\s*animated:\s*true,[\s\S]*\}\)[\s\S]*_fabLastScrollTop = 0[\s\S]*patch\.fabCompact = false[\s\S]*patch\.navChromeTransparent = false[\s\S]*\}/s,
    )
    expect(source).toContain('_fabLastScrollTop = 0')
    expect(source).toContain('patch.fabCompact = false')
    expect(source).toContain('patch.navChromeTransparent = false')
  })

  it('gates scroll reset behind applyMemoQuery options after the same-query early return', () => {
    expect(source).toMatch(
      /async applyMemoQuery\(nextQuery: MemoQueryDraft,\s*options: \{ resetScroll\?: boolean \} = \{\}\)\s*\{[\s\S]*if \(isSameMemoQueryDraft\(this\.data\.memoQuery,\s*normalizedQuery\)\) \{\s*return\s*\}[\s\S]*this\.setData\(\{[\s\S]*memoDateLabel:[\s\S]*\}\)[\s\S]*if \(options\.resetScroll === true\) \{\s*this\.resetIndexPageScroll\(\)\s*\}/s,
    )
    expect(source).toMatch(
      /async applyFriendMemoQuery\([\s\S]*if \(isSameMemoQueryDraft\(this\.data\.friendMemoQuery,\s*normalizedQuery\)\) \{[\s\S]*return[\s\S]*\}[\s\S]*this\.setData\(patch\)[\s\S]*if \(options\.resetScroll === true\) \{[\s\S]*this\.resetIndexPageScroll\(\)[\s\S]*\}/s,
    )
  })
})
