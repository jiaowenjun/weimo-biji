import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const jsonPath = path.join(__dirname, '..', 'index.json')
const tsPath = path.join(__dirname, '..', 'index.ts')
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const wxssPath = path.join(__dirname, '..', 'index.wxss')
const memoListWxssPath = path.join(__dirname, '..', '..', '..', 'styles', 'memo-list.wxss')
const pageJson = readFileSync(jsonPath, 'utf8')
const source = readFileSync(tsPath, 'utf8')
const wxml = readFileSync(wxmlPath, 'utf8')
const wxss = readFileSync(wxssPath, 'utf8')
const memoListWxssExists = existsSync(memoListWxssPath)
const memoListWxss = memoListWxssExists ? readFileSync(memoListWxssPath, 'utf8') : ''

function methodSource(name: string, nextName: string) {
  const markers = [`\n  ${name}(`, `\n  async ${name}(`]
  const nextMarkers = [`\n  ${nextName}(`, `\n  async ${nextName}(`]
  const starts = markers
    .map((marker) => source.indexOf(marker))
    .filter((index) => index >= 0)
  const start = starts.length ? Math.min(...starts) : -1
  const ends = nextMarkers
    .map((marker) => source.indexOf(marker, start + name.length))
    .filter((index) => index >= 0)
  const end = ends.length ? Math.min(...ends) : -1
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('index page layout contract', () => {
  it('keeps scroll-view as the scroll owner and renders list-builder directly inside it', () => {
    expect(wxml).toContain('class="page-scroll-shell"')
    expect(wxml).toContain('class="page-nav-spacer"')
    expect(wxml).toContain('style="height: {{navBarOverlayHeight}}px;"')
    expect(wxml).not.toContain('scroll-top="{{indexPageScrollTop}}"')
    expect(wxml).toContain('class="memo-list-top-gap"')
    expect(wxml.indexOf('class="page-nav-spacer"')).toBeLessThan(
      wxml.indexOf('class="memo-list-top-gap"'),
    )
    expect(wxml.indexOf('class="memo-list-top-gap"')).toBeLessThan(
      wxml.indexOf('class="filter-bar memo-list-filter--scroll-root'),
    )
    expect(wxml).toContain('type="custom"')
    expect(wxml).toContain('show-scrollbar="{{false}}"')
    expect(wxml).not.toContain('enhanced="{{true}}"')
    expect(wxml).toContain('<list-builder')
    expect(wxml).toContain('class="memo-list memo-list-builder--scroll-root"')
    expect(wxml).not.toContain('<page-shell>')
    expect(wxml).not.toContain('<memo-list-section')
  })

  it('keeps page-local shell positioning styles needed by the shared overlay component', () => {
    expect(wxss).toMatch(/\.page-scroll-shell\s*\{[\s\S]*position:\s*relative/s)
    expect(wxss).toMatch(/\.page-nav-spacer\s*\{[^}]*flex:\s*none/s)
    expect(wxss).not.toMatch(/\.page-nav-spacer\s*\{[^}]*margin-bottom:/s)
    expect(wxss).toContain("@import '../../styles/memo-list.wxss';")
    expect(wxss).not.toContain("@import '../../components/memo-list-section/index.wxss';")
    expect(memoListWxssExists).toBe(true)
    expect(memoListWxss).toMatch(
      /\.memo-list-top-gap\s*\{[^}]*flex:\s*none[^}]*height:\s*var\(--spacing-md\)/s,
    )
    expect(memoListWxss).toMatch(
      /\.memo-list-filter--scroll-root\s*\{[^}]*transition:\s*none/s,
    )
    expect(wxss).toMatch(/\.memo-list-builder--scroll-root\s*\{[\s\S]*padding:\s*0/s)
    expect(wxss).toMatch(/\.memo-list__item--scroll-root\s*\{[\s\S]*padding:\s*0 var\(--memo-layout-gutter\)/s)
  })

  it('delegates the transparent navigation rendering to <page-nav-chrome>', () => {
    expect(wxml).toContain('<page-nav-chrome')
    expect(wxml).toContain('transparent="{{navChromeTransparent}}"')
    expect(wxml).toContain('status-mask-height="{{navBarStatusMaskHeight}}"')
    expect(wxml).toContain('bind:titlemenuselect="handleTitleMenuSelect"')
    expect(wxml).toContain('bind:menu="handleMenuTap"')
    expect(wxml).toContain('slot="left"')
    expect(wxml).not.toContain('class="page-nav-overlay__surface')
  })

  it('does not use scroll-view pull-down refresher or legacy refresher slot', () => {
    expect(pageJson).not.toContain('nav-aware-refresher')
    expect(wxml).not.toContain('<nav-aware-refresher')
    expect(wxml).not.toContain('refresher-enabled')
    expect(wxml).not.toContain('bindrefresherrefresh')
    expect(wxml).not.toContain('slot="refresher"')
  })

  it('binds memo quote actions from the direct list-builder cards', () => {
    expect(wxml).toContain('bind:quote="handleMemoQuote"')
  })

  it('binds memo copy actions from the direct list-builder cards', () => {
    expect(wxml).toContain('bind:copy="handleMemoCopy"')
  })

  it('binds memo reference bar taps from the direct list-builder cards', () => {
    expect(wxml).toContain('bind:referencetap="handleMemoReferenceTap"')
  })

  it('syncs card menu active changes into the sidebar gesture SharedValue gate', () => {
    const method = methodSource('onCardMenuActiveChange', 'handleCardMenuChange')

    expect(method).toContain('const gate = this._sidebarPageGestureEnabled')
    expect(method).toContain('gate.value = 0')
    expect(method).not.toContain('isTagDrillPage')
    expect(method).toContain('gate.value = 1')
  })

  it('opens homepage tag edit and add actions with the top-level cupertino route', () => {
    const modifyTag = methodSource('handleMemoModifyTag', 'handleMemoTagAdd')
    const addTag = methodSource('handleMemoTagAdd', 'handleMemoTagRemove')

    expect(modifyTag).toContain("routeType: 'cupertino'")
    expect(modifyTag).toContain('dispatchMemoModifyTag(this, memoId, targetTag')
    expect(addTag).toContain("dispatchMemoAddTag(this, memoId, { routeType: 'cupertino' })")
  })

  it('routes memo copy through the shared clipboard helper', () => {
    const method = methodSource('handleMemoCopy', 'handleCardMenuChange')

    expect(source).toContain('copyMemoContentForCard')
    expect(method).toContain('resetMemoCardTap(this)')
    expect(method).toContain('copyMemoContentForCard(this.data.memoCards, memoId)')
    expect(method).not.toContain('openMemoShareForCard')
  })
})
