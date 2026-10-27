import { edit } from './helpers'

const noopTest = { exec: () => null as RegExpExecArray | null }

// ─── Block-Level Grammar ───

const block_newline = /^(?: *(?:\n|$))+/
const block_code = /^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/
const block_fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/
const block_hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/
const block_heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/
const block_lheading = /^((?:.|\n(?!\n))+?)\n {0,3}(=+|-+) *(?:\n+|$)/
const block_text = /^[^\n]+/

const block_bullet = /(?:[*+-]|\d{1,9}[.)])/
const block_listItemStart = edit(/^( *)(bull) */)
  .replace('bull', block_bullet)
  .getRegex()

const block__label = /(?!\s*\])(?:\\.|[^\[\]\\])+/
const block__title = /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/
const block_def = edit(/^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/)
  .replace('label', block__label)
  .replace('title', block__title)
  .getRegex()

const block__tag = 'address|article|aside|base|basefont|blockquote|body|caption'
  + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
  + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe'
  + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option'
  + '|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr'
  + '|track|ul'
const block__comment = /<!--(?!-?>)[\s\S]*?(?:-->|$)/

const block_html = edit(
  '^ {0,3}(?:'
  + '<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)'
  + '|comment[^\\n]*(\\n+|$)'
  + '|<\\?[\\s\\S]*?(?:\\?>\\n*|$)'
  + '|<![A-Z][\\s\\S]*?(?:>\\n*|$)'
  + '|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)'
  + '|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)'
  + '|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)'
  + '|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)'
  + ')',
  'i',
)
  .replace('comment', block__comment)
  .replace('tag', block__tag)
  .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
  .getRegex()

const block_blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
  .replace('paragraph', edit(/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/)
    .replace('hr', block_hr)
    .replace('heading', ' {0,3}#{1,6} ')
    .replace('|lheading', '')
    .replace('|table', '')
    .replace('blockquote', ' {0,3}>')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
    .replace('tag', block__tag)
    .getRegex(),
  )
  .getRegex()

const block_blockquoteCentered = edit(/^( {0,3}>= ?(paragraph|[^\n]*)(?:\n|$))+/)
  .replace('paragraph', edit(/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/)
    .replace('hr', block_hr)
    .replace('heading', ' {0,3}#{1,6} ')
    .replace('|lheading', '')
    .replace('|table', '')
    .replace('blockquote', ' {0,3}>=?')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
    .replace('tag', block__tag)
    .getRegex(),
  )
  .getRegex()

const block_list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/)
  .replace(/bull/g, block_bullet)
  .replace('hr', '\\n+(?=\\1?(?:(?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$))')
  .replace('def', '\\n+(?=' + block_def.source + ')')
  .getRegex()

// GFM table
const block_gfm_table = edit(
  '^ *([^\\n ].*\\|.*)\\n'
  + ' {0,3}(?:\\| *)?(:?-+:? *(?:\\| *:?-+:? *)*)(?:\\| *)?'
  + '(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)',
)
  .replace('hr', block_hr)
  .replace('heading', ' {0,3}#{1,6} ')
  .replace('blockquote', ' {0,3}>')
  .replace('code', ' {4}[^\\n]')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
  .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
  .replace('tag', block__tag)
  .getRegex()

// GFM paragraph (can be interrupted by table)
const block_gfm_paragraph = edit(/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/)
  .replace('hr', block_hr)
  .replace('heading', ' {0,3}#{1,6} ')
  .replace('|lheading', '')
  .replace('table', block_gfm_table)
  .replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
  .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
  .replace('tag', block__tag)
  .getRegex()

export interface BlockRules {
  newline: RegExp
  code: RegExp
  fences: RegExp
  hr: RegExp
  heading: RegExp
  blockquote: RegExp
  blockquoteCentered: RegExp
  list: RegExp
  html: RegExp
  def: RegExp
  table: RegExp | typeof noopTest
  lheading: RegExp
  paragraph: RegExp
  text: RegExp
  bullet: RegExp
  listItemStart: RegExp
}

export const blockRules: BlockRules = {
  newline: block_newline,
  code: block_code,
  fences: block_fences,
  hr: block_hr,
  heading: block_heading,
  blockquote: block_blockquote,
  blockquoteCentered: block_blockquoteCentered,
  list: block_list,
  html: block_html,
  def: block_def,
  table: block_gfm_table,
  lheading: block_lheading,
  paragraph: block_gfm_paragraph,
  text: block_text,
  bullet: block_bullet,
  listItemStart: block_listItemStart,
}

// ─── Inline-Level Grammar ───

const inline__punctuation = '!"#$%&\'()+\\-.,/:;<=>?@\\[\\]`^{|}~'

const inline_escape = edit(/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/)
  .replace('])', '~|])')
  .getRegex()

const inline__escapes = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/g

const inline__comment = edit(block__comment).replace('(?:-->|$)', '-->').getRegex()
const inline__attribute = /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/

const inline_tag = edit(
  '^comment'
  + '|^</[a-zA-Z][\\w:-]*\\s*>'
  + '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>'
  + '|^<\\?[\\s\\S]*?\\?>'
  + '|^<![a-zA-Z]+\\s[\\s\\S]*?>'
  + '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>',
)
  .replace('comment', inline__comment)
  .replace('attribute', inline__attribute)
  .getRegex()

const inline__label = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/
const inline__href = /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/
const inline__title = /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/

const inline_link = edit(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/)
  .replace('label', inline__label)
  .replace('href', inline__href)
  .replace('title', inline__title)
  .getRegex()

const inline_reflink = edit(/^!?\[(label)\]\[(ref)\]/)
  .replace('label', inline__label)
  .replace('ref', block__label)
  .getRegex()

const inline_nolink = edit(/^!?\[(ref)\](?:\[\])?/)
  .replace('ref', block__label)
  .getRegex()

const inline_reflinkSearch = edit('reflink|nolink(?!\\()', 'g')
  .replace('reflink', inline_reflink)
  .replace('nolink', inline_nolink)
  .getRegex()

const inline_code = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/

// single newline triggers inline br match (rendered as space for Skyline)
const inline_br = edit(/^( {2,}|\\)\n(?!\s*$)/).replace('{2,}', '*').getRegex()

// GFM strikethrough
const inline_del = /^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/

// GFM auto-linking
const inline__extended_email = /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/
const inline_url = edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, 'i')
  .replace('email', inline__extended_email)
  .getRegex()
const inline__backpedal = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/

const inline__scheme = /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/
const inline__email = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/
const inline_autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
  .replace('scheme', inline__scheme)
  .replace('email', inline__email)
  .getRegex()

// emStrong rules
const inline_emStrong_lDelim = edit(/^(?:\*+(?:([punct_])|[^\s*]))|^_+(?:([punct*])|([^\s_]))/)
  .replace(/punct/g, inline__punctuation)
  .getRegex()

const inline_emStrong_rDelimAst = edit(
  /^(?:[^_*\\]|\\.)*?\_\_(?:[^_*\\]|\\.)*?\*(?:[^_*\\]|\\.)*?(?=\_\_)|(?:[^*\\]|\\.)+(?=[^*])|[punct_](\*+)(?=[\s]|$)|(?:[^punct*_\s\\]|\\.)(\*+)(?=[punct_\s]|$)|[punct_\s](\*+)(?=[^punct*_\s])|[\s](\*+)(?=[punct_])|[punct_](\*+)(?=[punct_])|(?:[^punct*_\s\\]|\\.)(\*+)(?=[^punct*_\s])/,
  'g',
)
  .replace(/punct/g, inline__punctuation)
  .getRegex()

const inline_emStrong_rDelimUnd = edit(
  /^(?:[^_*\\]|\\.)*?\*\*(?:[^_*\\]|\\.)*?\_(?:[^_*\\]|\\.)*?(?=\*\*)|(?:[^_\\]|\\.)+(?=[^_])|[punct*](\_+)(?=[\s]|$)|(?:[^punct*_\s\\]|\\.)(\_+)(?=[punct*\s]|$)|[punct*\s](\_+)(?=[^punct*_\s])|[\s](\_+)(?=[punct*])|[punct*](\_+)(?=[punct*])/,
  'g',
)
  .replace(/punct/g, inline__punctuation)
  .getRegex()

const inline_punctuation = edit(/^([\spunctuation])/)
  .replace(/punctuation/g, inline__punctuation)
  .getRegex()

// text rule (stops at single newline for br matching)
const inline_text = edit(
  /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/,
)
  .replace('\\b_', '\\b_| {2,}\\n')
  .replace(/\{2,\}/g, '*')
  .getRegex()

const inline_blockSkip = /\[[^\]]*?\]\([^\)]*?\)|`[^`]*?`|<[^>]*?>/g
const inline_escapedEmSt = /(?:^|[^\\])(?:\\\\)*\\[*_]/g

export interface InlineRules {
  escape: RegExp
  autolink: RegExp
  url: RegExp
  tag: RegExp
  link: RegExp
  reflink: RegExp
  nolink: RegExp
  reflinkSearch: RegExp
  emStrong: {
    lDelim: RegExp
    rDelimAst: RegExp
    rDelimUnd: RegExp
  }
  code: RegExp
  br: RegExp
  del: RegExp
  text: RegExp
  punctuation: RegExp
  _escapes: RegExp
  _backpedal: RegExp
  blockSkip: RegExp
  escapedEmSt: RegExp
}

export const inlineRules: InlineRules = {
  escape: inline_escape,
  autolink: inline_autolink,
  url: inline_url,
  tag: inline_tag,
  link: inline_link,
  reflink: inline_reflink,
  nolink: inline_nolink,
  reflinkSearch: inline_reflinkSearch,
  emStrong: {
    lDelim: inline_emStrong_lDelim,
    rDelimAst: inline_emStrong_rDelimAst,
    rDelimUnd: inline_emStrong_rDelimUnd,
  },
  code: inline_code,
  br: inline_br,
  del: inline_del,
  text: inline_text,
  punctuation: inline_punctuation,
  _escapes: inline__escapes,
  _backpedal: inline__backpedal,
  blockSkip: inline_blockSkip,
  escapedEmSt: inline_escapedEmSt,
}
