import { marked, markedToNodes, Renderer, type MarkedOptions, type RichTextNode } from './markdown/index'

type MarkedRenderer = InstanceType<typeof Renderer>

const SAFE_HREF_RE = /^(https?:|mailto:)/i

let cachedRenderer: MarkedRenderer | null = null
let cachedOptions: MarkedOptions | null = null
const LIST_ITEM_OPEN_TAG = '<div class="memo-markdown__list-item">'
const LIST_ITEM_OPEN_RE = /<div class="memo-markdown__list-item">/g
const LIST_ITEM_PARAGRAPH_RE = /^<p class="memo-markdown__p">([\s\S]*)<\/p>\n?$/

function escapeMemoHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeMemoHref(href: string | null): string | null {
  if (!href) return null
  return SAFE_HREF_RE.test(href.trim()) ? href : null
}

function normalizeMemoListItemContent(text: string): string {
  const trimmed = text.replace(/\n+$/, '')
  const paragraphMatch = trimmed.match(LIST_ITEM_PARAGRAPH_RE)
  return paragraphMatch ? paragraphMatch[1] : trimmed
}

function createMemoMarkedRenderer(): MarkedRenderer {
  const renderer = new Renderer()

  renderer.paragraph = (text: string) =>
    `<p class="memo-markdown__p">${text}</p>`

  renderer.heading = (text: string, level: number) => {
    const tag = `h${level}`
    return `<${tag} class="memo-markdown__heading memo-markdown__heading--${tag}">${text}</${tag}>`
  }

  renderer.strong = (text: string) =>
    `<strong class="memo-markdown__strong">${text}</strong>`

  renderer.em = (text: string) =>
    `<em class="memo-markdown__em">${text}</em>`

  renderer.del = (text: string) =>
    `<del class="memo-markdown__del">${text}</del>`

  renderer.blockquote = (quote: string, centered?: boolean, tightQuoteLines?: boolean) => {
    const parts = ['memo-markdown__blockquote']
    if (centered) parts.push('memo-markdown__blockquote--centered')
    if (tightQuoteLines) parts.push('memo-markdown__blockquote--tight-lines')
    const cls = parts.join(' ')
    return `<blockquote class="${cls}">${quote}</blockquote>`
  }

  renderer.list = (body: string, ordered: boolean, start: number | '') => {
    let processed = body
    if (ordered) {
      let counter = typeof start === 'number' ? start - 1 : 0
      processed = body.replace(LIST_ITEM_OPEN_RE, () => {
        counter++
        return `${LIST_ITEM_OPEN_TAG}${counter}. `
      })
    } else {
      processed = body.replace(LIST_ITEM_OPEN_RE, `${LIST_ITEM_OPEN_TAG}• `)
    }
    return `<div class="memo-markdown__list memo-markdown__list--${ordered ? 'ol' : 'ul'}">${processed}</div>`
  }

  renderer.listitem = (text: string) =>
    `${LIST_ITEM_OPEN_TAG}${normalizeMemoListItemContent(text)}</div>`

  renderer.checkbox = (checked: boolean) =>
    checked ? '[x] ' : '[ ] '

  renderer.codespan = (code: string) =>
    `<code class="memo-markdown__code memo-markdown__code--inline">${code}</code>`

  renderer.code = (code: string, _infostring: string | undefined, escaped: boolean) => {
    const content = escaped ? code : escapeMemoHtml(code)
    return `<div class="memo-markdown__pre"><code class="memo-markdown__code memo-markdown__code--block">${content}</code></div>`
  }

  renderer.link = (href: string | null, title: string | null, text: string) => {
    const safeHref = sanitizeMemoHref(href)
    if (!safeHref) {
      return `<span class="memo-markdown__link-text">${text}</span>`
    }
    const titleAttr = title ? ` title="${escapeMemoHtml(title)}"` : ''
    return `<a class="memo-markdown__link" href="${escapeMemoHtml(safeHref)}"${titleAttr}>${text}</a>`
  }

  renderer.image = (_href: string | null, _title: string | null, text: string) => {
    const label = text ? `[图片: ${escapeMemoHtml(text)}]` : '[图片]'
    return `<span class="memo-markdown__image-placeholder">${label}</span>`
  }

  renderer.hr = () =>
    '<hr class="memo-markdown__hr" />'

  renderer.br = () => '<br />'

  renderer.html = (html: string) => escapeMemoHtml(html)

  renderer.table = (header: string, body: string) =>
    `<div class="memo-markdown__table"><div class="memo-markdown__table-head">${header}</div><div class="memo-markdown__table-body">${body}</div></div>`

  renderer.tablerow = (content: string) =>
    `<div class="memo-markdown__table-row">${content}</div>`

  renderer.tablecell = (content: string, flags: { header: boolean }) => {
    const cls = flags.header
      ? 'memo-markdown__table-cell memo-markdown__table-cell--header'
      : 'memo-markdown__table-cell'
    return `<span class="${cls}">${content}</span>`
  }

  return renderer
}

function getMarkedOptions(): MarkedOptions {
  if (!cachedOptions) {
    cachedRenderer = createMemoMarkedRenderer()
    cachedOptions = {
      renderer: cachedRenderer,
      gfm: true,
    }
  }
  return cachedOptions
}

function fallbackToPlainHtml(markdown: string): string {
  const escaped = escapeMemoHtml(markdown)
  const lines = escaped.split('\n')
  const paragraphs: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current.join('<br />'))
        current = []
      }
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join('<br />'))
  }

  if (paragraphs.length === 0) {
    return '<p class="memo-markdown__p"></p>'
  }

  return paragraphs
    .map((p) => `<p class="memo-markdown__p">${p}</p>`)
    .join('')
}

export function renderMemoMarkdownToHtml(markdown: string): string {
  if (!markdown) {
    return '<p class="memo-markdown__p"></p>'
  }

  try {
    const options = getMarkedOptions()
    return marked(markdown, options)
  } catch {
    return fallbackToPlainHtml(markdown)
  }
}

const EMPTY_NODES: RichTextNode[] = [{ name: 'p', attrs: { class: 'memo-markdown__p' } }]

export function renderMemoMarkdownToNodes(markdown: string): RichTextNode[] {
  if (!markdown) return EMPTY_NODES
  try {
    return markedToNodes(markdown)
  } catch {
    return EMPTY_NODES
  }
}
