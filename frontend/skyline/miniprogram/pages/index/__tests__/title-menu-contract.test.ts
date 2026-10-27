import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const tsPath = path.join(__dirname, '..', 'index.ts')

describe('index page title menu contract', () => {
  it('wires the merged single navigation bar to the shared title refresh menu exactly once', () => {
    const wxml = readFileSync(wxmlPath, 'utf8')

    const itemPropMatches = wxml.match(/title-menu-items="\{\{titleMenuItems\}\}"/g) ?? []
    const selectHandlerMatches = wxml.match(/bind:titlemenuselect="handleTitleMenuSelect"/g) ?? []
    const leadingIconMatches = wxml.match(/title-leading-icon="\{\{navBarTitleLeadingIcon\}\}"/g) ?? []

    expect(itemPropMatches).toHaveLength(1)
    expect(selectHandlerMatches).toHaveLength(1)
    expect(leadingIconMatches).toHaveLength(1)
  })

  it('delegates the list content block to the direct list-builder branch', () => {
    const wxml = readFileSync(wxmlPath, 'utf8')
    expect(wxml).toContain('<list-builder')
    expect(wxml).toContain('class="memo-list memo-list-builder--scroll-root"')
    expect(wxml).toContain('list="{{memoRenderCards}}"')
    expect(wxml).toContain('selected-tag="{{memoQuery.selectedTag}}"')
  })

  it('handles title menu actions for guest auth, tag navigation, memo sort, and refresh', () => {
    const ts = readFileSync(tsPath, 'utf8')

    expect(ts).toContain('buildIndexTitleMenuItems')
    expect(ts).toContain('isGuestAuthTitleMenuAction(id)')
    expect(ts).toContain('void openAuthPage({ allowBack: true })')
    expect(ts).toContain('isParentTagTitleMenuAction(id)')
    expect(ts).toContain('parentTagPath(this._strategy.getCurrentQuery(this.data).selectedTag)')
    expect(ts).toContain('this.applyCurrentScopeSelectedTag(parent)')
    expect(ts).toContain('isAllTagsTitleMenuAction(id)')
    expect(ts).toContain('this.clearSelectedTag()')
    expect(ts).toContain('isMemoSortNewestFirstTitleMenuAction(id)')
    expect(ts).toContain("void this.applyMemoCreatedAtSortChange('desc')")
    expect(ts).toContain('isMemoSortOldestFirstTitleMenuAction(id)')
    expect(ts).toContain("void this.applyMemoCreatedAtSortChange('asc')")
    expect(ts).toContain('isRefreshTitleMenuAction(id)')
    expect(ts).not.toContain('switchToFriendScope')
    expect(ts).not.toContain('switchToSelfScope')
  })
})
