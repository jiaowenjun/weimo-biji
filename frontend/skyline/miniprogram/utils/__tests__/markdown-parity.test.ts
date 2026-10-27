import { describe, expect, it } from 'vitest'
import { marked, Renderer } from '../markdown/index'

function render(md: string): string {
  const renderer = new Renderer()
  renderer.paragraph = (text: string) => `<p>${text}</p>`
  renderer.heading = (text: string, level: number) => `<h${level}>${text}</h${level}>`
  renderer.strong = (text: string) => `<b>${text}</b>`
  renderer.em = (text: string) => `<i>${text}</i>`
  renderer.del = (text: string) => `<del>${text}</del>`
  renderer.blockquote = (quote: string, _centered?: boolean, _tightQuoteLines?: boolean) =>
    `<bq>${quote}</bq>`
  renderer.list = (body: string, ordered: boolean) => `<${ordered ? 'ol' : 'ul'}>${body}</${ordered ? 'ol' : 'ul'}>`
  renderer.listitem = (text: string) => `<li>${text}</li>`
  renderer.checkbox = (checked: boolean) => checked ? '[x] ' : '[ ] '
  renderer.codespan = (code: string) => `<code>${code}</code>`
  renderer.code = (code: string) => `<pre>${code}</pre>`
  renderer.link = (href: string | null, _title: string | null, text: string) => `<a href="${href}">${text}</a>`
  renderer.image = (_href: string | null, _title: string | null, text: string) => `[img:${text}]`
  renderer.hr = () => '<hr/>'
  renderer.br = () => '<br/>'
  renderer.html = (html: string) => html
  renderer.table = (header: string, body: string) => `<table>${header}${body}</table>`
  renderer.tablerow = (content: string) => `<tr>${content}</tr>`
  renderer.tablecell = (content: string, flags: { header: boolean }) => {
    const tag = flags.header ? 'th' : 'td'
    return `<${tag}>${content}</${tag}>`
  }
  return marked(md, { gfm: true, renderer })
}

describe('self-hosted markdown parser', () => {
  it('parses paragraphs', () => {
    expect(render('hello')).toBe('<p>hello</p>')
  })

  it('parses single newline as space (Skyline does not support br)', () => {
    expect(render('a\nb')).toBe('<p>a b</p>')
  })

  it('parses headings', () => {
    expect(render('# H1')).toBe('<h1>H1</h1>')
    expect(render('## H2')).toBe('<h2>H2</h2>')
  })

  it('parses setext headings', () => {
    expect(render('Title\n===')).toBe('<h1>Title</h1>')
  })

  it('parses bold and italic', () => {
    expect(render('**bold**')).toBe('<p><b>bold</b></p>')
    expect(render('*italic*')).toBe('<p><i>italic</i></p>')
  })

  it('parses CJK with inline styles', () => {
    expect(render('正文**粗体**正文')).toBe('<p>正文<b>粗体</b>正文</p>')
  })

  it('parses strikethrough', () => {
    expect(render('~~del~~')).toBe('<p><del>del</del></p>')
  })

  it('parses inline code', () => {
    expect(render('`code`')).toBe('<p><code>code</code></p>')
  })

  it('parses fenced code blocks', () => {
    expect(render('```\ncode\n```')).toBe('<pre>code</pre>')
  })

  it('parses blockquotes', () => {
    expect(render('> text')).toBe('<bq><p>text</p></bq>')
  })

  it('parses unordered lists', () => {
    expect(render('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
  })

  it('parses ordered lists', () => {
    expect(render('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })

  it('parses task lists', () => {
    expect(render('- [x] done\n- [ ] todo')).toBe('<ul><li>[x] done</li><li>[ ] todo</li></ul>')
  })

  it('parses horizontal rules', () => {
    expect(render('---')).toBe('<hr/>')
  })

  it('parses links', () => {
    expect(render('[text](https://x.com)')).toBe('<p><a href="https://x.com">text</a></p>')
  })

  it('parses images', () => {
    expect(render('![alt](https://img.png)')).toBe('<p>[img:alt]</p>')
  })

  it('parses tables', () => {
    expect(render('| a | b |\n| - | - |\n| 1 | 2 |')).toBe(
      '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>',
    )
  })

  it('parses escape sequences', () => {
    expect(render('\\*not bold\\*')).toBe('<p>*not bold*</p>')
  })

  it('escapes HTML entities in text', () => {
    expect(render('a & b < c')).toBe('<p>a &amp; b &lt; c</p>')
  })

  it('parses autolinks', () => {
    expect(render('<https://x.com>')).toBe('<p><a href="https://x.com">https://x.com</a></p>')
  })

  it('parses GFM URL autolinks', () => {
    expect(render('visit https://x.com today')).toBe('<p>visit <a href="https://x.com">https://x.com</a> today</p>')
  })

  it('parses link reference definitions', () => {
    expect(render('[foo]: https://x.com\n\n[foo]')).toBe('<p><a href="https://x.com">foo</a></p>')
  })

  it('parses backslash line breaks as space (Skyline does not support br)', () => {
    expect(render('a\\\nb')).toBe('<p>a b</p>')
  })
})
