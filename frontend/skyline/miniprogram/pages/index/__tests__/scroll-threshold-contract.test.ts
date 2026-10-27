import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const indexNavChromeStatePath = path.join(__dirname, '..', 'nav-chrome-state.ts')

describe('index page scroll threshold contract', () => {
  it('routes index nav chrome logic through the shared util', () => {
    const source = readFileSync(indexNavChromeStatePath, 'utf8')

    expect(source).toContain(`from '../../utils/page-nav-chrome'`)
    expect(source).toContain('derivePageNavChromeTransparent')
    expect(source).toContain('PAGE_NAV_CHROME_TOP_EPS')
  })
})
