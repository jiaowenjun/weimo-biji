import type { RendererMethods } from './types'
import { escape } from './helpers'

export class Renderer implements RendererMethods {
  paragraph(text: string): string {
    return `<p>${text}</p>\n`
  }

  heading(text: string, level: number, _raw: string): string {
    return `<h${level}>${text}</h${level}>\n`
  }

  strong(text: string): string {
    return `<strong>${text}</strong>`
  }

  em(text: string): string {
    return `<em>${text}</em>`
  }

  del(text: string): string {
    return `<del>${text}</del>`
  }

  blockquote(quote: string, _centered?: boolean, _tightQuoteLines?: boolean): string {
    return `<blockquote>\n${quote}</blockquote>\n`
  }

  list(body: string, ordered: boolean, start: number | ''): string {
    const type = ordered ? 'ol' : 'ul'
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : ''
    return `<${type}${startAttr}>\n${body}</${type}>\n`
  }

  listitem(text: string): string {
    return `<li>${text}</li>\n`
  }

  checkbox(checked: boolean): string {
    return `<input ${checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `
  }

  codespan(code: string): string {
    return `<code>${code}</code>`
  }

  code(code: string, infostring: string | undefined, escaped: boolean): string {
    const lang = (infostring || '').match(/\S*/)?.[0]
    const content = escaped ? code : escape(code, true)
    if (lang) {
      return `<pre><code class="language-${escape(lang, true)}">${content}</code></pre>\n`
    }
    return `<pre><code>${content}</code></pre>\n`
  }

  link(href: string | null, title: string | null, text: string): string {
    if (href === null) return text
    let out = `<a href="${escape(href)}"`
    if (title) out += ` title="${escape(title)}"`
    out += `>${text}</a>`
    return out
  }

  image(href: string | null, title: string | null, text: string): string {
    if (href === null) return escape(text)
    let out = `<img src="${escape(href)}" alt="${escape(text)}"`
    if (title) out += ` title="${escape(title)}"`
    out += '>'
    return out
  }

  hr(): string {
    return '<hr>\n'
  }

  br(): string {
    return '<br>'
  }

  html(html: string): string {
    return html
  }

  table(header: string, body: string): string {
    if (body) body = `<tbody>${body}</tbody>`
    return `<table>\n<thead>\n${header}</thead>\n${body}</table>\n`
  }

  tablerow(content: string): string {
    return `<tr>\n${content}</tr>\n`
  }

  tablecell(
    content: string,
    flags: { header: boolean; align: 'center' | 'left' | 'right' | null },
  ): string {
    const type = flags.header ? 'th' : 'td'
    const tag = flags.align ? `<${type} align="${flags.align}">` : `<${type}>`
    return `${tag}${content}</${type}>\n`
  }

  text(text: string): string {
    return text
  }
}
