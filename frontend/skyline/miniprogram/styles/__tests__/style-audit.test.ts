import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname, '..', '..')

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function collectWxssFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectWxssFiles(absolutePath))
      continue
    }
    if (entry.isFile() && absolutePath.endsWith('.wxss')) {
      results.push(absolutePath)
    }
  }

  return results
}

describe('style audit', () => {
  it('keeps the full floating-panel recipe only inside shared patterns.wxss', () => {
    const targets = [
      'pages/index/index.wxss',
      'pages/search/index.wxss',
      'pages/memo-compose/index.wxss',
      'pages/memo-compose-tag-picker/index.wxss',
      'components/weimo-icon-button/index.wxss',
      'components/weimo-chip/index.wxss',
      'components/weimo-popover-menu/index.wxss',
    ]

    for (const target of targets) {
      const wxss = read(target)

      expect(wxss).not.toContain('background: var(--color-bg-floating-panel);')
      expect(wxss).not.toContain('backdrop-filter: blur(var(--blur-frosted));')
      expect(wxss).not.toContain('box-shadow: var(--shadow-float-elevated);')
    }
  })

  it('removes raw brand-transparent and generic hover rgba values from feature files', () => {
    const targets = [
      'pages/index/index.wxss',
      'components/weimo-icon-button/index.wxss',
      'components/weimo-popover-menu/index.wxss',
      'components/weimo-toggle-button/index.wxss',
    ]

    for (const target of targets) {
      const wxss = read(target)

      expect(wxss).not.toContain('rgba(250, 236, 229, 0)')
      expect(wxss).not.toContain('rgba(58, 42, 32, 0)')
      expect(wxss).not.toContain('rgba(255, 255, 255, 0.55)')
      expect(wxss).not.toContain('rgba(255, 255, 255, 0.22)')
    }
  })

  it('keeps motion var() timing out of runtime wxss transitions until Skyline proves it safe', () => {
    const wxssFiles = collectWxssFiles(root)

    for (const absolutePath of wxssFiles) {
      const wxss = readFileSync(absolutePath, 'utf8')

      expect(wxss).not.toContain('var(--motion-duration')
      expect(wxss).not.toContain('var(--motion-ease')
    }
  })

  it('keeps memo share tag chips height-stable for snapshot emoji rendering', () => {
    const wxss = read('pages/memo-share-image/index.wxss')

    expect(wxss).toContain('.memo-share-paper__tags weimo-chip .weimo-chip {')
    expect(wxss).toContain('height: 38rpx;')
    expect(wxss).toContain('overflow: hidden;')
    expect(wxss).toContain('.memo-share-paper__tags weimo-chip .weimo-chip.weimo-chip--size-sm {')
    expect(wxss).toContain('height: 44rpx;')
  })
})
