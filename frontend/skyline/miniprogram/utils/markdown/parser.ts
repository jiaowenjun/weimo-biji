import { Renderer } from './renderer'
import { unescape } from './helpers'
import type {
  Token, InlineToken, TokenList, RendererMethods,
  HeadingToken, CodeToken, TableToken, BlockquoteToken,
  ListToken, HtmlToken, ParagraphToken, TextBlockToken,
  LinkToken, ImageToken, StrongToken, EmToken,
  CodespanToken, DelToken, InlineTextToken, EscapeToken,
} from './types'

class TextRenderer {
  strong(text: string): string { return text }
  em(text: string): string { return text }
  codespan(text: string): string { return text }
  del(text: string): string { return text }
  html(text: string): string { return text }
  text(text: string): string { return text }
  link(_href: string | null, _title: string | null, text: string): string { return '' + text }
  image(_href: string | null, _title: string | null, text: string): string { return '' + text }
  br(): string { return '' }
}

type RendererLike = RendererMethods | TextRenderer

export class Parser {
  private renderer: RendererMethods
  private textRenderer: TextRenderer

  constructor(renderer?: Partial<RendererMethods>) {
    const base = new Renderer()
    if (renderer) {
      for (const key of Object.keys(renderer) as (keyof RendererMethods)[]) {
        const method = renderer[key]
        if (method) {
          ;(base as unknown as Record<string, unknown>)[key] = method
        }
      }
    }
    this.renderer = base
    this.textRenderer = new TextRenderer()
  }

  static parse(tokens: TokenList, renderer?: Partial<RendererMethods>): string {
    const parser = new Parser(renderer)
    return parser.parse(tokens as Token[], true)
  }

  parse(tokens: Token[], top: boolean = true): string {
    let out = ''

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      switch (token.type) {
        case 'space':
          continue

        case 'hr':
          out += this.renderer.hr()
          continue

        case 'heading': {
          const t = token as HeadingToken
          out += this.renderer.heading(
            this.parseInline(t.tokens),
            t.depth,
            unescape(this.parseInline(t.tokens, this.textRenderer)),
          )
          continue
        }

        case 'code': {
          const t = token as CodeToken
          out += this.renderer.code(t.text, t.lang, !!t.escaped)
          continue
        }

        case 'table': {
          const t = token as TableToken
          let header = ''
          let cell = ''
          for (let j = 0; j < t.header.length; j++) {
            cell += this.renderer.tablecell(
              this.parseInline(t.header[j].tokens),
              { header: true, align: t.align[j] },
            )
          }
          header += this.renderer.tablerow(cell)

          let body = ''
          for (let j = 0; j < t.rows.length; j++) {
            const row = t.rows[j]
            cell = ''
            for (let k = 0; k < row.length; k++) {
              cell += this.renderer.tablecell(
                this.parseInline(row[k].tokens),
                { header: false, align: t.align[k] },
              )
            }
            body += this.renderer.tablerow(cell)
          }
          out += this.renderer.table(header, body)
          continue
        }

        case 'blockquote': {
          const t = token as BlockquoteToken
          const body = this.parse(t.tokens as Token[], true)
          out += this.renderer.blockquote(body, t.centered, t.tightQuoteLines)
          continue
        }

        case 'list': {
          const t = token as ListToken
          let body = ''
          for (let j = 0; j < t.items.length; j++) {
            const item = t.items[j]
            let itemBody = ''

            if (item.task) {
              const checkbox = this.renderer.checkbox(!!item.checked)
              if (t.loose) {
                if (item.tokens.length > 0 && item.tokens[0].type === 'paragraph') {
                  const para = item.tokens[0] as ParagraphToken
                  para.text = checkbox + ' ' + para.text
                  if (para.tokens && para.tokens.length > 0 && para.tokens[0].type === 'text') {
                    ;(para.tokens[0] as InlineTextToken).text = checkbox + ' ' + (para.tokens[0] as InlineTextToken).text
                  }
                } else {
                  item.tokens.unshift({ type: 'text', raw: checkbox, text: checkbox } as unknown as Token)
                }
              } else {
                itemBody += checkbox
              }
            }

            itemBody += this.parse(item.tokens as Token[], t.loose)
            body += this.renderer.listitem(itemBody)
          }
          out += this.renderer.list(body, t.ordered, t.start)
          continue
        }

        case 'html': {
          const t = token as HtmlToken
          out += this.renderer.html(t.text)
          continue
        }

        case 'paragraph': {
          const t = token as ParagraphToken
          out += this.renderer.paragraph(this.parseInline(t.tokens))
          continue
        }

        case 'text': {
          let body = (token as TextBlockToken).tokens
            ? this.parseInline((token as TextBlockToken).tokens!)
            : (token as TextBlockToken).text
          while (i + 1 < tokens.length && tokens[i + 1].type === 'text') {
            const next = tokens[++i] as TextBlockToken
            body += '\n' + (next.tokens ? this.parseInline(next.tokens) : next.text)
          }
          out += top ? this.renderer.paragraph(body) : body
          continue
        }
      }
    }

    return out
  }

  parseInline(tokens: InlineToken[], renderer?: RendererLike): string {
    const r = renderer || this.renderer
    let out = ''

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      switch (token.type) {
        case 'escape':
          out += r.text((token as EscapeToken).text)
          break

        case 'html':
          out += r.html(token.text)
          break

        case 'link': {
          const t = token as LinkToken
          out += r.link(t.href, t.title, this.parseInline(t.tokens, renderer))
          break
        }

        case 'image': {
          const t = token as ImageToken
          out += r.image(t.href, t.title, t.text)
          break
        }

        case 'strong': {
          const t = token as StrongToken
          out += r.strong(this.parseInline(t.tokens, renderer))
          break
        }

        case 'em': {
          const t = token as EmToken
          out += r.em(this.parseInline(t.tokens, renderer))
          break
        }

        case 'codespan':
          out += r.codespan((token as CodespanToken).text)
          break

        case 'br':
          out += r.br()
          break

        case 'del': {
          const t = token as DelToken
          out += r.del(this.parseInline(t.tokens, renderer))
          break
        }

        case 'text':
          out += r.text((token as InlineTextToken).text)
          break
      }
    }

    return out
  }
}
