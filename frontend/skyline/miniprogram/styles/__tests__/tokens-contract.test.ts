import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tokensPath = path.join(__dirname, '..', 'tokens.wxss')
const appPath = path.join(__dirname, '..', '..', 'app.wxss')

describe('design token contract', () => {
  it('keeps tokens.wxss as the single source of shared style values', () => {
    const wxss = readFileSync(tokensPath, 'utf8')

    expect(wxss).toContain('--spacing-md: 26rpx;')
    expect(wxss).toContain('--color-bg-page: #f6f4f1;')
    expect(wxss).toContain('--color-nav-status-mask-start: rgba(246, 244, 241, 0);')
    expect(wxss).toContain('--color-nav-status-mask-mid: rgba(246, 244, 241, 0.7);')
    expect(wxss).toContain('--color-nav-status-mask-end: rgba(246, 244, 241, 0.9);')
    expect(wxss).toContain('--surface-card-bg:')
    expect(wxss).toContain('--surface-card-radius:')
    expect(wxss).toContain('--surface-card-border:')
    expect(wxss).toContain('--surface-card-shadow:')
    expect(wxss).toContain('--surface-card-shadow: none;')
    expect(wxss).toContain('--control-height-xs:')
    expect(wxss).toContain('--control-height-input:')
    expect(wxss).toContain('--control-height-toolbar:')
    expect(wxss).toContain('--floating-toolbar-input-shell-height:')
    expect(wxss).toContain('--icon-button-size-lg:')
    expect(wxss).toContain('--floating-action-size:')
    expect(wxss).toContain('--sidebar-panel-width:')
    expect(wxss).toContain('--sidebar-row-height:')
    expect(wxss).toContain('--state-stack-padding-y:')
    expect(wxss).toContain('--line-height-reading:')
    expect(wxss).toContain('--color-menu-trigger-highlight-bg:')
    expect(wxss).toContain('--color-brand-ghost-transparent:')
    expect(wxss).toContain('--color-pressable-hover:')
    expect(wxss).toContain('--color-nav-status-mask-start:')
    expect(wxss).toContain('--color-nav-status-mask-mid:')
    expect(wxss).toContain('--color-nav-status-mask-end:')
    expect(wxss).toContain('--color-highlight:')
  })

  it('loads patterns.wxss from app.wxss so ds-* classes are globally available', () => {
    const appWxss = readFileSync(appPath, 'utf8')

    expect(appWxss).toContain(`@import './styles/patterns.wxss';`)
  })
})
