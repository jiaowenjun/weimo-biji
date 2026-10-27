import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname, '..', '..')

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('page-level shared style primitive usage', () => {
  it('uses ds-page-inline-shell on search, compose, and tag-picker shells', () => {
    expect(read('pages/search/index.wxml')).toContain('class="search-shell ds-page-inline-shell"')
    expect(read('pages/memo-compose/index.wxml')).toContain(
      'class="compose-shell ds-page-inline-shell"',
    )
    expect(read('pages/memo-compose-tag-picker/index.wxml')).toContain(
      'class="picker-shell ds-page-inline-shell"',
    )
  })

  it('uses shared floating field primitives for search and tag-picker input shells', () => {
    expect(read('pages/search/index.wxml')).toContain(
      'class="search-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted"',
    )
    expect(read('pages/memo-compose-tag-picker/index.wxml')).toContain(
      'class="picker-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted"',
    )
  })

  it('uses shared card, skeleton, footer, and floating-action primitives on list pages', () => {
    expect(read('pages/index/index.wxml')).toContain(
      'class="memo-skeleton ds-surface-card ds-skeleton-card"',
    )
    expect(read('pages/index/index.wxml')).toContain('class="memo-list__footer ds-list-footer"')
    expect(read('pages/index/index.wxml')).toContain('<list-builder')
    expect(read('pages/index/index.wxml')).toContain(
      'class="memo-list memo-list-builder--scroll-root"',
    )
    expect(read('pages/search/index.wxml')).toContain('<list-builder')
    expect(read('pages/search/index.wxml')).toContain(
      'class="memo-list memo-list-builder--scroll-root search-results__content"',
    )
    expect(read('pages/index/index.wxml')).toContain(
      'class="fab ds-surface-floating ds-surface-frosted',
    )
  })

  it('keeps memo list styles in styles/ instead of a legacy unused component', () => {
    const memoListPath = path.join(root, 'styles/memo-list.wxss')
    const memoListStyles = existsSync(memoListPath) ? read('styles/memo-list.wxss') : ''

    expect(existsSync(memoListPath)).toBe(true)
    expect(memoListStyles).toContain('.memo-list-top-gap')
    expect(read('pages/index/index.wxss')).toContain("@import '../../styles/memo-list.wxss';")
    expect(read('pages/search/index.wxss')).toContain("@import '../../styles/memo-list.wxss';")
    expect(existsSync(path.join(root, 'components/memo-list-section/index.wxml'))).toBe(false)
    expect(existsSync(path.join(root, 'components/memo-list-section/index.ts'))).toBe(false)
  })
})
