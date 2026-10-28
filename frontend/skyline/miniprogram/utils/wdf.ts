/**
 * WDF(Weimo Document Format)支持:类型、富文本渲染与编辑页 md-lite 互转。
 *
 * 渲染映射参照 weimo-ui-editor 的 WdfRender(paragraph/heading/blockquote/
 * bullet_list/ordered_list 五种块 + bold 一种行内标记),产出小程序
 * rich-text 节点并复用 memo-markdown 既有类名,旧 WXSS 样式直接生效。
 */

export interface WdfMark {
  type: 'bold'
}

export interface WdfText {
  type: 'text'
  text: string
  marks?: WdfMark[]
}

export interface WdfParagraph {
  type: 'paragraph'
  content: WdfText[]
}

export interface WdfListItem {
  type: 'list_item'
  content: [WdfParagraph]
}

export interface WdfHeadingAttrs {
  level: number
}

export interface WdfOrderedListAttrs {
  start: number
}

export type WdfBlock =
  | { type: 'paragraph'; content: WdfText[] }
  | { type: 'heading'; attrs: WdfHeadingAttrs; content: WdfText[] }
  | { type: 'blockquote'; content: WdfParagraph[] }
  | { type: 'bullet_list'; content: WdfListItem[] }
  | { type: 'ordered_list'; attrs: WdfOrderedListAttrs; content: WdfListItem[] }

export interface WdfRoot {
  type: 'doc'
  content: WdfBlock[]
}

export interface WdfDocument {
  schema: string
  version: number
  root: WdfRoot
}

// ─── 富文本节点(小程序 rich-text)───

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

function el(name: string, cls: string, children?: RichTextNode[]): RichTextElementNode {
  const node: RichTextElementNode = { name, attrs: { class: cls } }
  if (children && children.length > 0) node.children = children
  return node
}

function textNode(t: string): RichTextTextNode {
  return { type: 'text', text: t }
}

// ─── 校验与构造 ───

export function isWdfDocument(value: unknown): value is WdfDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const doc = value as Partial<WdfDocument>
  return (
    typeof doc.schema === 'string' &&
    typeof doc.version === 'number' &&
    Boolean(doc.root) &&
    typeof doc.root === 'object' &&
    Array.isArray((doc.root as Partial<WdfRoot>).content)
  )
}

export function createEmptyWdfDocument(): WdfDocument {
  return {
    schema: 'weimo.document',
    version: 1,
    root: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
  }
}

/** 单段纯文本文档 */
export function plainTextToWdfDocument(text: string): WdfDocument {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => paragraphBlock(block))

  return {
    schema: 'weimo.document',
    version: 1,
    root: {
      type: 'doc',
      content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', content: [] }],
    },
  }
}

function paragraphBlock(text: string): WdfBlock {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

// ─── 纯文本抽取(摘要/字数统计/文本过滤) ───

function inlinePlainText(content: WdfText[]): string {
  return content.map((run) => run.text).join('')
}

/** 块间以空行连接,与 weimo-wdf 的 render_plain 语义一致 */
export function wdfDocumentToPlainText(document: WdfDocument): string {
  const blocks = document.root.content.map((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return inlinePlainText(block.content)
      case 'blockquote':
        return block.content.map((p) => inlinePlainText(p.content)).join('\n')
      case 'bullet_list':
      case 'ordered_list':
        return block.content
          .map((item) => inlinePlainText(item.content[0].content))
          .join('\n')
    }
  })
  return blocks.join('\n\n')
}

// ─── 富文本渲染(参照 WdfRender 的块映射) ───

function renderInline(content: WdfText[]): RichTextNode[] {
  return content.map((run) => {
    if (run.marks?.some((mark) => mark.type === 'bold')) {
      return el('strong', 'memo-markdown__strong', [textNode(run.text)])
    }
    return textNode(run.text)
  })
}

function renderListItems(
  items: WdfListItem[],
  ordered: boolean,
  start: number,
): RichTextNode[] {
  return items.map((item, index) => {
    const marker = ordered ? `${start + index}. ` : '• '
    return el('div', 'memo-markdown__list-item', [
      textNode(marker),
      ...renderInline(item.content[0].content),
    ])
  })
}

export function renderWdfToNodes(document: WdfDocument): RichTextNode[] {
  const out: RichTextNode[] = []

  for (const block of document.root.content) {
    switch (block.type) {
      case 'paragraph':
        out.push(el('p', 'memo-markdown__p', renderInline(block.content)))
        break
      case 'heading': {
        const level = Math.min(Math.max(Math.round(block.attrs.level), 1), 6)
        const tag = `h${level}`
        out.push(
          el(tag, `memo-markdown__heading memo-markdown__heading--${tag}`, renderInline(block.content)),
        )
        break
      }
      case 'blockquote':
        out.push(
          el(
            'div',
            'memo-markdown__blockquote',
            block.content.map((paragraph) =>
              el('p', 'memo-markdown__p', renderInline(paragraph.content)),
            ),
          ),
        )
        break
      case 'bullet_list':
        out.push(
          el('div', 'memo-markdown__list memo-markdown__list--ul', renderListItems(block.content, false, 1)),
        )
        break
      case 'ordered_list':
        out.push(
          el(
            'div',
            'memo-markdown__list memo-markdown__list--ol',
            renderListItems(block.content, true, block.attrs.start ?? 1),
          ),
        )
        break
    }
  }

  return out
}

// ─── 编辑页 md-lite 互转 ───
//
// 编辑页工具栏只产生行前缀语法(# 标题 / - 列表 / n. 有序列表 / > 引用 /
// >= 居中引用),该子集与 WDF 块一一对应;居中引用在 WDF v0.1 无对应块,
// 降级为普通引用(内容无损)。

interface CompatLine {
  text: string
}

function splitCompatLines(source: string): CompatLine[] {
  return source.replace(/\r\n?/g, '\n').split('\n').map((text) => ({ text }))
}

/**
 * md-lite 文本 → WDF 文档。
 * 连续同类行聚合为列表;其余非空行成段;`**加粗**` 解析为 bold 行内标记。
 */
export function markdownCompatTextToWdfDocument(source: string): WdfDocument {
  const blocks: WdfBlock[] = []
  let paragraphBuffer: string[] = []
  let bulletBuffer: string[] = []
  let quoteBuffer: string[] = []
  let ordered: { start: number; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: parseInlineRuns(paragraphBuffer.join('\n')),
      })
      paragraphBuffer = []
    }
  }
  const flushQuote = () => {
    if (quoteBuffer.length > 0) {
      blocks.push({
        type: 'blockquote',
        content: quoteBuffer.map((line) => ({ type: 'paragraph', content: parseInlineRuns(line) })),
      })
      quoteBuffer = []
    }
  }
  const flushBullet = () => {
    if (bulletBuffer.length > 0) {
      blocks.push({
        type: 'bullet_list',
        content: bulletBuffer.map((line) => ({
          type: 'list_item',
          content: [{ type: 'paragraph', content: parseInlineRuns(line) }],
        })),
      })
      bulletBuffer = []
    }
  }
  const flushOrdered = () => {
    if (ordered) {
      blocks.push({
        type: 'ordered_list',
        attrs: { start: ordered.start },
        content: ordered.items.map((line) => ({
          type: 'list_item',
          content: [{ type: 'paragraph', content: parseInlineRuns(line) }],
        })),
      })
      ordered = null
    }
  }
  const flushAll = () => {
    flushParagraph()
    flushQuote()
    flushBullet()
    flushOrdered()
  }

  for (const { text: line } of splitCompatLines(source)) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushAll()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushAll()
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: parseInlineRuns(heading[2]),
      })
      continue
    }

    const quote = /^>=?\s*(.*)$/.exec(trimmed)
    if (quote) {
      flushParagraph()
      flushBullet()
      flushOrdered()
      quoteBuffer.push(quote[1])
      continue
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed)
    if (bullet) {
      flushParagraph()
      flushQuote()
      flushOrdered()
      bulletBuffer.push(bullet[1])
      continue
    }

    const orderedItem = /^(\d{1,9})[.)]\s+(.*)$/.exec(trimmed)
    if (orderedItem) {
      flushParagraph()
      flushQuote()
      flushBullet()
      if (!ordered) {
        ordered = { start: Number(orderedItem[1]), items: [] }
      }
      ordered.items.push(orderedItem[2])
      continue
    }

    flushQuote()
    flushBullet()
    flushOrdered()
    paragraphBuffer.push(trimmed)
  }
  flushAll()

  return {
    schema: 'weimo.document',
    version: 1,
    root: { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }] },
  }
}

/** 行内 `**加粗**` 解析(编辑页唯一的行内语法) */
function parseInlineRuns(line: string): WdfText[] {
  const runs: WdfText[] = []
  const pattern = /\*\*([^*\n]+)\*\*/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) {
      runs.push({ type: 'text', text: line.slice(cursor, match.index) })
    }
    runs.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    cursor = match.index + match[0].length
  }
  if (cursor < line.length) {
    runs.push({ type: 'text', text: line.slice(cursor) })
  }
  return runs
}

function inlineToCompatText(content: WdfText[]): string {
  return content
    .map((run) =>
      run.marks?.some((mark) => mark.type === 'bold') ? `**${run.text}**` : run.text,
    )
    .join('')
}

/** WDF 文档 → md-lite 文本(编辑回显用,子集无损往返) */
export function wdfDocumentToMarkdownCompatText(document: WdfDocument): string {
  const blockTexts: string[] = []

  for (const block of document.root.content) {
    switch (block.type) {
      case 'paragraph':
        blockTexts.push(inlineToCompatText(block.content))
        break
      case 'heading':
        blockTexts.push(
          `${'#'.repeat(Math.min(Math.max(block.attrs.level, 1), 6))} ${inlineToCompatText(block.content)}`,
        )
        break
      case 'blockquote':
        blockTexts.push(
          block.content
            .map((paragraph) => `> ${inlineToCompatText(paragraph.content)}`)
            .join('\n'),
        )
        break
      case 'bullet_list':
        blockTexts.push(
          block.content
            .map((item) => `- ${inlineToCompatText(item.content[0].content)}`)
            .join('\n'),
        )
        break
      case 'ordered_list': {
        const start = block.attrs.start ?? 1
        blockTexts.push(
          block.content
            .map(
              (item, index) =>
                `${start + index}. ${inlineToCompatText(item.content[0].content)}`,
            )
            .join('\n'),
        )
        break
      }
    }
  }

  return blockTexts.join('\n\n')
}
