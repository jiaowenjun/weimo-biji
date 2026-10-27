export interface MarkedOptions {
  renderer?: Partial<RendererMethods>
  gfm?: boolean
}

export interface RendererMethods {
  paragraph(text: string): string
  heading(text: string, level: number, raw: string): string
  strong(text: string): string
  em(text: string): string
  del(text: string): string
  blockquote(quote: string, centered?: boolean, tightQuoteLines?: boolean): string
  list(body: string, ordered: boolean, start: number | ''): string
  listitem(text: string): string
  checkbox(checked: boolean): string
  codespan(code: string): string
  code(code: string, infostring: string | undefined, escaped: boolean): string
  link(href: string | null, title: string | null, text: string): string
  image(href: string | null, title: string | null, text: string): string
  hr(): string
  br(): string
  html(html: string): string
  table(header: string, body: string): string
  tablerow(content: string): string
  tablecell(
    content: string,
    flags: { header: boolean; align: 'center' | 'left' | 'right' | null },
  ): string
  text(text: string): string
}

export interface BlockToken {
  type: string
  raw: string
  text?: string
  tokens?: InlineToken[]
}

export interface SpaceToken {
  type: 'space'
  raw: string
}

export interface CodeToken {
  type: 'code'
  raw: string
  text: string
  lang?: string
  codeBlockStyle?: string
  escaped?: boolean
}

export interface HeadingToken {
  type: 'heading'
  raw: string
  depth: number
  text: string
  tokens: InlineToken[]
}

export interface HrToken {
  type: 'hr'
  raw: string
}

export interface BlockquoteToken {
  type: 'blockquote'
  raw: string
  text: string
  tokens: Token[]
  centered?: boolean
  /** 连续 `>` 行升格为多段落时用于紧凑间距（rich-text 避免依赖 br） */
  tightQuoteLines?: boolean
}

export interface ListToken {
  type: 'list'
  raw: string
  ordered: boolean
  start: number | ''
  loose: boolean
  items: ListItemToken[]
}

export interface ListItemToken {
  type: 'list_item'
  raw: string
  task: boolean
  checked?: boolean
  loose: boolean
  text: string
  tokens: Token[]
}

export interface HtmlToken {
  type: 'html'
  raw: string
  pre: boolean
  text: string
}

export interface ParagraphToken {
  type: 'paragraph'
  raw: string
  text: string
  tokens: InlineToken[]
}

export interface TextBlockToken {
  type: 'text'
  raw: string
  text: string
  tokens?: InlineToken[]
}

export interface TableToken {
  type: 'table'
  raw: string
  header: TableCell[]
  align: (('center' | 'left' | 'right') | null)[]
  rows: TableCell[][]
}

export interface TableCell {
  text: string
  tokens: InlineToken[]
}

export interface DefToken {
  type: 'def'
  raw: string
  tag: string
  href: string
  title?: string
}

export type Token =
  | SpaceToken
  | CodeToken
  | HeadingToken
  | HrToken
  | BlockquoteToken
  | ListToken
  | HtmlToken
  | ParagraphToken
  | TextBlockToken
  | TableToken
  | DefToken

export interface EscapeToken {
  type: 'escape'
  raw: string
  text: string
}

export interface InlineHtmlToken {
  type: 'html'
  raw: string
  text: string
  inLink: boolean
  inRawBlock: boolean
}

export interface LinkToken {
  type: 'link'
  raw: string
  href: string
  title: string | null
  text: string
  tokens: InlineToken[]
}

export interface ImageToken {
  type: 'image'
  raw: string
  href: string
  title: string | null
  text: string
}

export interface StrongToken {
  type: 'strong'
  raw: string
  text: string
  tokens: InlineToken[]
}

export interface EmToken {
  type: 'em'
  raw: string
  text: string
  tokens: InlineToken[]
}

export interface CodespanToken {
  type: 'codespan'
  raw: string
  text: string
}

export interface BrToken {
  type: 'br'
  raw: string
}

export interface DelToken {
  type: 'del'
  raw: string
  text: string
  tokens: InlineToken[]
}

export interface InlineTextToken {
  type: 'text'
  raw: string
  text: string
}

export type InlineToken =
  | EscapeToken
  | InlineHtmlToken
  | LinkToken
  | ImageToken
  | StrongToken
  | EmToken
  | CodespanToken
  | BrToken
  | DelToken
  | InlineTextToken

export interface LinkDef {
  href: string
  title?: string
}

export type TokenList = Token[] & { links: Record<string, LinkDef> }

// ─── Rich-Text Node Types (WeChat Mini Program) ───

export interface RichTextElementNode {
  name: string
  attrs?: Record<string, string>
  children?: RichTextNode[]
}

export interface RichTextTextNode {
  type: 'text'
  text: string
}

export type RichTextNode = RichTextElementNode | RichTextTextNode
