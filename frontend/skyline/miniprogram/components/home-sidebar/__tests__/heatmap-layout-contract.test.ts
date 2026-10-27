import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')
const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')

describe('home-sidebar heatmap layout contract', () => {
  it('drives the heatmap gap from one shared constant across width and styles', () => {
    expect(ts).toContain('const HEATMAP_GAP_RPX = 8')
    expect(ts).toContain('const HEATMAP_CELL_SIZE_RPX = 30')
    expect(ts).toContain(
      'columns.length * HEATMAP_CELL_SIZE_RPX + (columns.length - 1) * HEATMAP_GAP_RPX',
    )
    expect(ts).toContain('heatmapGapRpx')
    expect(wxml).toContain('--heatmap-gap-rpx: {{heatmapGapRpx}}rpx')
    expect(wxss).toContain('margin-right: var(--heatmap-gap-rpx);')
    expect(wxss).toContain('margin-bottom: var(--heatmap-gap-rpx);')
    expect(wxss).toContain('margin-top: var(--heatmap-gap-rpx);')
  })
})
