import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const source = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')

describe('search page nav chrome contract', () => {
  it('reuses the shared nav chrome util instead of page-local thresholds', () => {
    expect(source).toContain(`from '../../utils/page-nav-chrome'`)
    expect(source).toContain('derivePageNavChromeTransparent')
    expect(source).toContain('resolvePageNavChromeMetrics')
    expect(source).toContain('navChromeTransparent')
    expect(source).toContain('navBarOverlayHeight')
    expect(source).toContain('navBarStatusMaskHeight')
    expect(source).toContain('_navChromeLastScrollTop')
  })
})
