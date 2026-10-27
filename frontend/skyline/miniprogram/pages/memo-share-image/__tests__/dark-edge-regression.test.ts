import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for docs/20260502/d-memo-share-image-report.md §9:
 * Skyline snapshot 导出的 PNG 右侧会出现 1px 透明/白线，暗色主题下尤其明显。
 * 修复方案是 .memo-share-paper 上的右侧覆盖条，纸面变背景、超出 8rpx、宽 16rpx。
 * host / snapshot 节点设背景、snapshot 内加底板都已被实机验证无效，不要再绕回那条路。
 */
describe('memo-share-image dark-mode edge regression', () => {
  const wxml = readFileSync(path.join(__dirname, '../index.wxml'), 'utf8')
  const wxss = readFileSync(path.join(__dirname, '../index.wxss'), 'utf8')

  it('renders the edge-cover overlay inside every shared paper', () => {
    expect(wxml).toContain('<view class="memo-share-paper__edge-cover"')
  })

  it('anchors the paper relatively so the edge-cover can overflow its right edge', () => {
    expect(wxss).toMatch(/\.memo-share-paper\s*\{[^}]*position:\s*relative;/)
  })

  it('positions the cover 8rpx past the right edge, 16rpx wide, same surface color', () => {
    const block = wxss.match(/\.memo-share-paper__edge-cover\s*\{[^}]*\}/)?.[0] ?? ''
    expect(block).toContain('right: -8rpx;')
    expect(block).toContain('width: 16rpx;')
    expect(block).toContain('background: var(--memo-share-paper-surface)')
  })
})
