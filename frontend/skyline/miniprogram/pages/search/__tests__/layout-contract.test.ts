import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const jsonPath = path.join(__dirname, '..', 'index.json')
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const wxssPath = path.join(__dirname, '..', 'index.wxss')
const tsPath = path.join(__dirname, '..', 'index.ts')
const memoListWxssPath = path.join(__dirname, '..', '..', '..', 'styles', 'memo-list.wxss')
const pageJson = readFileSync(jsonPath, 'utf8')
const wxml = readFileSync(wxmlPath, 'utf8')
const wxss = readFileSync(wxssPath, 'utf8')
const ts = readFileSync(tsPath, 'utf8')
const memoListWxssExists = existsSync(memoListWxssPath)
const memoListWxss = memoListWxssExists ? readFileSync(memoListWxssPath, 'utf8') : ''

function methodSource(methodName: string, nextMethodName: string): string {
  const startPattern = new RegExp(`\\n  (?:async\\s+)?${methodName}\\(`)
  const startMatch = startPattern.exec(ts)
  if (!startMatch) throw new Error(`Missing method ${methodName}`)

  const nextPattern = new RegExp(`\\n  (?:async\\s+)?${nextMethodName}\\(`, 'g')
  nextPattern.lastIndex = startMatch.index + 1
  const nextMatch = nextPattern.exec(ts)

  return ts.slice(startMatch.index, nextMatch?.index ?? ts.length)
}

describe('search page layout contract', () => {
  it('moves navigation-bar rendering into the shared nav chrome overlay and binds scroll handling', () => {
    expect(wxml).toContain('class="page-scroll-shell"')
    expect(wxml).toContain('id="search-results-scroll"')
    expect(wxml).not.toContain('scroll-top="{{searchResultsScrollTop}}"')
    expect(wxml).toContain('class="page-nav-spacer"')
    expect(wxml).toContain('class="memo-list-top-gap"')
    expect(wxml.indexOf('class="page-nav-spacer"')).toBeLessThan(
      wxml.indexOf('class="memo-list-top-gap"'),
    )
    expect(wxml.indexOf('class="memo-list-top-gap"')).toBeLessThan(
      wxml.indexOf('class="filter-bar memo-list-filter--scroll-root'),
    )
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
    expect(wxml).toContain('bindscroll="handlePageScroll"')
    expect(wxml).toContain('type="custom"')
    expect(wxml).toContain('show-scrollbar="{{false}}"')
    expect(wxml).not.toContain('enhanced="{{true}}"')
    expect(wxml).toContain('<page-nav-chrome')
    expect(wxml).toContain('<weimo-popover-menu')
    expect(wxml).toContain('transparent="{{navChromeTransparent}}"')
    expect(wxml).toContain('title-leading-icon="search"')
    expect(wxml).toContain('status-mask-height="{{navBarStatusMaskHeight}}"')
    expect(wxml).toMatch(/bind:titlemenuselect="handleTitleMenuSelect"/)
  })

  it('uses shared primitive classes for the inline shell and field shell', () => {
    expect(wxml).toContain('class="search-shell ds-page-inline-shell"')
    expect(wxml).toContain('search-results__content')
    expect(wxml).toContain('class="memo-list memo-list-builder--scroll-root search-results__content"')
    expect(wxml).toContain(
      'class="search-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted"',
    )
  })

  it('aligns scroll-view with index: list cache-extent, no pull-down refresher', () => {
    expect(wxml).not.toContain('refresher-enabled')
    expect(wxml).toContain('cache-extent="500"')
  })

  it('does not use scroll-view pull-down refresher or legacy refresher slot', () => {
    expect(pageJson).not.toContain('nav-aware-refresher')
    expect(wxml).not.toContain('<nav-aware-refresher')
    expect(wxml).not.toContain('refresher-enabled')
    expect(wxml).not.toContain('bindrefresherrefresh')
    expect(wxml).not.toContain('slot="refresher"')
  })

  it('uses a static search-results__content class with fixed bottom padding for the floating toolbar', () => {
    expect(wxml).not.toMatch(/search-results__content--(with-filters|toolbar-only)/)
    expect(wxss).toMatch(/\.search-results__content\s*\{[^}]*padding-bottom:\s*164rpx/s)
  })

  it('keeps keyboardHeight bound to shell padding and floating footer position', () => {
    expect(wxml).toContain(
      'style="padding-bottom: {{keyboardHeight > 0 ? keyboardHeight : 0}}px;"',
    )
    expect(wxml).toContain(
      'style="bottom: {{keyboardHeight > 0 ? keyboardHeight : 0}}px;"',
    )
  })

  it('delegates the list content block to the direct list-builder branch with full event surface', () => {
    expect(wxml).toContain('<list-builder')
    expect(wxml).toContain('class="memo-list memo-list-builder--scroll-root search-results__content"')
    expect(wxml).toContain('value="{{dateLabel}}"')
    expect(wxml).toContain('value="{{facetLabel}}"')
    expect(wxml).toContain('list="{{memoRenderCards}}"')
    expect(wxml).toContain('wx:if="{{item.tombstone}}"')
    expect(wxml).toContain('selected-tag="{{draft.selectedTag}}"')
    for (const binding of [
      'bind:clear="handleClearDate"',
      'bind:clear="handleClearFacet"',
      'bind:retry="handleRetryLoad"',
      'bind:tap="handleLoadMore"',
      'bind:tap="handleMemoCardTap"',
      'bind:edit="handleMemoEdit"',
      'bind:delete="handleMemoDelete"',
      'bind:modifytag="handleMemoModifyTag"',
      'bind:tagadd="handleMemoTagAdd"',
      'bind:tagremove="handleMemoTagRemove"',
      'bind:share="handleMemoShare"',
      'bind:copy="handleMemoCopy"',
      'bind:quote="handleMemoQuote"',
      'bind:referencetap="handleMemoReferenceTap"',
      'bind:tagtap="handleMemoTagTap"',
      'bind:menuopen="onCardMenuOpen"',
    ]) {
      expect(wxml).toContain(binding)
    }
  })

  it('does not embed the legacy memo-list-section wrapper or page-shell shell on the page itself', () => {
    expect(wxml).not.toContain('<memo-list-section')
    expect(wxml).not.toContain('<page-shell>')
  })

  it('handles parent-tag title menu selection on search page', () => {
    const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    expect(ts).toContain('isParentTagTitleMenuAction(id)')
    expect(ts).toContain('parentTagPath(this.data.draft.selectedTag)')
    expect(ts).toContain('this.syncDraft({ ...this.data.draft, selectedTag: parent })')
  })

  it('resolves self search nav title with logged-in user label when no tag is selected', () => {
    expect(ts).toContain('selfUserLabelForSearchNav')
    expect(ts).toContain('resolveHomeNavTitle(selectedTag, windowWidth, selfUserLabelForSearchNav())')
  })

  it('reuses the keyword-empty search guard for bind, refresh, and load-more paths', () => {
    const bindDraft = methodSource('bindDraftMemoList', 'updateEmptyState')
    const refresh = methodSource('refreshMemoList', 'handleKeywordInput')
    const loadMore = methodSource('loadMoreMemoList', 'handleMemoCardTap')

    expect(bindDraft).toContain('this.clearSearchMemoList()')
    expect(refresh).toContain('shouldSearchFromDraft(this.data.draft)')
    expect(refresh).toContain('this.clearSearchMemoList()')
    expect(refresh.indexOf('shouldSearchFromDraft(this.data.draft)')).toBeLessThan(
      refresh.indexOf('refreshFriendMemoList'),
    )
    expect(refresh.indexOf('shouldSearchFromDraft(this.data.draft)')).toBeLessThan(
      refresh.indexOf('workspaceStore.refreshMemoList'),
    )
    expect(loadMore).toContain('shouldSearchFromDraft(this.data.draft)')
    expect(loadMore.indexOf('shouldSearchFromDraft(this.data.draft)')).toBeLessThan(
      loadMore.indexOf('loadMoreFriendMemoList'),
    )
    expect(loadMore.indexOf('shouldSearchFromDraft(this.data.draft)')).toBeLessThan(
      loadMore.indexOf('workspaceStore.loadMoreMemoList'),
    )
  })

  it('routes memo copy through the shared clipboard helper', () => {
    const copy = methodSource('handleMemoCopy', 'handleMemoTagTap')

    expect(ts).toContain('copyMemoContentForCard')
    expect(copy).toContain('resetMemoCardTap(this)')
    expect(copy).toContain('copyMemoContentForCard(this.data.memoCards, memoId)')
    expect(copy).not.toContain('openMemoShareForCard')
  })
})
