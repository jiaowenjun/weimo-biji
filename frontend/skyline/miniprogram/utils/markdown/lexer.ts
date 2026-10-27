import { blockRules, inlineRules } from './rules'
import { escape, rtrim, splitCells, findClosingBracket, repeatString } from './helpers'
import type {
  Token, InlineToken, TokenList, LinkDef,
  SpaceToken, CodeToken, HeadingToken, HrToken, BlockquoteToken,
  ListToken, HtmlToken, ParagraphToken, TextBlockToken,
  TableToken, TableCell,
  EscapeToken, InlineHtmlToken, LinkToken, ImageToken,
  StrongToken, EmToken, CodespanToken, DelToken, InlineTextToken,
} from './types'

interface LexerState {
  inLink: boolean
  inRawBlock: boolean
  top: boolean
}

/** 引用内层无空段且至少两行正文时升格为段落分界，避免 nodes 路径依赖 br */
function prepareBlockquoteInnerForTokens(inner: string): { src: string; tightQuoteLines: boolean } {
  const normalized = inner.replace(/\r\n|\r/g, '\n')
  const hasParagraphBreak = /\n\s*\n/.test(normalized)
  const nonEmptyLines = normalized.split('\n').filter((line) => line.trim() !== '')
  const hasMultipleQuoteLines = nonEmptyLines.length >= 2
  const tightQuoteLines = !hasParagraphBreak && hasMultipleQuoteLines
  const src = tightQuoteLines ? normalized.replace(/\n/g, '\n\n') : normalized
  return { src, tightQuoteLines }
}

function outputLink(
  cap: RegExpExecArray,
  link: LinkDef,
  raw: string,
  lexer: Lexer,
): LinkToken | ImageToken {
  const href = link.href
  const title = link.title ? escape(link.title) : null
  const text = cap[1].replace(/\\([\[\]])/g, '$1')

  if (cap[0].charAt(0) !== '!') {
    const prevInLink = lexer.state.inLink
    lexer.state.inLink = true
    const tokens = lexer.inlineTokens(text)
    lexer.state.inLink = prevInLink
    return { type: 'link', raw, href, title, text, tokens }
  }
  return { type: 'image', raw, href, title, text: escape(text) }
}

function indentCodeCompensation(raw: string, text: string): string {
  const matchIndentToCode = raw.match(/^(\s+)(?:```)/)
  if (matchIndentToCode === null) return text
  const indentToCode = matchIndentToCode[1]
  return text
    .split('\n')
    .map((node) => {
      const matchIndentInNode = node.match(/^\s+/)
      if (matchIndentInNode === null) return node
      const [indentInNode] = matchIndentInNode
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length)
      }
      return node
    })
    .join('\n')
}

export class Lexer {
  tokens: TokenList
  state: LexerState
  private inlineQueue: { src: string; tokens: InlineToken[] }[]

  constructor() {
    this.tokens = [] as unknown as TokenList
    this.tokens.links = Object.create(null)
    this.inlineQueue = []
    this.state = { inLink: false, inRawBlock: false, top: true }
  }

  static lex(src: string): TokenList {
    const lexer = new Lexer()
    return lexer.lex(src)
  }

  lex(src: string): TokenList {
    src = src.replace(/\r\n|\r/g, '\n')
    this.blockTokens(src, this.tokens)
    let next: { src: string; tokens: InlineToken[] } | undefined
    while ((next = this.inlineQueue.shift())) {
      this.inlineTokens(next.src, next.tokens)
    }
    return this.tokens
  }

  blockTokens(src: string, tokens: Token[]): Token[] {
    src = src.replace(/^( *)(\t+)/gm, (_, leading: string, tabs: string) => {
      return leading + '    '.repeat(tabs.length)
    })

    let lastToken: Token | undefined
    let cutSrc: string
    let lastParagraphClipped: boolean | undefined

    while (src) {
      // newline
      const spaceMatch = blockRules.newline.exec(src)
      if (spaceMatch && spaceMatch[0].length > 0) {
        src = src.substring(spaceMatch[0].length)
        if (spaceMatch[0].length === 1 && tokens.length > 0) {
          tokens[tokens.length - 1].raw += '\n'
        } else {
          tokens.push({ type: 'space', raw: spaceMatch[0] } as SpaceToken)
        }
        continue
      }

      // code
      const codeMatch = blockRules.code.exec(src)
      if (codeMatch) {
        src = src.substring(codeMatch[0].length)
        lastToken = tokens[tokens.length - 1]
        if (lastToken && (lastToken.type === 'paragraph' || lastToken.type === 'text')) {
          lastToken.raw += '\n' + codeMatch[0]
          ;(lastToken as TextBlockToken).text += '\n' + codeMatch[0].replace(/^ {1,4}/gm, '')
          this.inlineQueue[this.inlineQueue.length - 1].src = (lastToken as TextBlockToken).text
        } else {
          const text = codeMatch[0].replace(/^ {1,4}/gm, '')
          tokens.push({
            type: 'code',
            raw: codeMatch[0],
            codeBlockStyle: 'indented',
            text: rtrim(text, '\n'),
          } as CodeToken)
        }
        continue
      }

      // fences
      const fencesMatch = blockRules.fences.exec(src)
      if (fencesMatch) {
        src = src.substring(fencesMatch[0].length)
        const raw = fencesMatch[0]
        const text = indentCodeCompensation(raw, fencesMatch[3] || '')
        tokens.push({
          type: 'code',
          raw,
          lang: fencesMatch[2] ? fencesMatch[2].trim().replace(inlineRules._escapes, '$1') : fencesMatch[2],
          text,
        } as CodeToken)
        continue
      }

      // heading
      const headingMatch = blockRules.heading.exec(src)
      if (headingMatch) {
        src = src.substring(headingMatch[0].length)
        let text = headingMatch[2].trim()
        if (/#$/.test(text)) {
          const trimmed = rtrim(text, '#')
          if (!trimmed || / $/.test(trimmed)) {
            text = trimmed.trim()
          }
        }
        const inlineTokens: InlineToken[] = []
        this.inlineQueue.push({ src: text, tokens: inlineTokens })
        tokens.push({
          type: 'heading',
          raw: headingMatch[0],
          depth: headingMatch[1].length,
          text,
          tokens: inlineTokens,
        } as HeadingToken)
        continue
      }

      // hr
      const hrMatch = blockRules.hr.exec(src)
      if (hrMatch) {
        src = src.substring(hrMatch[0].length)
        tokens.push({ type: 'hr', raw: hrMatch[0] } as HrToken)
        continue
      }

      // blockquote (centered `>= ` must match before normal `> `)
      const blockquoteCenteredMatch = blockRules.blockquoteCentered.exec(src)
      if (blockquoteCenteredMatch) {
        src = src.substring(blockquoteCenteredMatch[0].length)
        const text = blockquoteCenteredMatch[0].replace(/^ *>=[ \t]?/gm, '')
        const { src: innerSrc, tightQuoteLines } = prepareBlockquoteInnerForTokens(text)
        const top = this.state.top
        this.state.top = true
        const blockTokens = this.blockTokens(innerSrc, [])
        this.state.top = top
        tokens.push({
          type: 'blockquote',
          raw: blockquoteCenteredMatch[0],
          tokens: blockTokens,
          text,
          centered: true,
          tightQuoteLines: tightQuoteLines || undefined,
        } as BlockquoteToken)
        continue
      }

      // blockquote
      const blockquoteMatch = blockRules.blockquote.exec(src)
      if (blockquoteMatch) {
        src = src.substring(blockquoteMatch[0].length)
        const text = blockquoteMatch[0].replace(/^ *>[ \t]?/gm, '')
        const { src: innerSrc, tightQuoteLines } = prepareBlockquoteInnerForTokens(text)
        const top = this.state.top
        this.state.top = true
        const blockTokens = this.blockTokens(innerSrc, [])
        this.state.top = top
        tokens.push({
          type: 'blockquote',
          raw: blockquoteMatch[0],
          tokens: blockTokens,
          text,
          tightQuoteLines: tightQuoteLines || undefined,
        } as BlockquoteToken)
        continue
      }

      // list
      const listMatch = blockRules.list.exec(src)
      if (listMatch) {
        let raw: string
        let istask: RegExpExecArray | null
        let ischecked: boolean | undefined
        let indent: number
        let blankLine: boolean
        let endsWithBlankLine: boolean | undefined
        let line: string
        let nextLine: string
        let rawLine: string
        let itemContents: string
        let endEarly: boolean

        let bull = listMatch[1].trim()
        const isordered = bull.length > 1
        const list: ListToken = {
          type: 'list',
          raw: '',
          ordered: isordered,
          start: isordered ? +bull.slice(0, -1) : '',
          loose: false,
          items: [],
        }

        bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`

        const itemRegex = new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`)

        while (src) {
          endEarly = false
          const cap = itemRegex.exec(src)
          if (!cap) break
          if (blockRules.hr.test(src)) break

          raw = cap[0]
          src = src.substring(raw.length)

          line = cap[2].split('\n', 1)[0].replace(/^\t+/, (t) => ' '.repeat(3 * t.length))
          nextLine = src.split('\n', 1)[0]

          indent = cap[2].search(/[^ ]/)
          indent = indent > 4 ? 1 : indent
          itemContents = line.slice(indent)
          indent += cap[1].length

          blankLine = false

          if (!line && /^ *$/.test(nextLine)) {
            raw += nextLine + '\n'
            src = src.substring(nextLine.length + 1)
            endEarly = true
          }

          if (!endEarly) {
            const nextBulletRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`)
            const hrRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)
            const fencesBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`)
            const headingBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`)

            while (src) {
              rawLine = src.split('\n', 1)[0]
              nextLine = rawLine

              if (fencesBeginRegex.test(nextLine)) break
              if (headingBeginRegex.test(nextLine)) break
              if (nextBulletRegex.test(nextLine)) break
              if (hrRegex.test(src)) break

              if (nextLine.search(/[^ ]/) >= indent || !nextLine.trim()) {
                itemContents += '\n' + nextLine.slice(indent)
              } else {
                if (blankLine) break
                if (line.search(/[^ ]/) >= 4) break
                if (fencesBeginRegex.test(line)) break
                if (headingBeginRegex.test(line)) break
                if (hrRegex.test(line)) break
                itemContents += '\n' + nextLine
              }

              if (!blankLine && !nextLine.trim()) {
                blankLine = true
              }

              raw += rawLine + '\n'
              src = src.substring(rawLine.length + 1)
              line = nextLine.slice(indent)
            }
          }

          if (!list.loose) {
            if (endsWithBlankLine) {
              list.loose = true
            } else if (/\n *\n *$/.test(raw)) {
              endsWithBlankLine = true
            }
          }

          istask = /^\[[ xX]\] /.exec(itemContents)
          if (istask) {
            ischecked = istask[0] !== '[ ] '
            itemContents = itemContents.replace(/^\[[ xX]\] +/, '')
          }

          list.items.push({
            type: 'list_item',
            raw,
            task: !!istask,
            checked: ischecked,
            loose: false,
            text: itemContents,
            tokens: [],
          })

          list.raw += raw
        }

        list.items[list.items.length - 1].raw = list.items[list.items.length - 1].raw.trimRight()
        list.items[list.items.length - 1].text = list.items[list.items.length - 1].text.trimRight()
        list.raw = list.raw.trimRight()

        const l = list.items.length
        for (let i = 0; i < l; i++) {
          this.state.top = false
          list.items[i].tokens = this.blockTokens(list.items[i].text, [])

          if (!list.loose) {
            const spacers = list.items[i].tokens.filter((t) => t.type === 'space')
            const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => /\n.*\n/.test(t.raw))
            list.loose = hasMultipleLineBreaks
          }
        }

        if (list.loose) {
          for (let i = 0; i < l; i++) {
            list.items[i].loose = true
          }
        }

        tokens.push(list)
        continue
      }

      // html
      const htmlMatch = blockRules.html.exec(src)
      if (htmlMatch) {
        src = src.substring(htmlMatch[0].length)
        tokens.push({
          type: 'html',
          raw: htmlMatch[0],
          pre: htmlMatch[1] === 'pre' || htmlMatch[1] === 'script' || htmlMatch[1] === 'style',
          text: htmlMatch[0],
        } as HtmlToken)
        continue
      }

      // def
      const defMatch = blockRules.def.exec(src)
      if (defMatch) {
        src = src.substring(defMatch[0].length)
        lastToken = tokens[tokens.length - 1]
        if (lastToken && (lastToken.type === 'paragraph' || lastToken.type === 'text')) {
          lastToken.raw += '\n' + defMatch[0]
          ;(lastToken as TextBlockToken).text += '\n' + defMatch[0]
          this.inlineQueue[this.inlineQueue.length - 1].src = (lastToken as TextBlockToken).text
        } else {
          const tag = defMatch[1].toLowerCase().replace(/\s+/g, ' ')
          if (!this.tokens.links[tag]) {
            const href = defMatch[2] ? defMatch[2].replace(/^<(.*)>$/, '$1').replace(inlineRules._escapes, '$1') : ''
            const title = defMatch[3] ? defMatch[3].substring(1, defMatch[3].length - 1).replace(inlineRules._escapes, '$1') : defMatch[3]
            this.tokens.links[tag] = { href, title }
          }
        }
        continue
      }

      // table (gfm)
      const tableMatch = blockRules.table.exec(src)
      if (tableMatch) {
        const item: TableToken = {
          type: 'table',
          header: splitCells(tableMatch[1]).map((c) => ({ text: c, tokens: [] as InlineToken[] })),
          align: tableMatch[2].replace(/^ *|\| *$/g, '').split(/ *\| */) as (string | null)[],
          rows: tableMatch[3] && tableMatch[3].trim()
            ? tableMatch[3].replace(/\n[ \t]*$/, '').split('\n')
            : [],
          raw: '',
        } as unknown as TableToken

        if (item.header.length === (item.align as unknown[]).length) {
          item.raw = tableMatch[0]
          src = src.substring(item.raw.length)

          const l = (item.align as unknown as string[]).length
          for (let i = 0; i < l; i++) {
            const alignStr = (item.align as unknown as string[])[i]
            if (/^ *-+: *$/.test(alignStr)) {
              (item.align as unknown as (string | null)[])[i] = 'right'
            } else if (/^ *:-+: *$/.test(alignStr)) {
              (item.align as unknown as (string | null)[])[i] = 'center'
            } else if (/^ *:-+ *$/.test(alignStr)) {
              (item.align as unknown as (string | null)[])[i] = 'left'
            } else {
              (item.align as unknown as (string | null)[])[i] = null
            }
          }

          const rowStrings = item.rows as unknown as string[]
          const parsedRows: TableCell[][] = []
          for (let i = 0; i < rowStrings.length; i++) {
            parsedRows.push(
              splitCells(rowStrings[i], item.header.length).map((c) => ({ text: c, tokens: [] as InlineToken[] })),
            )
          }
          item.rows = parsedRows

          for (let j = 0; j < item.header.length; j++) {
            const inlineTokens: InlineToken[] = []
            this.inlineQueue.push({ src: item.header[j].text, tokens: inlineTokens })
            item.header[j].tokens = inlineTokens
          }

          for (let j = 0; j < item.rows.length; j++) {
            const row = item.rows[j]
            for (let k = 0; k < row.length; k++) {
              const inlineTokens: InlineToken[] = []
              this.inlineQueue.push({ src: row[k].text, tokens: inlineTokens })
              row[k].tokens = inlineTokens
            }
          }

          tokens.push(item)
          continue
        }
      }

      // lheading
      const lheadingMatch = blockRules.lheading.exec(src)
      if (lheadingMatch) {
        src = src.substring(lheadingMatch[0].length)
        const inlineTokens: InlineToken[] = []
        this.inlineQueue.push({ src: lheadingMatch[1], tokens: inlineTokens })
        tokens.push({
          type: 'heading',
          raw: lheadingMatch[0],
          depth: lheadingMatch[2].charAt(0) === '=' ? 1 : 2,
          text: lheadingMatch[1],
          tokens: inlineTokens,
        } as HeadingToken)
        continue
      }

      // top-level paragraph
      cutSrc = src
      if (this.state.top) {
        const paragraphMatch = blockRules.paragraph.exec(cutSrc)
        if (paragraphMatch) {
          lastToken = tokens[tokens.length - 1]
          if (lastParagraphClipped && lastToken && lastToken.type === 'paragraph') {
            lastToken.raw += '\n' + paragraphMatch[0]
            ;(lastToken as ParagraphToken).text += '\n' + paragraphMatch[1]
            this.inlineQueue.pop()
            this.inlineQueue[this.inlineQueue.length - 1].src = (lastToken as ParagraphToken).text
          } else {
            const text = paragraphMatch[1].charAt(paragraphMatch[1].length - 1) === '\n'
              ? paragraphMatch[1].slice(0, -1)
              : paragraphMatch[1]
            const inlineTokens: InlineToken[] = []
            this.inlineQueue.push({ src: text, tokens: inlineTokens })
            tokens.push({
              type: 'paragraph',
              raw: paragraphMatch[0],
              text,
              tokens: inlineTokens,
            } as ParagraphToken)
          }
          lastParagraphClipped = cutSrc.length !== src.length
          src = src.substring(paragraphMatch[0].length)
          continue
        }
      }

      // text
      const textMatch = blockRules.text.exec(src)
      if (textMatch) {
        src = src.substring(textMatch[0].length)
        lastToken = tokens[tokens.length - 1]
        if (lastToken && lastToken.type === 'text') {
          lastToken.raw += '\n' + textMatch[0]
          ;(lastToken as TextBlockToken).text += '\n' + textMatch[0]
          this.inlineQueue.pop()
          this.inlineQueue[this.inlineQueue.length - 1].src = (lastToken as TextBlockToken).text
        } else {
          const inlineTokens: InlineToken[] = []
          this.inlineQueue.push({ src: textMatch[0], tokens: inlineTokens })
          tokens.push({
            type: 'text',
            raw: textMatch[0],
            text: textMatch[0],
            tokens: inlineTokens,
          } as TextBlockToken)
        }
        continue
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    this.state.top = true
    return tokens
  }

  inlineTokens(src: string, tokens: InlineToken[] = []): InlineToken[] {
    let lastToken: InlineToken | undefined
    let match: RegExpExecArray | null
    let keepPrevChar: boolean = false
    let prevChar: string = ''

    let maskedSrc = src

    // Mask out reflinks
    const links = Object.keys(this.tokens.links)
    if (links.length > 0) {
      const reflinkSearch = new RegExp(inlineRules.reflinkSearch.source, 'g')
      while ((match = reflinkSearch.exec(maskedSrc)) != null) {
        if (links.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
          maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(reflinkSearch.lastIndex)
        }
      }
    }

    // Mask out other blocks
    const blockSkip = new RegExp(inlineRules.blockSkip.source, 'g')
    while ((match = blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(blockSkip.lastIndex)
    }

    // Mask out escaped em & strong delimiters
    const escapedEmSt = new RegExp(inlineRules.escapedEmSt.source, 'g')
    while ((match = escapedEmSt.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index + match[0].length - 2) + '++' + maskedSrc.slice(escapedEmSt.lastIndex)
      escapedEmSt.lastIndex--
    }

    while (src) {
      if (!keepPrevChar) {
        prevChar = ''
      }
      keepPrevChar = false

      // escape
      const escapeMatch = inlineRules.escape.exec(src)
      if (escapeMatch) {
        src = src.substring(escapeMatch[0].length)
        tokens.push({ type: 'escape', raw: escapeMatch[0], text: escape(escapeMatch[1]) } as EscapeToken)
        continue
      }

      // tag
      const tagMatch = inlineRules.tag.exec(src)
      if (tagMatch) {
        src = src.substring(tagMatch[0].length)
        if (!this.state.inLink && /^<a /i.test(tagMatch[0])) {
          this.state.inLink = true
        } else if (this.state.inLink && /^<\/a>/i.test(tagMatch[0])) {
          this.state.inLink = false
        }
        if (!this.state.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(tagMatch[0])) {
          this.state.inRawBlock = true
        } else if (this.state.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(tagMatch[0])) {
          this.state.inRawBlock = false
        }

        const token: InlineHtmlToken = {
          type: 'html',
          raw: tagMatch[0],
          inLink: this.state.inLink,
          inRawBlock: this.state.inRawBlock,
          text: tagMatch[0],
        }
        tokens.push(token)
        continue
      }

      // link
      const linkMatch = inlineRules.link.exec(src)
      if (linkMatch) {
        const trimmedUrl = linkMatch[2].trim()
        if (/^</.test(trimmedUrl)) {
          if (!(/>$/.test(trimmedUrl))) {
            // skip — no matching angle bracket
          } else {
            const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\')
            if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
              // skip — escaped ending bracket
            } else {
              const href = trimmedUrl.slice(1, -1)
              const title = linkMatch[3] ? linkMatch[3].slice(1, -1) : ''
              const result = outputLink(linkMatch, {
                href: href ? href.replace(inlineRules._escapes, '$1') : href,
                title: title ? title.replace(inlineRules._escapes, '$1') : title,
              }, linkMatch[0], this)
              src = src.substring(linkMatch[0].length)
              tokens.push(result)
              continue
            }
          }
        } else {
          const lastParenIndex = findClosingBracket(linkMatch[2], '()')
          if (lastParenIndex > -1) {
            const start = linkMatch[0].indexOf('!') === 0 ? 5 : 4
            const linkLen = start + linkMatch[1].length + lastParenIndex
            linkMatch[2] = linkMatch[2].substring(0, lastParenIndex)
            linkMatch[0] = linkMatch[0].substring(0, linkLen).trim()
            linkMatch[3] = ''
          }
          let href = linkMatch[2]
          let title = ''
          title = linkMatch[3] ? linkMatch[3].slice(1, -1) : ''

          href = href.trim()
          if (/^</.test(href)) {
            href = href.slice(1, -1)
          }
          const result = outputLink(linkMatch, {
            href: href ? href.replace(inlineRules._escapes, '$1') : href,
            title: title ? title.replace(inlineRules._escapes, '$1') : title,
          }, linkMatch[0], this)
          src = src.substring(linkMatch[0].length)
          tokens.push(result)
          continue
        }
      }

      // reflink, nolink
      let reflinkCap: RegExpExecArray | null
      if ((reflinkCap = inlineRules.reflink.exec(src)) || (reflinkCap = inlineRules.nolink.exec(src))) {
        let link = (reflinkCap[2] || reflinkCap[1]).replace(/\s+/g, ' ')
        const linkDef = this.tokens.links[link.toLowerCase()]
        if (!linkDef) {
          const text = reflinkCap[0].charAt(0)
          src = src.substring(text.length)
          lastToken = tokens[tokens.length - 1]
          if (lastToken && lastToken.type === 'text') {
            lastToken.raw += text
            ;(lastToken as InlineTextToken).text += text
          } else {
            tokens.push({ type: 'text', raw: text, text } as InlineTextToken)
          }
        } else {
          const result = outputLink(reflinkCap, linkDef, reflinkCap[0], this)
          src = src.substring(reflinkCap[0].length)
          tokens.push(result)
        }
        continue
      }

      // em & strong
      const emStrongResult = this.emStrong(src, maskedSrc, prevChar)
      if (emStrongResult) {
        src = src.substring(emStrongResult.raw.length)
        tokens.push(emStrongResult)
        continue
      }

      // code
      const codespanMatch = inlineRules.code.exec(src)
      if (codespanMatch) {
        src = src.substring(codespanMatch[0].length)
        let text = codespanMatch[2].replace(/\n/g, ' ')
        const hasNonSpaceChars = /[^ ]/.test(text)
        const hasSpaceCharsOnBothEnds = /^ /.test(text) && / $/.test(text)
        if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
          text = text.substring(1, text.length - 1)
        }
        text = escape(text, true)
        tokens.push({ type: 'codespan', raw: codespanMatch[0], text } as CodespanToken)
        continue
      }

      // br — Skyline 不支持 <br>，转为空格
      const brMatch = inlineRules.br.exec(src)
      if (brMatch) {
        src = src.substring(brMatch[0].length)
        tokens.push({ type: 'text', raw: brMatch[0], text: ' ' } as InlineTextToken)
        continue
      }

      // del (gfm)
      const delMatch = inlineRules.del.exec(src)
      if (delMatch) {
        src = src.substring(delMatch[0].length)
        tokens.push({
          type: 'del',
          raw: delMatch[0],
          text: delMatch[2],
          tokens: this.inlineTokens(delMatch[2]),
        } as DelToken)
        continue
      }

      // autolink
      const autolinkMatch = inlineRules.autolink.exec(src)
      if (autolinkMatch) {
        src = src.substring(autolinkMatch[0].length)
        let text: string
        let href: string
        if (autolinkMatch[2] === '@') {
          text = escape(autolinkMatch[1])
          href = 'mailto:' + text
        } else {
          text = escape(autolinkMatch[1])
          href = text
        }
        tokens.push({
          type: 'link',
          raw: autolinkMatch[0],
          text,
          href,
          title: null,
          tokens: [{ type: 'text', raw: text, text } as InlineTextToken],
        } as LinkToken)
        continue
      }

      // url (gfm)
      if (!this.state.inLink) {
        const urlMatch = inlineRules.url.exec(src)
        if (urlMatch) {
          let text: string
          let href: string
          if (urlMatch[2] === '@') {
            text = escape(urlMatch[0])
            href = 'mailto:' + text
          } else {
            let prevCapZero: string
            let cap0 = urlMatch[0]
            do {
              prevCapZero = cap0
              const backpedal = inlineRules._backpedal.exec(cap0)
              cap0 = backpedal ? backpedal[0] : cap0
            } while (prevCapZero !== cap0)
            text = escape(cap0)
            if (urlMatch[1] === 'www.') {
              href = 'http://' + cap0
            } else {
              href = cap0
            }
            // Adjust src consumption to actual matched length
            src = src.substring(cap0.length)
            tokens.push({
              type: 'link',
              raw: cap0,
              text,
              href,
              title: null,
              tokens: [{ type: 'text', raw: text, text } as InlineTextToken],
            } as LinkToken)
            continue
          }
          src = src.substring(urlMatch[0].length)
          tokens.push({
            type: 'link',
            raw: urlMatch[0],
            text,
            href,
            title: null,
            tokens: [{ type: 'text', raw: text, text } as InlineTextToken],
          } as LinkToken)
          continue
        }
      }

      // text
      const textMatch = inlineRules.text.exec(src)
      if (textMatch) {
        src = src.substring(textMatch[0].length)
        let text: string
        if (this.state.inRawBlock) {
          text = textMatch[0]
        } else {
          text = escape(textMatch[0])
        }
        if (textMatch[0].slice(-1) !== '_') {
          prevChar = textMatch[0].slice(-1)
        }
        keepPrevChar = true
        lastToken = tokens[tokens.length - 1]
        if (lastToken && lastToken.type === 'text') {
          lastToken.raw += textMatch[0]
          ;(lastToken as InlineTextToken).text += text
        } else {
          tokens.push({ type: 'text', raw: textMatch[0], text } as InlineTextToken)
        }
        continue
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    return tokens
  }

  private emStrong(src: string, maskedSrc: string, prevChar: string): StrongToken | EmToken | undefined {
    let match = inlineRules.emStrong.lDelim.exec(src)
    if (!match) return undefined

    if (match[3] && prevChar.match(/[\p{L}\p{N}]/u)) return undefined

    const nextChar = match[1] || match[2] || ''

    if (!nextChar || (nextChar && (prevChar === '' || inlineRules.punctuation.exec(prevChar)))) {
      const lLength = match[0].length - 1
      let rDelim: string | undefined
      let rLength: number
      let delimTotal = lLength
      let midDelimTotal = 0

      const endReg = match[0][0] === '*'
        ? new RegExp(inlineRules.emStrong.rDelimAst.source, 'g')
        : new RegExp(inlineRules.emStrong.rDelimUnd.source, 'g')
      endReg.lastIndex = 0

      maskedSrc = maskedSrc.slice(-1 * src.length + lLength)

      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6]

        if (!rDelim) continue

        rLength = rDelim.length

        if (match[3] || match[4]) {
          delimTotal += rLength
          continue
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength
            continue
          }
        }

        delimTotal -= rLength

        if (delimTotal > 0) continue

        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal)

        const raw = src.slice(0, lLength + match.index + (match[0].length - rDelim.length) + rLength)

        if (Math.min(lLength, rLength) % 2) {
          const text = raw.slice(1, -1)
          return {
            type: 'em',
            raw,
            text,
            tokens: this.inlineTokens(text),
          }
        }

        const text = raw.slice(2, -2)
        return {
          type: 'strong',
          raw,
          text,
          tokens: this.inlineTokens(text),
        }
      }
    }

    return undefined
  }
}
