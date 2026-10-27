import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const patternsPath = path.join(__dirname, '..', 'patterns.wxss')

describe('shared style primitive contract', () => {
  it('defines the shared ds-* primitives used by pages and apply-shared components', () => {
    const wxss = readFileSync(patternsPath, 'utf8')

    expect(wxss).toContain('.ds-surface-card')
    expect(wxss).toContain('border: 1rpx solid var(--surface-card-border);')
    expect(wxss).toContain('box-shadow: var(--surface-card-shadow);')
    expect(wxss).toContain('.ds-surface-floating')
    expect(wxss).toContain('.ds-surface-frosted')
    expect(wxss).toContain('.ds-page-inline-shell')
    expect(wxss).toContain('.ds-field-shell')
    expect(wxss).toContain('.ds-status-stack')
    expect(wxss).toContain('.ds-list-footer')
    expect(wxss).toContain('.ds-skeleton-card')
  })
})
