import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const stylesRoot = path.join(__dirname, '..')
const miniprogramRoot = path.join(__dirname, '..', '..')

const memoMarkdownWxss = readFileSync(path.join(stylesRoot, 'memo-markdown.wxss'), 'utf8')
const memoShareImageWxss = readFileSync(path.join(miniprogramRoot, 'pages', 'memo-share-image', 'index.wxss'), 'utf8')

describe('memo markdown heading styles', () => {
  it('centers headings and uses the memo body text color', () => {
    expect(memoMarkdownWxss).toMatch(
      /\.memo-markdown__heading\s*\{[^}]*color:\s*var\(--color-text-primary\);[^}]*text-align:\s*center;/,
    )
  })

  it('uses body-sized bold h1 headings', () => {
    expect(memoMarkdownWxss).toMatch(
      /\.memo-markdown__heading\s*\{[^}]*font-weight:\s*650;/,
    )
    expect(memoMarkdownWxss).toMatch(
      /\.memo-markdown__heading--h1\s*\{[^}]*font-size:\s*var\(--font-size-base\);[^}]*line-height:\s*var\(--line-height-reading\);/,
    )
  })

  it('keeps share large-text h1 aligned with the large body size', () => {
    expect(memoShareImageWxss).toMatch(
      /\.memo-share-paper--large-text \.memo-markdown__heading--h1\s*\{[^}]*font-size:\s*var\(--font-size-md\);/,
    )
  })

  it('justifies markdown paragraphs and share-page body text', () => {
    expect(memoMarkdownWxss).toMatch(
      /\.memo-markdown__p\s*\{[^}]*text-align:\s*justify;[^}]*text-justify:\s*inter-ideograph;/,
    )
    expect(memoShareImageWxss).toMatch(
      /\.memo-share-paper__rich,\s*\.memo-share-paper__plain\s*\{[\s\S]*text-align:\s*justify;[\s\S]*text-justify:\s*inter-ideograph;/,
    )
  })

  it('keeps paragraph-to-blockquote spacing at 1em in shared markdown styles', () => {
    expect(memoMarkdownWxss).toMatch(
      /\.memo-markdown__p\+\.memo-markdown__p,[\s\S]*?\.memo-markdown__blockquote\+\.memo-markdown__list\s*\{[^}]*margin-top:\s*1em;/,
    )
    expect(memoMarkdownWxss).not.toMatch(
      /\.memo-markdown__p\+\.memo-markdown__blockquote,\s*\.memo-markdown__blockquote\+\.memo-markdown__p\s*\{[^}]*margin-top:\s*var\(--spacing-sm\);/,
    )
  })
})
