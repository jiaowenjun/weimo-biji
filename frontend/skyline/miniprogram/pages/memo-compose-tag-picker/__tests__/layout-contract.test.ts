import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxmlPath = path.join(__dirname, '..', 'index.wxml')
const wxssPath = path.join(__dirname, '..', 'index.wxss')
const wxml = readFileSync(wxmlPath, 'utf8')
const wxss = readFileSync(wxssPath, 'utf8')

describe('memo-compose-tag-picker layout contract', () => {
  it('uses shared primitive classes for the shell and floating field shell', () => {
    expect(wxml).toContain('class="picker-shell ds-page-inline-shell"')
    expect(wxml).toContain(
      'class="picker-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted"',
    )
  })

  it('moves navigation into a transparent overlay and replaces default back with a glass icon button', () => {
    expect(wxml.trimStart().startsWith('<navigation-bar')).toBe(false)
    expect(wxml).toContain('class="tag-picker-nav-overlay"')
    expect(wxml).toContain('class="tag-picker-nav-mask"')
    expect(wxml).toContain('style="height: {{navStatusMaskHeight}}px;"')
    expect(wxml).toContain('background="transparent"')
    expect(wxml).toContain('back="{{false}}"')
    expect(wxml).toContain('class="tag-picker-nav-back-slot"')
    expect(wxml).toContain('slot="left"')
    expect(wxml).toContain('icon="chevron-left"')
    expect(wxml).toContain('variant="glass"')
    expect(wxml).toContain('feedbackStyle="nav-glass"')
    expect(wxml).toContain('size="md"')
    expect(wxml).toContain('bind:tap="handleClose"')
  })

  it('keeps a buffered list content container under the floating toolbar', () => {
    expect(wxml).toContain('class="tag-list-scroll__content"')
    expect(wxml).toContain('style="padding-top: {{navOverlayHeight}}px;"')
  })

  it('keeps shell, scroll, and overlay pinned for full-height floating navigation', () => {
    expect(wxss).toMatch(
      /\.picker-shell\.ds-page-inline-shell\s*\{[^}]*position:\s*relative[^}]*padding-top:\s*0[^}]*overflow:\s*visible/s,
    )
    expect(wxss).toMatch(/\.tag-list-scroll\s*\{[^}]*height:\s*100%/s)
    expect(wxss).toMatch(
      /\.tag-picker-nav-overlay\s*\{[^}]*position:\s*absolute[^}]*top:\s*0[^}]*z-index:\s*5[^}]*pointer-events:\s*none/s,
    )
    expect(wxss).toMatch(
      /\.tag-picker-nav-overlay\s+\.weui-navigation-bar\s*\{[^}]*overflow:\s*visible/s,
    )
    expect(wxss).toMatch(
      /\.tag-picker-nav-mask\s*\{[^}]*pointer-events:\s*none[^}]*linear-gradient\([^}]*var\(--color-nav-status-mask-start\)[^}]*var\(--color-nav-status-mask-mid\)[^}]*var\(--color-nav-status-mask-end\)/s,
    )
  })

  it('keeps keyboardHeight bound to shell padding and toolbar position', () => {
    expect(wxml).toContain(
      'style="padding-bottom: {{keyboardHeight > 0 ? keyboardHeight : 0}}px;"',
    )
    expect(wxml).toContain(
      'style="bottom: {{keyboardHeight > 0 ? keyboardHeight : 0}}px;"',
    )
  })
})
