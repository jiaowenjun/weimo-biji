import type {
  Token, InlineToken, TokenList,
  HeadingToken, CodeToken, TableToken, BlockquoteToken,
  ListToken, HtmlToken, ParagraphToken, TextBlockToken,
  LinkToken, ImageToken, StrongToken, EmToken,
  CodespanToken, DelToken, EscapeToken, InlineTextToken,
  RichTextNode, RichTextElementNode, RichTextTextNode,
} from './types'

const SAFE_HREF_RE = /^(https?:|mailto:)/i

function text(t: string): RichTextTextNode {
  return { type: 'text', text: t }
}

function el(name: string, cls: string, children?: RichTextNode[]): RichTextElementNode {
  const node: RichTextElementNode = { name, attrs: { class: cls } }
  if (children && children.length > 0) node.children = children
  return node
}

function escapePlain(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeHref(href: string | null): string | null {
  if (!href) return null
  return SAFE_HREF_RE.test(href.trim()) ? href : null
}

export class NodeParser {
  static parse(tokens: TokenList): RichTextNode[] {
    const parser = new NodeParser()
    return parser.parseBlock(tokens as Token[], true)
  }

  parseBlock(tokens: Token[], top: boolean = true): RichTextNode[] {
    const out: RichTextNode[] = []

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      switch (token.type) {
        case 'space':
          continue

        case 'hr':
          out.push({ name: 'hr', attrs: { class: 'memo-markdown__hr' } })
          continue

        case 'heading': {
          const t = token as HeadingToken
          const tag = `h${t.depth}`
          out.push(el(tag, `memo-markdown__heading memo-markdown__heading--${tag}`, this.parseInline(t.tokens)))
          continue
        }

        case 'code': {
          const t = token as CodeToken
          const content = t.escaped ? t.text : escapePlain(t.text)
          out.push(el('div', 'memo-markdown__pre', [
            el('code', 'memo-markdown__code memo-markdown__code--block', [text(content)]),
          ]))
          continue
        }

        case 'table': {
          const t = token as TableToken
          const headerCells: RichTextNode[] = []
          for (let j = 0; j < t.header.length; j++) {
            headerCells.push(el('span', 'memo-markdown__table-cell memo-markdown__table-cell--header', this.parseInline(t.header[j].tokens)))
          }
          const headerRow = el('div', 'memo-markdown__table-row', headerCells)
          const headNode = el('div', 'memo-markdown__table-head', [headerRow])

          const bodyRows: RichTextNode[] = []
          for (let j = 0; j < t.rows.length; j++) {
            const row = t.rows[j]
            const cells: RichTextNode[] = []
            for (let k = 0; k < row.length; k++) {
              cells.push(el('span', 'memo-markdown__table-cell', this.parseInline(row[k].tokens)))
            }
            bodyRows.push(el('div', 'memo-markdown__table-row', cells))
          }
          const bodyNode = el('div', 'memo-markdown__table-body', bodyRows)
          out.push(el('div', 'memo-markdown__table', [headNode, bodyNode]))
          continue
        }

        case 'blockquote': {
          const t = token as BlockquoteToken
          const children = this.parseBlock(t.tokens as Token[], true)
          const parts = ['memo-markdown__blockquote']
          if (t.centered) parts.push('memo-markdown__blockquote--centered')
          if (t.tightQuoteLines) parts.push('memo-markdown__blockquote--tight-lines')
          out.push(el('div', parts.join(' '), children))
          continue
        }

        case 'list': {
          const t = token as ListToken
          const items: RichTextNode[] = []
          for (let j = 0; j < t.items.length; j++) {
            const item = t.items[j]
            const itemChildren: RichTextNode[] = []

            let prefix: string
            if (t.ordered) {
              const num = typeof t.start === 'number' ? t.start + j : j + 1
              prefix = `${num}. `
            } else {
              prefix = '• '
            }

            if (item.task) {
              prefix += item.checked ? '[x] ' : '[ ] '
            }

            const content = this.parseBlock(item.tokens as Token[], t.loose)

            let inlineContent: RichTextNode[]
            if (content.length === 1 && 'name' in content[0] && content[0].name === 'p') {
              inlineContent = content[0].children || []
            } else if (content.length >= 1 && content.every(n => 'type' in n && n.type === 'text')) {
              inlineContent = content
            } else {
              itemChildren.push(text(prefix))
              itemChildren.push(...content)
              items.push(el('div', 'memo-markdown__list-item', itemChildren))
              continue
            }

            if (inlineContent.length > 0 && 'type' in inlineContent[0] && inlineContent[0].type === 'text') {
              itemChildren.push(text(prefix + (inlineContent[0] as RichTextTextNode).text))
              itemChildren.push(...inlineContent.slice(1))
            } else {
              itemChildren.push(text(prefix))
              itemChildren.push(...inlineContent)
            }

            items.push(el('div', 'memo-markdown__list-item', itemChildren))
          }
          out.push(el('div', `memo-markdown__list memo-markdown__list--${t.ordered ? 'ol' : 'ul'}`, items))
          continue
        }

        case 'html': {
          const t = token as HtmlToken
          out.push(text(escapePlain(t.text)))
          continue
        }

        case 'paragraph': {
          const t = token as ParagraphToken
          out.push(el('p', 'memo-markdown__p', this.parseInline(t.tokens)))
          continue
        }

        case 'text': {
          let body = (token as TextBlockToken).tokens
            ? this.parseInline((token as TextBlockToken).tokens!)
            : [text((token as TextBlockToken).text)]
          while (i + 1 < tokens.length && tokens[i + 1].type === 'text') {
            const next = tokens[++i] as TextBlockToken
            body.push(text('\n'))
            if (next.tokens) {
              body = body.concat(this.parseInline(next.tokens))
            } else {
              body.push(text(next.text))
            }
          }
          if (top) {
            out.push(el('p', 'memo-markdown__p', body))
          } else {
            out.push(...body)
          }
          continue
        }
      }
    }

    return out
  }

  parseInline(tokens: InlineToken[]): RichTextNode[] {
    const out: RichTextNode[] = []

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      switch (token.type) {
        case 'escape':
          out.push(text((token as EscapeToken).text))
          break

        case 'html':
          out.push(text(escapePlain(token.text)))
          break

        case 'link': {
          const t = token as LinkToken
          const safeHref = sanitizeHref(t.href)
          if (!safeHref) {
            out.push(el('span', 'memo-markdown__link-text', this.parseInline(t.tokens)))
          } else {
            const node: RichTextElementNode = {
              name: 'a',
              attrs: { class: 'memo-markdown__link', href: safeHref },
              children: this.parseInline(t.tokens),
            }
            if (t.title) node.attrs!.title = t.title
            out.push(node)
          }
          break
        }

        case 'image': {
          const t = token as ImageToken
          const label = t.text ? `[图片: ${escapePlain(t.text)}]` : '[图片]'
          out.push(el('span', 'memo-markdown__image-placeholder', [text(label)]))
          break
        }

        case 'strong': {
          const t = token as StrongToken
          out.push(el('strong', 'memo-markdown__strong', this.parseInline(t.tokens)))
          break
        }

        case 'em': {
          const t = token as EmToken
          out.push(el('em', 'memo-markdown__em', this.parseInline(t.tokens)))
          break
        }

        case 'codespan': {
          const t = token as CodespanToken
          out.push(el('code', 'memo-markdown__code memo-markdown__code--inline', [text(t.text)]))
          break
        }

        case 'br':
          out.push({ name: 'br' })
          break

        case 'del': {
          const t = token as DelToken
          out.push(el('del', 'memo-markdown__del', this.parseInline(t.tokens)))
          break
        }

        case 'text':
          out.push(text((token as InlineTextToken).text))
          break
      }
    }

    return out
  }
}
