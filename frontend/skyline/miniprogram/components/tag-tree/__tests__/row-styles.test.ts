import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')

describe('tag-tree row style contracts', () => {
  it('declares seven component-scoped --row-* variables with stable values', () => {
    expect(wxss).toMatch(/--row-lead-icon-size:\s*40rpx/)
    expect(wxss).toMatch(/--row-lead-icon-gap:\s*8rpx/)
    expect(wxss).toMatch(/--row-body-h-padding:\s*16rpx/)
    expect(wxss).toMatch(/--row-body-margin-end:\s*16rpx/)
    expect(wxss).toMatch(/--row-trailing-slot-width:\s*68rpx/)
    expect(wxss).toMatch(/--row-guide-slot-width:\s*40rpx/)
    expect(wxss).toMatch(/--row-outer-h-margin:\s*16rpx/)
  })

  it('keeps the all-notes alignment seam: first shortcut drops trailing padding', () => {
    expect(wxss).toMatch(
      /\.tag-tree__shortcut-wrap\s*>\s*\.tag-tree__shortcut:first-child\s*\{[^}]*padding-right:\s*0/,
    )
  })

  it('does NOT add margin-right to .tag-tree__tag-icon (tag rows rely on .__label padding)', () => {
    const marginGroup = wxss.match(
      /\.tag-tree__shortcut-icon[^{]*\.tag-tree__subitem-icon\s*\{[^}]*margin-right:[^}]*\}/,
    )
    expect(marginGroup, 'expected a merged margin-right group for shortcut-icon + subitem-icon only').not.toBeNull()
    expect(marginGroup?.[0] ?? '').not.toMatch(/\.tag-tree__tag-icon/)
  })

  it('does NOT regress to per-class duplicated trailing slot widths', () => {
    const trailingGroup = wxss.match(
      /\.tag-tree__action[\s\S]*?\.tag-tree__action-spacer[\s\S]*?\.tag-tree__menu-slot[\s\S]*?\.tag-tree__shortcut-expander\s*\{[^}]*\}/,
    )
    expect(trailingGroup, 'expected a merged group covering action / action-spacer / menu-slot / shortcut-expander').not.toBeNull()
    expect(trailingGroup?.[0] ?? '').toMatch(/width:\s*var\(--row-trailing-slot-width\)/)
  })

  it('gives lifted rows a restrained elevated surface for dark theme legibility', () => {
    const baseRule = wxss.match(/\.tag-tree__content\s*\{[\s\S]*?\}/)
    const liftedRule = wxss.match(
      /\.tag-tree__row--lifted \.tag-tree__content\s*\{[\s\S]*?\}/,
    )
    expect(baseRule, 'expected a base tag row content rule').not.toBeNull()
    expect(liftedRule, 'expected a lifted rule for the tag row body').not.toBeNull()
    expect(baseRule?.[0] ?? '').toMatch(/border:\s*1rpx solid transparent/)
    expect(liftedRule?.[0] ?? '').toMatch(/background-color:\s*var\(--color-bg-elevated\)/)
    expect(liftedRule?.[0] ?? '').toMatch(/border-color:\s*var\(--color-border\)/)
    expect(liftedRule?.[0] ?? '').toMatch(/transform:\s*translateY\(-2rpx\)\s*scale\(1\.02\)/)
  })

  it('keeps the light-theme lifted row outer shadow at the original strength', () => {
    const liftedRule = wxss.match(
      /\.tag-tree__row--lifted \.tag-tree__content\s*\{[\s\S]*?\}/,
    )
    expect(liftedRule, 'expected a lifted tag row content rule').not.toBeNull()
    expect(liftedRule?.[0] ?? '').toMatch(
      /box-shadow:\s*0 0 32rpx rgba\(0, 0, 0, 0\.12\),\s*0 16rpx 48rpx rgba\(0, 0, 0, 0\.18\)/,
    )
    expect(liftedRule?.[0] ?? '').not.toMatch(/box-shadow:[\s\S]*inset/)
  })

  it('places lifted rows above selected sibling rows so shadows stay visible', () => {
    const rowRule = wxss.match(/\.tag-tree__row\s*\{[\s\S]*?\}/)
    const liftedRowRules = [...wxss.matchAll(/\.tag-tree__row--lifted\s*\{[\s\S]*?\}/g)]
      .map((match) => match[0])
    expect(rowRule, 'expected a base tag row rule').not.toBeNull()
    expect(liftedRowRules.length, 'expected at least one lifted tag row rule').toBeGreaterThan(0)
    expect(rowRule?.[0] ?? '').toMatch(/position:\s*relative/)
    expect(rowRule?.[0] ?? '').toMatch(/z-index:\s*0/)
    expect(liftedRowRules.some((rule) => /z-index:\s*1/.test(rule))).toBe(true)
  })

  it('does not animate lifted row background or border colors to avoid transparent-color flicker', () => {
    const baseRule = wxss.match(/\.tag-tree__content\s*\{[\s\S]*?\}/)
    const liftedRule = wxss.match(
      /\.tag-tree__row--lifted \.tag-tree__content\s*\{[\s\S]*?\}/,
    )
    expect(baseRule, 'expected a base tag row content rule').not.toBeNull()
    expect(liftedRule, 'expected a lifted tag row content rule').not.toBeNull()
    expect(baseRule?.[0] ?? '').not.toMatch(/transition:[\s\S]*(background-color|border-color)/)
    expect(liftedRule?.[0] ?? '').not.toMatch(/transition:[\s\S]*(background-color|border-color)/)
  })
})
