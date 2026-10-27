import type { RichTextNode, RichTextElementNode, RichTextTextNode } from './markdown/index'

const TAG_SPLIT_RE = /(<[^>]*>)/

const MARK_RE = /<mark class="memo-markdown__mark">([\s\S]*?)<\/mark>/g
const BLOCK_MARGIN_TOP_BY_PREVIOUS_KIND: Record<string, Partial<Record<string, string>>> = {
  paragraph: {
    paragraph: '1em',
    list: '1em',
    blockquote: '1em',
    heading: '40rpx',
    pre: '40rpx',
    hr: '40rpx',
  },
  list: {
    paragraph: '1em',
    list: '1em',
    blockquote: '1em',
    heading: '40rpx',
    pre: '40rpx',
    hr: '40rpx',
  },
  blockquote: {
    paragraph: '1em',
    list: '1em',
    heading: '40rpx',
    pre: '40rpx',
    hr: '40rpx',
  },
  heading: {
    paragraph: '16rpx',
    list: '16rpx',
    blockquote: '16rpx',
    pre: '16rpx',
    hr: '40rpx',
  },
  pre: {
    paragraph: '40rpx',
    heading: '40rpx',
    list: '40rpx',
    blockquote: '40rpx',
  },
  hr: {
    paragraph: '40rpx',
    heading: '40rpx',
    list: '40rpx',
    blockquote: '40rpx',
  },
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlightMemoHtml(html: string, keyword: string): string {
  if (!keyword) return html

  const pattern = new RegExp(escapeRegExp(keyword), 'gi')
  const tokens = html.split(TAG_SPLIT_RE)

  for (let i = 0; i < tokens.length; i += 2) {
    tokens[i] = tokens[i].replace(
      pattern,
      (match) => `<mark class="memo-markdown__mark">${match}</mark>`,
    )
  }

  return tokens.join('')
}

export function stripMemoHighlight(html: string): string {
  return html.replace(MARK_RE, '$1')
}

export function highlightMemoNodes(nodes: RichTextNode[], keyword: string): RichTextNode[] {
  if (!keyword) return nodes
  const pattern = new RegExp(escapeRegExp(keyword), 'gi')
  return highlightNodesRecursive(nodes, pattern)
}

export function applyMemoParagraphSpacingForHighlight(nodes: RichTextNode[]): RichTextNode[] {
  let changed = false
  const spacedNodes = nodes.map((node, index) => {
    if (!('name' in node)) return node
    const currentKind = getMemoBlockKind(node)
    if (!currentKind) return node
    const prevKind = index > 0 ? getMemoBlockKind(nodes[index - 1]) : null
    if (!prevKind) return node
    const marginTop = BLOCK_MARGIN_TOP_BY_PREVIOUS_KIND[prevKind]?.[currentKind]
    if (!marginTop) return node

    const el = node as RichTextElementNode
    const nextStyle = appendMarginTopStyle(el.attrs?.style, marginTop)
    if (nextStyle === el.attrs?.style) return node

    changed = true
    return {
      ...el,
      attrs: {
        ...(el.attrs ?? {}),
        style: nextStyle,
      },
    }
  })

  return changed ? spacedNodes : nodes
}

function highlightNodesRecursive(nodes: RichTextNode[], pattern: RegExp): RichTextNode[] {
  const out: RichTextNode[] = []
  for (const node of nodes) {
    if ('type' in node && node.type === 'text') {
      out.push(...splitTextNode(node as RichTextTextNode, pattern))
    } else {
      const el = node as RichTextElementNode
      if (el.children) {
        out.push({ ...el, children: highlightNodesRecursive(el.children, pattern) })
      } else {
        out.push(el)
      }
    }
  }
  return out
}

function splitTextNode(node: RichTextTextNode, pattern: RegExp): RichTextNode[] {
  const text = node.text
  pattern.lastIndex = 0
  const parts: RichTextNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    parts.push({
      name: 'mark',
      attrs: { class: 'memo-markdown__mark' },
      children: [{ type: 'text', text: match[0] }],
    })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex === 0) return [node]
  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) })
  }
  return parts
}

function appendMarginTopStyle(style: string | undefined, marginTop: string): string {
  if (style && /(^|;)\s*margin-top\s*:/.test(style)) return style
  if (!style || style.trim() === '') return `margin-top: ${marginTop};`
  const trimmed = style.trim()
  return `${trimmed.endsWith(';') ? trimmed : `${trimmed};`} margin-top: ${marginTop};`
}

function hasClassToken(node: RichTextElementNode, className: string): boolean {
  const classAttr = node.attrs?.class
  if (!classAttr) return false
  return classAttr.split(/\s+/).includes(className)
}

function getMemoBlockKind(node: RichTextNode): string | null {
  if (!('name' in node)) return null
  const el = node as RichTextElementNode
  if (el.name === 'p' && hasClassToken(el, 'memo-markdown__p')) return 'paragraph'
  if (/^h[1-6]$/.test(el.name) && hasClassToken(el, 'memo-markdown__heading')) return 'heading'
  if (el.name === 'hr' && hasClassToken(el, 'memo-markdown__hr')) return 'hr'
  if (el.name !== 'div') return null
  if (hasClassToken(el, 'memo-markdown__list')) return 'list'
  if (hasClassToken(el, 'memo-markdown__blockquote')) return 'blockquote'
  if (hasClassToken(el, 'memo-markdown__pre')) return 'pre'
  return null
}

export function stripMemoHighlightNodes(nodes: RichTextNode[]): RichTextNode[] {
  const out: RichTextNode[] = []
  for (const node of nodes) {
    if ('type' in node && node.type === 'text') {
      out.push(node)
    } else {
      const el = node as RichTextElementNode
      if (el.name === 'mark' && el.attrs?.class === 'memo-markdown__mark') {
        if (el.children) out.push(...el.children)
      } else if (el.children) {
        out.push({ ...el, children: stripMemoHighlightNodes(el.children) })
      } else {
        out.push(el)
      }
    }
  }
  return out
}

export function memoShareRichTextNodesContainSearchMark(nodes: RichTextNode[]): boolean {
  for (const node of nodes) {
    if ('type' in node && node.type === 'text') continue
    const el = node as RichTextElementNode
    if (el.name === 'mark' && el.attrs?.class === 'memo-markdown__mark') return true
    if (el.children && memoShareRichTextNodesContainSearchMark(el.children)) return true
  }
  return false
}
