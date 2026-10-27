import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const json = readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8')
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')

describe('friend-search layout contract', () => {
  it('uses a custom Skyline page with list scroll and floating search input', () => {
    expect(json).toContain('"navigationStyle": "custom"')
    expect(json).toContain('"disableScroll": true')
    expect(wxml).toContain('<navigation-bar title="添加朋友"')
    expect(wxml).toContain('class="friend-search-shell ds-page-inline-shell"')
    expect(wxml).toContain('scroll-y')
    expect(wxml).toContain('type="list"')
    expect(wxml).toContain('class="friend-search-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted"')
    expect(wxml).toContain('bindkeyboardheightchange="handleKeyboardHeightChange"')
    expect(wxss).toMatch(/\.friend-search-results-scroll\s*\{[^}]*flex:\s*1/s)
    expect(wxss).toMatch(/\.friend-search-toolbar\s*\{[^}]*position:\s*absolute/s)
  })

  it('renders avatar nickname and follow button per row', () => {
    expect(wxml).toContain('class="friend-search-result__avatar"')
    expect(wxml).toContain('{{item.user.nickname}}')
    expect(wxml).toContain('{{item.button.label}}')
    expect(wxml).toContain('bind:tap="handleFollowTap"')
  })
})
