import { describe, expect, it } from 'vitest'
import { renderMemoMarkdownToHtml, renderMemoMarkdownToNodes } from '../memo-markdown'

describe('renderMemoMarkdownToHtml', () => {
  it('renders inline bold inside a single paragraph (no block split)', () => {
    const html = renderMemoMarkdownToHtml('正文**粗体**正文')
    expect(html).toBe(
      '<p class="memo-markdown__p">正文<strong class="memo-markdown__strong">粗体</strong>正文</p>',
    )
  })

  it('renders first-level headings with memo heading classes', () => {
    const html = renderMemoMarkdownToHtml('# 标题')

    expect(html).toBe(
      '<h1 class="memo-markdown__heading memo-markdown__heading--h1">标题</h1>',
    )
  })

  it('renders inline strong inside first-level headings', () => {
    const html = renderMemoMarkdownToHtml('# **标题**')

    expect(html).toBe(
      '<h1 class="memo-markdown__heading memo-markdown__heading--h1"><strong class="memo-markdown__strong">标题</strong></h1>',
    )
  })

  it('renders first-level headings as rich-text nodes', () => {
    const nodes = renderMemoMarkdownToNodes('# 标题')

    expect(nodes).toEqual([
      {
        name: 'h1',
        attrs: { class: 'memo-markdown__heading memo-markdown__heading--h1' },
        children: [{ type: 'text', text: '标题' }],
      },
    ])
  })

  it('places heading immediately before centered blockquote (no spacer paragraph)', () => {
    const md = '## 赠卫八处士\n\n>= 杜甫\n\n正文一段'
    const nodes = renderMemoMarkdownToNodes(md)
    expect(nodes).toHaveLength(3)
    expect((nodes[0] as { name: string }).name).toMatch(/^h[1-6]$/)
    const q = nodes[1] as { name: string; attrs?: { class?: string } }
    expect(q.name).toBe('div')
    expect(q.attrs?.class ?? '').toContain('memo-markdown__blockquote')
  })

  it('renders unordered lists as block items with inline bullet markers', () => {
    const html = renderMemoMarkdownToHtml('- a\n- b')
    expect(html).toBe(
      '<div class="memo-markdown__list memo-markdown__list--ul"><div class="memo-markdown__list-item">• a</div><div class="memo-markdown__list-item">• b</div></div>',
    )
  })

  it('renders ordered lists as block items with inline numbers', () => {
    const html = renderMemoMarkdownToHtml('1. a\n2. b')
    expect(html).toBe(
      '<div class="memo-markdown__list memo-markdown__list--ol"><div class="memo-markdown__list-item">1. a</div><div class="memo-markdown__list-item">2. b</div></div>',
    )
  })
})
