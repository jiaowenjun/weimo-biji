import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname, '..', '..')

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('shared style primitive usage in core components', () => {
  it('routes empty and error states through ds-status-stack', () => {
    expect(read('components/empty-state/empty-state.wxml')).toContain(
      'class="empty-state ds-status-stack"',
    )
    expect(read('components/error-state/error-state.wxml')).toContain(
      'class="error-state ds-status-stack"',
    )
  })

  it('routes memo-card and popover menu surfaces through shared ds classes', () => {
    expect(read('components/memo-card/index.wxml')).toContain(
      'class="memo-card ds-surface-card',
    )
    expect(read('components/weimo-popover-menu/index.wxml')).toContain(
      'class="weimo-popover-menu ds-surface-floating',
    )
    expect(read('components/weimo-popover-menu/index.wxml')).toContain(
      `{{visible ? 'ds-surface-frosted weimo-popover-menu--active' : ''}}`,
    )
  })

  it('tokenizes shared button and page-shell dimensions', () => {
    const buttonWxss = read('components/weimo-button/index.wxss')
    const pageShellWxss = read('components/page-shell/page-shell.wxss')

    expect(buttonWxss).toContain('height: var(--control-height-lg);')
    expect(buttonWxss).toContain('height: var(--control-height-xs);')
    expect(pageShellWxss).toContain(
      'height: calc(env(safe-area-inset-bottom) + var(--page-shell-safe-bottom-space));',
    )
  })
})
