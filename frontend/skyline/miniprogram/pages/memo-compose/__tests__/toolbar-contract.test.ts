import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tsPath = path.join(__dirname, '..', 'index.ts')
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const wxssPath = path.join(__dirname, '..', 'index.wxss')
const debugWxssPath = path.join(__dirname, '..', 'memo-compose-toolbar-debug.wxss')
const toggleWxssPath = path.join(__dirname, '..', '..', '..', 'components', 'weimo-toggle-button', 'index.wxss')
const ts = readFileSync(tsPath, 'utf8')
const wxml = readFileSync(wxmlPath, 'utf8')
const wxss = readFileSync(wxssPath, 'utf8')
const debugWxss = existsSync(debugWxssPath) ? readFileSync(debugWxssPath, 'utf8') : ''
const toggleWxss = readFileSync(toggleWxssPath, 'utf8')

function expectToolbarButtonLabel(icon: string, label: string): void {
  const buttonPattern = new RegExp(`<weimo-toggle-button[\\s\\S]*?icon="${icon}"[\\s\\S]*?label="${label}"[\\s\\S]*?/>`)
  expect(wxml).toMatch(buttonPattern)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectDebugRuleUsesBoxShadow(selector: string): void {
  expect(debugWxss).toMatch(new RegExp(`${escapeRegExp(selector)}\\s*\\{[^}]*box-shadow\\s*:`))
}

describe('memo-compose markdown toolbar contract', () => {
  it('orders markdown toolbar: heading, list, quote, center', () => {
    expect(wxml).toContain('icon="page-head"')
    expect(wxml).toContain('selected="{{headingActive}}"')
    expect(wxml).toContain('ariaLabel="标题"')
    expect(wxml).toContain('bind:tap="handleHeadingTap"')
    expect(wxml.indexOf('handleHeadingTap')).toBeLessThan(wxml.indexOf('handleListTap'))
    expect(wxml.indexOf('handleListTap')).toBeLessThan(wxml.indexOf('handleQuoteTap'))
    expect(wxml.indexOf('handleQuoteTap')).toBeLessThan(wxml.indexOf('handleCenterQuoteTap'))
    expect(wxml).not.toContain('md-toolbar__sep')
    expect(wxml).not.toContain('handleBoldTap')
    expect(wxml).not.toContain('textformat-bold')
  })

  it('renders visible labels for each markdown toolbar toggle', () => {
    expectToolbarButtonLabel('page-head', '标题')
    expectToolbarButtonLabel('bulletpoint', '列表')
    expectToolbarButtonLabel('indent-right', '引用')
    expectToolbarButtonLabel('format-vertical-align-center', '居中')
  })

  it('ships compose-toolbar without debug class; debug wxss stays imported for optional dev overlay', () => {
    const debugImportIndex = wxss.indexOf("@import './memo-compose-toolbar-debug.wxss';")
    const firstRuleIndex = wxss.indexOf('page {')

    expect(wxml).toContain('class="compose-toolbar"')
    expect(wxml).not.toContain('compose-toolbar--debug')
    expect(debugImportIndex).toBeGreaterThanOrEqual(0)
    expect(debugImportIndex).toBeLessThan(firstRuleIndex)
    expect(debugWxss).toContain('.compose-toolbar--debug {')
    expect(debugWxss).toContain('.compose-toolbar--debug .md-toolbar {')
    expect(debugWxss).toContain('.compose-toolbar--debug .md-toolbar__sep {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-toggle-button {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button__icon {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button__label {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-icon-button {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-icon-button .weimo-icon-button {')
    expect(debugWxss).toContain('.compose-toolbar--debug weimo-icon-button .weimo-icon-button__icon {')
  })

  it('uses Skyline-supported box-shadow instead of outline for toolbar debug borders', () => {
    expect(debugWxss).not.toContain('outline')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug .md-toolbar')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug .md-toolbar__sep')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-toggle-button')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button__icon')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-toggle-button .weimo-toggle-button__label')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-icon-button')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-icon-button .weimo-icon-button')
    expectDebugRuleUsesBoxShadow('.compose-toolbar--debug weimo-icon-button .weimo-icon-button__icon')
  })

  it('keeps labeled toggle buttons compact and vertically arranged', () => {
    expect(toggleWxss).toMatch(
      /\.weimo-toggle-button\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*4rpx;/,
    )
    expect(toggleWxss).toMatch(
      /\.weimo-toggle-button\s*\{[\s\S]*width:\s*80rpx;[\s\S]*min-width:\s*80rpx;[\s\S]*height:\s*80rpx;/,
    )
    expect(toggleWxss).toMatch(/\.weimo-toggle-button__icon\s*\{[\s\S]*font-size:\s*38rpx;/)
    expect(toggleWxss).toMatch(
      /\.weimo-toggle-button__label\s*\{[\s\S]*font-size:\s*18rpx;[\s\S]*font-weight:\s*normal;[\s\S]*color:\s*var\(--color-text-placeholder\);[\s\S]*line-height:\s*24rpx;/,
    )
    expect(toggleWxss).toMatch(
      /\.weimo-toggle-button--selected \.weimo-toggle-button__label\s*\{[\s\S]*color:\s*var\(--color-heat-3\);/,
    )
  })

  it('lays out memo-compose md-toolbar with 8rpx gap and separator spacing from gap only', () => {
    expect(wxss).toMatch(/\.md-toolbar\s*\{[\s\S]*gap:\s*8rpx;[\s\S]*padding:\s*4rpx\s+12rpx;/)
    expect(wxss).not.toMatch(/\.md-toolbar weimo-toggle-button\s*\{/)
    expect(wxss).toMatch(/\.md-toolbar__sep\s*\{[\s\S]*width:\s*2rpx;[\s\S]*flex-shrink:\s*0;[\s\S]*background:/)
    expect(wxss).not.toMatch(/\.md-toolbar__sep\s*\{[\s\S]*margin-left:/)
  })

  it('does not render or wire the removed page-last cursor navigation control', () => {
    expect(wxml).not.toContain('icon="page-last"')
    expect(wxml).not.toContain('bind:tap="handleSkipRightTap"')
    expect(ts).not.toContain("import { computeSkipRightTarget } from './cursor-nav'")
    expect(ts).not.toContain('handleSkipRightTap')
    expect(ts).not.toContain('computeSkipRightTarget')
  })

  it('uses editor-formatting as the single source for production formatting logic', () => {
    expect(ts).toMatch(/from ['"]\.\/editor-formatting['"]/)
    expect(ts).not.toContain('editor-formatting (inlined')
    expect(ts).not.toMatch(/\bfunction\s+resolveToolbarState\s*\(/)
    expect(ts).not.toMatch(/\bfunction\s+toggleLinePrefixFormatting\s*\(/)
    expect(ts).toContain('headingActive: boolean')
    expect(ts).toContain('headingActive: false')
    expect(ts).toContain('handleHeadingTap: () => void')
    expect(ts).toContain('handleHeadingTap()')
    expect(ts).toContain('this.toggleLinePrefix(HEADING_PREFIX)')
  })

  it('recomputes headingActive with the other toolbar states', () => {
    expect(ts).toContain('const { headingActive, listActive, quoteActive, centerQuoteActive } = resolveToolbarState')
    expect(ts).toContain('if (headingActive !== this.data.headingActive) patch.headingActive = headingActive')
  })
})
