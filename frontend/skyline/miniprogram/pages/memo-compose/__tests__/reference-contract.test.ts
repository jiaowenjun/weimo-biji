import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tsPath = path.join(__dirname, '..', 'index.ts')
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const wxssPath = path.join(__dirname, '..', 'index.wxss')
const refInlineWxssPath = path.join(__dirname, '..', '..', '..', 'styles', 'memo-reference-inline.wxss')
const ts = readFileSync(tsPath, 'utf8')
const wxml = readFileSync(wxmlPath, 'utf8')
const wxss = readFileSync(wxssPath, 'utf8')
const refInlineWxss = readFileSync(refInlineWxssPath, 'utf8')

describe('memo-compose reference contract', () => {
  it('opens the references-only detail modal from the edit reference bar', () => {
    expect(ts).toContain("import { openMemoComposeTagPicker, openMemoReferenceList, openMemoReferences } from '../../utils/navigation'")
    expect(ts).toContain('handleReferenceTap: () => void')
    expect(ts).toContain('handleReferenceTap()')
    expect(ts).toContain('openMemoReferences(this.data.memoId)')
    expect(ts).toContain("openMemoReferenceList(this.data.refs, { routeType: 'cupertino-inside' })")
    expect(wxml).toContain('catch:tap="handleReferenceTap"')
  })

  it('keeps refs and referenceId in page data', () => {
    expect(ts).toContain('refs: MemoRefId[]')
    expect(ts).toContain('referenceId: MemoRefId | null')
    expect(ts).toContain('referencePreviewText: string')
    expect(ts).toContain('refs: [] as MemoRefId[]')
    expect(ts).toContain('referenceId: null as MemoRefId | null')
    expect(ts).toContain("referencePreviewText: ''")
  })

  it('initializes refs from MemoComposeInitPayload', () => {
    expect(ts).toContain('const refs = Array.isArray(payload.initialRefs) ? [...payload.initialRefs] : []')
    expect(ts).toContain("const referencePreviewText = refs[0] != null ? payload.initialReferencePreview || `笔记${refs[0]}` : ''")
    expect(ts).toContain('referenceId: refs[0] ?? null')
    expect(ts).toContain('referencePreviewText')
  })

  it('uses 编辑 for edit pages and 批注 only for create pages with refs', () => {
    expect(ts).toContain('pageTitle: string')
    expect(ts).toContain("pageTitle: '新建'")
    expect(ts).toContain("const pageTitle = mode === 'edit' ? '编辑' : query.quote === '1' ? '批注' : '新建'")
    expect(ts).toContain("pageTitle: payload.mode === 'edit' ? '编辑' : refs.length > 0 ? '批注' : '新建'")
    expect(ts).not.toMatch(/payload\.mode === 'edit'[\s\S]*refs\.length > 0 \? '批注' : '编辑'/)
  })

  it('renders the same floating transparent nav structure as the tag picker', () => {
    expect(wxml.trimStart().startsWith('<navigation-bar')).toBe(false)
    expect(wxml).toContain('class="memo-compose-nav-overlay"')
    expect(wxml).toContain('class="memo-compose-nav-mask"')
    expect(wxml).toContain('background="transparent"')
    expect(wxml).toContain('back="{{false}}"')
    expect(wxml).toContain('class="memo-compose-nav-back-slot"')
    expect(wxml).toContain('icon="chevron-left"')
    expect(wxml).toContain('variant="glass"')
    expect(wxml).toContain('feedbackStyle="nav-glass"')
    expect(wxml).toContain('size="md"')
    expect(wxml).toContain('bind:tap="handleBack"')
    expect(wxml).toContain('padding-top: {{navOverlayHeight}}px;')
    expect(wxml).toContain('padding-bottom: {{keyboardHeight > 0 ? keyboardHeight : safeAreaBottom}}px;')
  })

  it('computes overlay layout metrics in page state', () => {
    expect(ts).toContain("import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'")
    expect(ts).toContain("import { applyNavStatusBarStyle } from '../../utils/theme'")
    expect(ts).toContain('navOverlayHeight: number')
    expect(ts).toContain('navStatusMaskHeight: number')
    expect(ts).toContain('navOverlayHeight: 0')
    expect(ts).toContain('navStatusMaskHeight: 0')
    expect(ts).toContain('const capsuleRect = wx.getMenuButtonBoundingClientRect()')
    expect(ts).toContain('const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })')
    expect(ts).toContain('navOverlayHeight: compactNavLayout.overlayHeight')
    expect(ts).toContain('navStatusMaskHeight = statusBarHeight || capsuleRect.top')
    expect(ts).toContain('applyNavStatusBarStyle()')
  })

  it('sends refs in create and edit save payloads', () => {
    expect(ts).toContain('refs: [...this.data.refs]')
    expect(ts).toContain('workspaceStore.createMemo({ content: markdownCompatTextToWdfDocument(trimmed), tags, refs: [...this.data.refs] })')
    expect(ts).toContain('workspaceStore.updateMemo(memoId, { content: markdownCompatTextToWdfDocument(trimmed), tags, refs: [...this.data.refs] })')
  })

  it('renders the reference bar below the tag row only when referenceId exists', () => {
    expect(wxml).toContain('<view wx:if="{{referenceId !== null}}" class="editor-reference" catch:tap="handleReferenceTap">')
    expect(wxml).toContain('iconfont--arrow-left-up-circle-filled')
    expect(wxml).toContain(
      '<text class="memo-reference-inline__text" overflow="ellipsis" max-lines="1">{{referencePreviewText}}</text>',
    )
    expect(wxml).not.toContain('引用：')
    expect(wxml).not.toContain('引用：{{referenceId}}')
    expect(wxml.indexOf('class="editor-tags"')).toBeLessThan(wxml.indexOf('class="editor-reference"'))
  })

  it('styles the reference bar with compact secondary text', () => {
    expect(wxss).toMatch(/@import\s+'\.\.\/\.\.\/styles\/memo-reference-inline\.wxss';/)
    expect(wxss).toMatch(/\.editor-reference\s*\{[\s\S]*display:\s*flex[\s\S]*margin-top:\s*var\(--spacing-md\)/s)
    expect(refInlineWxss).toMatch(
      /\.memo-reference-inline__icon\s*\{[\s\S]*font-size:\s*var\(--font-size-sm\)[\s\S]*color:\s*var\(--color-text-placeholder\)/s,
    )
    expect(refInlineWxss).toMatch(
      /\.memo-reference-inline__text\s*\{[\s\S]*font-size:\s*var\(--font-size-sm\)[\s\S]*color:\s*var\(--color-text-placeholder\)/s,
    )
    expect(refInlineWxss).toMatch(
      /\.memo-reference-inline__text\s*\{[\s\S]*white-space:\s*nowrap[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis/s,
    )
  })

  it('styles the overlay nav and gradient mask for skyline layout', () => {
    expect(wxss).toMatch(/\.compose-shell\s*\{[\s\S]*position:\s*relative/s)
    expect(wxss).toMatch(/\.compose-shell\s*\{[\s\S]*display:\s*flex/s)
    expect(wxss).toMatch(/\.compose-shell\s*\{[\s\S]*flex-direction:\s*column/s)
    expect(wxss).toMatch(/\.compose-shell\s*\{[\s\S]*overflow:\s*visible/s)
    expect(wxss).toMatch(
      /\.memo-compose-nav-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*z-index:\s*5[\s\S]*pointer-events:\s*none/s,
    )
    expect(wxss).toMatch(
      /\.memo-compose-nav-overlay\s*\{[\s\S]*left:\s*calc\(0rpx - var\(--page-inline-shell-margin\)\)/s,
    )
    expect(wxss).toMatch(
      /\.memo-compose-nav-mask\s*\{[\s\S]*linear-gradient\([\s\S]*--color-nav-status-mask-start[\s\S]*--color-nav-status-mask-mid[\s\S]*--color-nav-status-mask-end/s,
    )
    expect(wxss).toMatch(/\.memo-compose-nav-overlay \.weui-navigation-bar\s*\{[\s\S]*overflow:\s*visible/s)
  })
})
