export interface SelectionRange {
  start: number
  end: number
}

interface LineRange {
  lineStart: number
  lineEnd: number
}

export interface FormattingToggleResult {
  content: string
  selectionStart: number
  selectionEnd: number
}

export interface ToolbarState {
  headingActive: boolean
  listActive: boolean
  quoteActive: boolean
  centerQuoteActive: boolean
}

export const HEADING_PREFIX = '# '
export const LIST_PREFIX = '- '
export const QUOTE_PREFIX = '> '
export const CENTER_QUOTE_PREFIX = '>= '
const BLOCK_PREFIXES = [CENTER_QUOTE_PREFIX, HEADING_PREFIX, QUOTE_PREFIX, LIST_PREFIX]

function normalizeSelectionRange(start: number, end: number): SelectionRange {
  if (start <= end) {
    return { start, end }
  }
  return { start: end, end: start }
}

export function resolveFormattingSelection(
  start: number,
  end: number,
  contentLength: number,
): SelectionRange {
  if (start < 0 || end < 0 || start > contentLength || end > contentLength) {
    return { start: contentLength, end: contentLength }
  }
  return normalizeSelectionRange(start, end)
}

// 计算两步 setData 的中转选区值：必须是有效下标，且尽量等于当前真实光标，
// 这样第一步 setData 不会把光标移走，第二步再切到 target，即可消除抖动。
export function safeIntermediateRange(
  cachedStart: number,
  cachedEnd: number,
  contentLength: number,
): SelectionRange {
  const clamp = (v: number) => (v < 0 ? 0 : v > contentLength ? contentLength : v)
  return normalizeSelectionRange(clamp(cachedStart), clamp(cachedEnd))
}


// 列出选区涉及的所有「行」的 [lineStart, lineEnd) 区间（lineEnd 不含结尾 \n）。
// 边界规则：当 sStart < sEnd 且 sEnd 恰好落在某行行首（== 该行 lineStart）时，
// 不把该行算作涉及行——避免「仅选到换行符」被算作下一行。
function getInvolvedLineRanges(content: string, start: number, end: number): LineRange[] {
  const range = normalizeSelectionRange(start, end)

  const ranges: LineRange[] = []
  let lineStart = content.lastIndexOf('\n', Math.max(range.start - 1, 0)) + 1
  if (range.start === 0) lineStart = 0

  while (lineStart <= content.length) {
    let lineEnd = content.indexOf('\n', lineStart)
    if (lineEnd === -1) lineEnd = content.length

    const isFirst = ranges.length === 0
    if (!isFirst && range.start < range.end && lineStart === range.end) {
      break
    }

    ranges.push({ lineStart, lineEnd })

    if (lineEnd >= range.end) break
    lineStart = lineEnd + 1
  }

  return ranges
}

function areAllLinesPrefixed(content: string, lines: LineRange[], prefix: string): boolean {
  if (lines.length === 0) return false

  const prefixLength = prefix.length
  for (const { lineStart, lineEnd } of lines) {
    if (lineEnd - lineStart < prefixLength) return false
    if (content.slice(lineStart, lineStart + prefixLength) !== prefix) return false
  }
  return true
}

export function resolveToolbarState(content: string, start: number, end: number): ToolbarState {
  if (start < 0 || end < 0) {
    return {
      headingActive: false,
      listActive: false,
      quoteActive: false,
      centerQuoteActive: false,
    }
  }

  const range = normalizeSelectionRange(start, end)
  const lines = getInvolvedLineRanges(content, range.start, range.end)
  const headingActive = areAllLinesPrefixed(content, lines, HEADING_PREFIX)
  const centerQuoteActive = areAllLinesPrefixed(content, lines, CENTER_QUOTE_PREFIX)

  return {
    headingActive,
    listActive: !headingActive && areAllLinesPrefixed(content, lines, LIST_PREFIX),
    quoteActive: !headingActive && !centerQuoteActive && areAllLinesPrefixed(content, lines, QUOTE_PREFIX),
    centerQuoteActive: !headingActive && centerQuoteActive,
  }
}

function findLineBlockPrefix(content: string, lineStart: number): string | null {
  for (const p of BLOCK_PREFIXES) {
    if (content.slice(lineStart, lineStart + p.length) === p) return p
  }
  return null
}

export function toggleLinePrefixFormatting(
  content: string,
  start: number,
  end: number,
  prefix: string,
): FormattingToggleResult {
  const range = resolveFormattingSelection(start, end, content.length)
  const lines = getInvolvedLineRanges(content, range.start, range.end)
  const prefixLength = prefix.length
  const isPrefixed = areAllLinesPrefixed(content, lines, prefix)
  const lineCount = lines.length

  let newContent = content
  let newStart: number
  let newEnd: number

  if (isPrefixed) {
    // 删除每行行首的前缀（从后往前删，避免影响前面行的下标）
    for (let i = lineCount - 1; i >= 0; i -= 1) {
      const { lineStart } = lines[i]
      newContent = newContent.slice(0, lineStart) + newContent.slice(lineStart + prefixLength)
    }

    const firstLineStart = lines[0].lineStart
    const lastLineStart = lines[lineCount - 1].lineStart
    if (lineCount === 1) {
      newStart = Math.max(firstLineStart, range.start - prefixLength)
      newEnd = Math.max(firstLineStart, range.end - prefixLength)
    } else {
      newStart = Math.max(firstLineStart, range.start - prefixLength)
      const newLastLineStart = lastLineStart - prefixLength * (lineCount - 1)
      newEnd = Math.max(newLastLineStart, range.end - prefixLength * lineCount)
    }
  } else {
    // 切换块级格式时先剥离已有前缀，保证标题/列表/引用互斥。
    let offsetAccum = 0
    for (let i = 0; i < lineCount; i += 1) {
      const adjustedLineStart = lines[i].lineStart + offsetAccum
      const existing = findLineBlockPrefix(newContent, adjustedLineStart)
      if (existing) {
        newContent = newContent.slice(0, adjustedLineStart) + newContent.slice(adjustedLineStart + existing.length)
        offsetAccum -= existing.length
      }
    }

    const strippedStart = Math.max(0, range.start + Math.min(offsetAccum, 0))
    const strippedEnd = Math.max(0, range.end + offsetAccum)
    const strippedLines = getInvolvedLineRanges(newContent, strippedStart, strippedEnd)

    for (let i = strippedLines.length - 1; i >= 0; i -= 1) {
      const { lineStart } = strippedLines[i]
      newContent = newContent.slice(0, lineStart) + prefix + newContent.slice(lineStart)
    }

    if (lineCount === 1) {
      newStart = strippedStart + prefixLength
      newEnd = strippedEnd + prefixLength
    } else {
      newStart = strippedStart + prefixLength
      newEnd = strippedEnd + prefixLength * lineCount
    }
  }

  return {
    content: newContent,
    selectionStart: newStart,
    selectionEnd: newEnd,
  }
}

const ENTER_AUTO_PREFIXES = [LIST_PREFIX, QUOTE_PREFIX, CENTER_QUOTE_PREFIX]

export function applyBlockEnterAutoFormat(
  prev: string,
  next: string,
): FormattingToggleResult | null {
  if (next.length !== prev.length + 1) return null

  let insertPos = -1
  for (let i = 0; i < next.length; i++) {
    if (i >= prev.length || next[i] !== prev[i]) {
      insertPos = i
      break
    }
  }
  if (insertPos === -1) return null
  if (next[insertPos] !== '\n') return null
  if (next.slice(insertPos + 1) !== prev.slice(insertPos)) return null

  const lineStart = insertPos === 0 ? 0 : prev.lastIndexOf('\n', insertPos - 1) + 1
  let lineEnd = prev.indexOf('\n', lineStart)
  if (lineEnd === -1) lineEnd = prev.length

  if (insertPos !== lineEnd) return null

  const prefix = findLineBlockPrefix(prev, lineStart)
  if (!prefix || !ENTER_AUTO_PREFIXES.includes(prefix)) return null

  const body = prev.slice(lineStart + prefix.length, lineEnd)

  if (body.trim().length === 0) {
    const before = prev.slice(0, lineStart)
    const after = prev.slice(lineEnd)
    const content = before + after
    const cursor = before.length + 1
    return { content: content.slice(0, before.length) + '\n' + content.slice(before.length), selectionStart: cursor, selectionEnd: cursor }
  }

  const content = prev.slice(0, insertPos) + '\n' + prefix + prev.slice(insertPos)
  const cursor = insertPos + 1 + prefix.length
  return { content, selectionStart: cursor, selectionEnd: cursor }
}
