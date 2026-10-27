import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const componentDir = path.join(__dirname, '..')
const ts = readFileSync(path.join(componentDir, 'index.ts'), 'utf8')
const wxml = readFileSync(path.join(componentDir, 'index.wxml'), 'utf8')

describe('weimo-popover-menu touch blocking contract', () => {
  it('swallows touchmove on the overlay and menu surface so open menus do not leak gestures to the page underneath', () => {
    expect(ts).toContain('handleTouchBlock()')
    expect(wxml).toContain('catch:touchmove="handleTouchBlock"')
    expect((wxml.match(/catch:touchmove="handleTouchBlock"/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
