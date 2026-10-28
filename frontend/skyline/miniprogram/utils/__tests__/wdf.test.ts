import { describe, expect, it } from 'vitest'

import {
  createEmptyWdfDocument,
  isWdfDocument,
  markdownCompatTextToWdfDocument,
  plainTextToWdfDocument,
  renderWdfToNodes,
  wdfDocumentToMarkdownCompatText,
  wdfDocumentToPlainText,
  type RichTextNode,
} from '../wdf'

function elementNodes(nodes: RichTextNode[]) {
  return nodes.filter((node): node is { name: string; attrs?: { class?: string } } => 'name' in node)
}

describe('wdf document guards', () => {
  it('accepts WDF envelopes and rejects legacy strings', () => {
    expect(isWdfDocument(createEmptyWdfDocument())).toBe(true)
    expect(isWdfDocument('markdown text')).toBe(false)
    expect(isWdfDocument(null)).toBe(false)
    expect(isWdfDocument({ schema: 'weimo.document' })).toBe(false)
  })

  it('builds empty and plain-text documents', () => {
    expect(createEmptyWdfDocument().root.content).toHaveLength(1)
    expect(wdfDocumentToPlainText(plainTextToWdfDocument('第一段\n\n第二段'))).toBe(
      '第一段\n\n第二段',
    )
  })
})

describe('renderWdfToNodes (映射参照 WdfRender)', () => {
  it('renders paragraph with bold runs', () => {
    const document = {
      schema: 'weimo.document',
      version: 1,
      root: {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph' as const,
            content: [
              { type: 'text' as const, text: '普通' },
              { type: 'text' as const, text: '加粗', marks: [{ type: 'bold' as const }] },
            ],
          },
        ],
      },
    }
    const nodes = renderWdfToNodes(document)
    expect(nodes[0]).toMatchObject({ name: 'p', attrs: { class: 'memo-markdown__p' } })
    const children = (nodes[0] as { children?: RichTextNode[] }).children
    expect(children?.[0]).toMatchObject({ type: 'text', text: '普通' })
    expect(children?.[1]).toMatchObject({
      name: 'strong',
      attrs: { class: 'memo-markdown__strong' },
    })
  })

  it('renders heading levels with h1-h6 names', () => {
    const document = plainTextHeading(2, '二级标题')
    const nodes = elementNodes(renderWdfToNodes(document))
    expect(nodes[0]).toMatchObject({
      name: 'h2',
      attrs: { class: 'memo-markdown__heading memo-markdown__heading--h2' },
    })
  })

  it('renders blockquote as div with inner paragraphs (对齐旧渲染器与高亮间距分类)', () => {
    const document = markdownCompatTextToWdfDocument('> 引用一行\n> 引用二行')
    const nodes = elementNodes(renderWdfToNodes(document))
    expect(nodes[0]).toMatchObject({ name: 'div', attrs: { class: 'memo-markdown__blockquote' } })
    const children = (nodes[0] as { children?: RichTextNode[] }).children ?? []
    expect(children).toHaveLength(2)
    expect(children[0]).toMatchObject({ name: 'p', attrs: { class: 'memo-markdown__p' } })
  })

  it('renders ordered list with start offset and bullet list with markers', () => {
    const document = markdownCompatTextToWdfDocument('- 甲\n- 乙\n\n3. 第三\n4. 第四')
    const nodes = elementNodes(renderWdfToNodes(document))
    expect(nodes[0]).toMatchObject({
      name: 'div',
      attrs: { class: 'memo-markdown__list memo-markdown__list--ul' },
    })
    expect(nodes[1]).toMatchObject({
      name: 'div',
      attrs: { class: 'memo-markdown__list memo-markdown__list--ol' },
    })
    const flat = JSON.stringify(nodes)
    expect(flat).toContain('"text":"• "')
    expect(flat).toContain('"text":"甲"')
    expect(flat).toContain('"text":"3. "')
    expect(flat).toContain('"text":"第三"')
  })
})

describe('md-lite 与 WDF 互转', () => {
  it('parses line-prefix syntax into structured blocks', () => {
    const document = markdownCompatTextToWdfDocument(
      '# 标题\n\n段落 **加粗**\n\n- 甲\n- 乙\n\n> 引用\n\n2. 第二\n3. 第三',
    )
    expect(document.root.content.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bullet_list',
      'blockquote',
      'ordered_list',
    ])
    const heading = document.root.content[0]
    if (heading.type === 'heading') expect(heading.attrs.level).toBe(1)
    const ordered = document.root.content[4]
    if (ordered.type === 'ordered_list') expect(ordered.attrs.start).toBe(2)
  })

  it('round-trips md-lite subset without loss', () => {
    const source = '# 标题\n\n段落 **加粗** 文本\n\n- 甲\n- 乙\n\n> 引用行\n\n1. 一\n2. 二'
    const back = wdfDocumentToMarkdownCompatText(markdownCompatTextToWdfDocument(source))
    expect(back).toBe(source)
  })

  it('degrades centered quotes to plain quotes and keeps bold inline', () => {
    const document = markdownCompatTextToWdfDocument('>= 居中')
    expect(document.root.content[0].type).toBe('blockquote')
    const runs = markdownCompatTextToWdfDocument('a **b** c').root.content[0]
    if (runs.type === 'paragraph') {
      expect(runs.content[1]?.marks).toEqual([{ type: 'bold' }])
    }
  })
})

function plainTextHeading(level: number, text: string) {
  return {
    schema: 'weimo.document',
    version: 1,
    root: {
      type: 'doc' as const,
      content: [
        {
          type: 'heading' as const,
          attrs: { level },
          content: [{ type: 'text' as const, text }],
        },
      ],
    },
  }
}
