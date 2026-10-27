import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')

describe('page-nav-chrome contract', () => {
  it('wraps navigation-bar with shared transparent overlay markup', () => {
    expect(wxml).toContain(
      `class="page-nav-overlay__surface {{transparent ? 'page-nav-overlay__surface--hidden' : ''}}"`,
    )
    expect(wxml).toContain(
      `class="page-nav-overlay__status-mask {{transparent ? 'page-nav-overlay__status-mask--visible' : ''}}"`,
    )
    expect(wxml).toContain(
      `class="page-nav-overlay__content {{transparent ? 'page-nav-overlay__content--hidden' : ''}}"`,
    )
    expect(wxml).toMatch(/<navigation-bar[\s\S]*title="\{\{title\}\}"[\s\S]*bind:menu="handleMenu"/)
  })

  it('bridges left/center/right slots into the inner navigation-bar', () => {
    expect(wxml).toContain('<view slot="left"><slot name="left"></slot></view>')
    expect(wxml).toContain('<view slot="center"><slot name="center"></slot></view>')
    expect(wxml).toContain('<view slot="right"><slot name="right"></slot></view>')
  })

  it('owns the shared overlay and status-mask styles', () => {
    expect(wxss).toMatch(/\.page-nav-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*top:\s*0/s)
    expect(wxss).toMatch(
      /\.page-nav-overlay__surface\s*\{[\s\S]*background:\s*var\(--color-bg-(nav-bar|sidebar-panel)\)[\s\S]*border-bottom:\s*1rpx solid var\(--color-border-light\)[\s\S]*backdrop-filter:\s*blur\(var\(--blur-frosted\)\)[\s\S]*transform:\s*translateY\(0\) scale\(1\)[\s\S]*opacity 0\.2s ease-out[\s\S]*transform 0\.2s ease-out/s,
    )
    expect(wxss).toMatch(
      /\.page-nav-overlay__surface--hidden\s*\{[\s\S]*opacity:\s*0[\s\S]*border-bottom-color:\s*transparent[\s\S]*backdrop-filter:\s*none[\s\S]*translateY\(-60rpx\) scale\(0\.96\)/s,
    )
    expect(wxss).toMatch(/\.page-nav-overlay__status-mask\s*\{[\s\S]*linear-gradient\(/s)
    expect(wxss).toMatch(
      /\.page-nav-overlay__content--hidden\s*\{[\s\S]*opacity:\s*0[\s\S]*pointer-events:\s*none[\s\S]*translateY\(-60rpx\) scale\(0\.96\)/s,
    )
  })

  it('preserves navigation-bar default back behavior for pages that do not override it', () => {
    expect(ts).toMatch(/back:\s*\{[\s\S]*type:\s*Boolean,[\s\S]*value:\s*true/s)
  })
})
