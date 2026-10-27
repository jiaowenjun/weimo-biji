import { describe, expect, it } from 'vitest'
import {
  highlightMemoHtml,
  memoShareRichTextNodesContainSearchMark,
  stripMemoHighlight,
} from '../memo-highlight'

describe('highlightMemoHtml', () => {
  it('returns html unchanged when keyword is empty', () => {
    const html = '<p class="memo-markdown__p">hello world</p>'
    expect(highlightMemoHtml(html, '')).toBe(html)
  })

  it('highlights Chinese keyword', () => {
    const html = '<p class="memo-markdown__p">今天天气不错</p>'
    expect(highlightMemoHtml(html, '天气')).toBe(
      '<p class="memo-markdown__p">今天<mark class="memo-markdown__mark">天气</mark>不错</p>',
    )
  })

  it('highlights English keyword case-insensitively preserving original case', () => {
    const html = '<p class="memo-markdown__p">Hello World hello</p>'
    expect(highlightMemoHtml(html, 'hello')).toBe(
      '<p class="memo-markdown__p"><mark class="memo-markdown__mark">Hello</mark> World <mark class="memo-markdown__mark">hello</mark></p>',
    )
  })

  it('highlights full phrase without splitting on spaces', () => {
    const html = '<p class="memo-markdown__p">say hello world today</p>'
    expect(highlightMemoHtml(html, 'hello world')).toBe(
      '<p class="memo-markdown__p">say <mark class="memo-markdown__mark">hello world</mark> today</p>',
    )
  })

  it('escapes regex special characters in keyword', () => {
    const html = '<p class="memo-markdown__p">costs $100.00 total</p>'
    expect(highlightMemoHtml(html, '$100.00')).toBe(
      '<p class="memo-markdown__p">costs <mark class="memo-markdown__mark">$100.00</mark> total</p>',
    )
  })

  it('handles c++ as keyword', () => {
    const html = '<p class="memo-markdown__p">learning c++ basics</p>'
    expect(highlightMemoHtml(html, 'c++')).toBe(
      '<p class="memo-markdown__p">learning <mark class="memo-markdown__mark">c++</mark> basics</p>',
    )
  })

  it('skips matches inside HTML tags and attributes', () => {
    const html = '<a class="memo-markdown__link" href="https://hello.com">visit hello</a>'
    expect(highlightMemoHtml(html, 'hello')).toBe(
      '<a class="memo-markdown__link" href="https://hello.com">visit <mark class="memo-markdown__mark">hello</mark></a>',
    )
  })

  it('does not match keyword spanning across tag boundaries', () => {
    const html = '<strong class="memo-markdown__strong">hel</strong>lo world'
    expect(highlightMemoHtml(html, 'hello')).toBe(
      '<strong class="memo-markdown__strong">hel</strong>lo world',
    )
  })

  it('highlights multiple occurrences', () => {
    const html = '<p class="memo-markdown__p">foo bar foo baz foo</p>'
    expect(highlightMemoHtml(html, 'foo')).toBe(
      '<p class="memo-markdown__p"><mark class="memo-markdown__mark">foo</mark> bar <mark class="memo-markdown__mark">foo</mark> baz <mark class="memo-markdown__mark">foo</mark></p>',
    )
  })

  it('preserves complex markdown structure', () => {
    const html =
      '<p class="memo-markdown__p"><strong class="memo-markdown__strong">bold</strong> and <code class="memo-markdown__code memo-markdown__code--inline">code</code> text</p>'
    expect(highlightMemoHtml(html, 'text')).toBe(
      '<p class="memo-markdown__p"><strong class="memo-markdown__strong">bold</strong> and <code class="memo-markdown__code memo-markdown__code--inline">code</code> <mark class="memo-markdown__mark">text</mark></p>',
    )
  })

  it('does not highlight inside class attribute values', () => {
    const html = '<p class="memo-markdown__p">memo content</p>'
    expect(highlightMemoHtml(html, 'memo')).toBe(
      '<p class="memo-markdown__p"><mark class="memo-markdown__mark">memo</mark> content</p>',
    )
  })
})

describe('stripMemoHighlight', () => {
  it('removes mark tags and preserves inner text', () => {
    const html = '<p class="memo-markdown__p"><mark class="memo-markdown__mark">hello</mark> world</p>'
    expect(stripMemoHighlight(html)).toBe(
      '<p class="memo-markdown__p">hello world</p>',
    )
  })

  it('removes multiple mark tags', () => {
    const html = '<mark class="memo-markdown__mark">foo</mark> bar <mark class="memo-markdown__mark">foo</mark>'
    expect(stripMemoHighlight(html)).toBe('foo bar foo')
  })

  it('returns unchanged html when no marks present', () => {
    const html = '<p class="memo-markdown__p">no highlights</p>'
    expect(stripMemoHighlight(html)).toBe(html)
  })
})

describe('memoShareRichTextNodesContainSearchMark', () => {
  it('returns false for empty nodes', () => {
    expect(memoShareRichTextNodesContainSearchMark([])).toBe(false)
  })

  it('returns false when no mark with memo-markdown__mark class exists', () => {
    const nodes = [
      {
        name: 'p',
        attrs: { class: 'memo-markdown__p' },
        children: [{ type: 'text', text: 'hello' }],
      },
    ]
    expect(memoShareRichTextNodesContainSearchMark(nodes as never)).toBe(false)
  })

  it('detects search mark at the top level', () => {
    const nodes = [
      {
        name: 'mark',
        attrs: { class: 'memo-markdown__mark' },
        children: [{ type: 'text', text: '命中' }],
      },
    ]
    expect(memoShareRichTextNodesContainSearchMark(nodes as never)).toBe(true)
  })

  it('detects search mark nested inside children', () => {
    const nodes = [
      {
        name: 'p',
        attrs: { class: 'memo-markdown__p' },
        children: [
          { type: 'text', text: 'a ' },
          {
            name: 'strong',
            attrs: { class: 'memo-markdown__strong' },
            children: [
              {
                name: 'mark',
                attrs: { class: 'memo-markdown__mark' },
                children: [{ type: 'text', text: 'hit' }],
              },
            ],
          },
        ],
      },
    ]
    expect(memoShareRichTextNodesContainSearchMark(nodes as never)).toBe(true)
  })

  it('ignores mark elements without the memo-markdown__mark class', () => {
    const nodes = [
      {
        name: 'mark',
        attrs: { class: 'other-mark' },
        children: [{ type: 'text', text: 'x' }],
      },
    ]
    expect(memoShareRichTextNodesContainSearchMark(nodes as never)).toBe(false)
  })
})
