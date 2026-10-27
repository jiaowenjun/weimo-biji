const escapeTest = /[&<>"']/
const escapeReplace = new RegExp(escapeTest.source, 'g')
const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/
const escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, 'g')
const escapeReplacements: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escape(html: string, encode?: boolean): string {
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, (ch) => escapeReplacements[ch])
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, (ch) => escapeReplacements[ch])
    }
  }
  return html
}

const unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi

export function unescape(html: string): string {
  return html.replace(unescapeTest, (_, n: string) => {
    n = n.toLowerCase()
    if (n === 'colon') return ':'
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1))
    }
    return ''
  })
}

const caret = /(^|[^\[])\^/g

export function edit(regex: string | RegExp, opt?: string) {
  let source = typeof regex === 'string' ? regex : regex.source
  opt = opt || ''
  const obj = {
    replace: (name: string | RegExp, val: string | RegExp) => {
      let valSource = typeof val === 'string' ? val : val.source
      valSource = valSource.replace(caret, '$1')
      source = source.replace(name, valSource)
      return obj
    },
    getRegex: () => {
      return new RegExp(source, opt)
    },
  }
  return obj
}

export function rtrim(str: string, c: string, invert?: boolean): string {
  const l = str.length
  if (l === 0) return ''
  let suffLen = 0
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1)
    if (currChar === c && !invert) {
      suffLen++
    } else if (currChar !== c && invert) {
      suffLen++
    } else {
      break
    }
  }
  return str.slice(0, l - suffLen)
}

export function splitCells(tableRow: string, count?: number): string[] {
  const row = tableRow.replace(/\|/g, (_match, offset: number, str: string) => {
    let escaped = false
    let curr = offset
    while (--curr >= 0 && str[curr] === '\\') escaped = !escaped
    if (escaped) {
      return '|'
    } else {
      return ' |'
    }
  })
  const cells = row.split(/ \|/)
  let i = 0

  if (!cells[0].trim()) cells.shift()
  if (cells.length > 0 && !cells[cells.length - 1].trim()) cells.pop()

  if (count !== undefined) {
    if (cells.length > count) {
      cells.splice(count)
    } else {
      while (cells.length < count) cells.push('')
    }
  }

  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(/\\\|/g, '|')
  }
  return cells
}

export function findClosingBracket(str: string, b: string): number {
  if (str.indexOf(b[1]) === -1) return -1
  const l = str.length
  let level = 0
  let i = 0
  for (; i < l; i++) {
    if (str[i] === '\\') {
      i++
    } else if (str[i] === b[0]) {
      level++
    } else if (str[i] === b[1]) {
      level--
      if (level < 0) return i
    }
  }
  return -1
}

export function repeatString(pattern: string, count: number): string {
  if (count < 1) return ''
  let result = ''
  while (count > 1) {
    if (count & 1) result += pattern
    count >>= 1
    pattern += pattern
  }
  return result + pattern
}
