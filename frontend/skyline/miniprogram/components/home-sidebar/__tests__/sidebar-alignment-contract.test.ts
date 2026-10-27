import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const homeWxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const homeWxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')
const homeTs = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
const tagTreeWxss = readFileSync(
  path.join(__dirname, '..', '..', 'tag-tree', 'index.wxss'),
  'utf8',
)

describe('home-sidebar horizontal alignment contract', () => {
  it('derives header and tag-tree edge insets from the heatmap grid edge', () => {
    expect(homeTs).toContain('const HEATMAP_VISIBLE_EDGE_INSET_RPX = 47')
    expect(homeTs).toContain('const SIDEBAR_HEADER_LEFT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX')
    expect(homeTs).toContain(
      'const SIDEBAR_HEADER_RIGHT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 14',
    )
    expect(homeTs).toContain(
      'const TAG_TREE_LEFT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 32',
    )
    expect(homeTs).toContain(
      'const TAG_TREE_RIGHT_INSET_RPX = HEATMAP_VISIBLE_EDGE_INSET_RPX - 30',
    )
    expect(homeWxml).toContain('style="{{headerStyle}}"')
    expect(homeWxml).toContain('style="{{tagTreeStyle}}"')
    expect(homeWxss).toContain('.sidebar-header {')
    expect(homeWxss).toContain('padding: 0;')
    expect(tagTreeWxss).toContain(
      'padding: 16rpx var(--tag-tree-edge-right-rpx) calc(env(safe-area-inset-bottom) + 16rpx) var(--tag-tree-edge-left-rpx);',
    )
    expect(tagTreeWxss).toContain('--tag-tree-edge-left-rpx')
    expect(tagTreeWxss).toContain('--tag-tree-edge-right-rpx')
  })

  it('gates sidebar vertical scrolling while a tag menu is opening or open', () => {
    expect(homeTs).toContain('tagMenuActive: false')
    expect(homeTs).toContain('tagMenuGestureGateActive: false')
    expect(homeTs).toContain('handleTagTreeMenuChange(')
    expect(homeTs).toContain('handleTagTreeGestureGateChange(')
    expect(homeWxml).toContain('scroll-y="{{!tagMenuActive && !tagMenuGestureGateActive}}"')
    expect(homeWxml).toContain('bind:menuchange="handleTagTreeMenuChange"')
    expect(homeWxml).toContain('bind:gesturegatechange="handleTagTreeGestureGateChange"')
  })
})
