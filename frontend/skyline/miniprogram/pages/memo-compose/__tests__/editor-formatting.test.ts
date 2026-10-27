import { describe, expect, it } from 'vitest'
import {
  applyBlockEnterAutoFormat,
  CENTER_QUOTE_PREFIX,
  HEADING_PREFIX,
  LIST_PREFIX,
  QUOTE_PREFIX,
  resolveToolbarState,
  toggleLinePrefixFormatting,
} from '../editor-formatting'

describe('editor-formatting', () => {
  describe('toggleLinePrefixFormatting', () => {
    it('toggles heading prefixes on the current line', () => {
      const inserted = toggleLinePrefixFormatting('alpha', 2, 2, HEADING_PREFIX)

      expect(inserted).toEqual({
        content: '# alpha',
        selectionStart: 4,
        selectionEnd: 4,
      })

      const removed = toggleLinePrefixFormatting(
        inserted.content,
        inserted.selectionStart,
        inserted.selectionEnd,
        HEADING_PREFIX,
      )

      expect(removed).toEqual({
        content: 'alpha',
        selectionStart: 2,
        selectionEnd: 2,
      })
    })

    it('toggles heading prefixes across multiple selected lines', () => {
      const inserted = toggleLinePrefixFormatting('alpha\nbeta', 0, 10, HEADING_PREFIX)

      expect(inserted).toEqual({
        content: '# alpha\n# beta',
        selectionStart: 2,
        selectionEnd: 14,
      })

      const removed = toggleLinePrefixFormatting(
        inserted.content,
        inserted.selectionStart,
        inserted.selectionEnd,
        HEADING_PREFIX,
      )

      expect(removed).toEqual({
        content: 'alpha\nbeta',
        selectionStart: 0,
        selectionEnd: 10,
      })
    })

    it('toggles list prefixes across multiple selected lines', () => {
      const inserted = toggleLinePrefixFormatting('alpha\nbeta', 0, 10, LIST_PREFIX)

      expect(inserted).toEqual({
        content: '- alpha\n- beta',
        selectionStart: 2,
        selectionEnd: 14,
      })

      const removed = toggleLinePrefixFormatting(inserted.content, inserted.selectionStart, inserted.selectionEnd, LIST_PREFIX)

      expect(removed).toEqual({
        content: 'alpha\nbeta',
        selectionStart: 0,
        selectionEnd: 10,
      })
    })

    it('toggles quote prefixes across multiple selected lines', () => {
      const inserted = toggleLinePrefixFormatting('alpha\nbeta', 0, 10, QUOTE_PREFIX)

      expect(inserted).toEqual({
        content: '> alpha\n> beta',
        selectionStart: 2,
        selectionEnd: 14,
      })

      const removed = toggleLinePrefixFormatting(
        inserted.content,
        inserted.selectionStart,
        inserted.selectionEnd,
        QUOTE_PREFIX,
      )

      expect(removed).toEqual({
        content: 'alpha\nbeta',
        selectionStart: 0,
        selectionEnd: 10,
      })
    })

    it('replaces existing block prefixes when switching to heading', () => {
      expect(toggleLinePrefixFormatting('- alpha', 2, 7, HEADING_PREFIX)).toEqual({
        content: '# alpha',
        selectionStart: 2,
        selectionEnd: 7,
      })
      expect(toggleLinePrefixFormatting('> alpha', 2, 7, HEADING_PREFIX)).toEqual({
        content: '# alpha',
        selectionStart: 2,
        selectionEnd: 7,
      })
      expect(toggleLinePrefixFormatting('>= alpha', 3, 8, HEADING_PREFIX)).toEqual({
        content: '# alpha',
        selectionStart: 2,
        selectionEnd: 7,
      })
    })

    it('falls back to the content end when the selection is out of range', () => {
      const result = toggleLinePrefixFormatting('alpha', 99, 99, LIST_PREFIX)

      expect(result).toEqual({
        content: '- alpha',
        selectionStart: 7,
        selectionEnd: 7,
      })
    })
  })

  describe('resolveToolbarState', () => {
    it('ignores bold markers when classifying toolbar state', () => {
      expect(resolveToolbarState('hello **world**', 8, 13)).toEqual({
        headingActive: false,
        listActive: false,
        quoteActive: false,
        centerQuoteActive: false,
      })
    })

    it('detects heading prefixes across the involved lines', () => {
      expect(resolveToolbarState('# alpha\n# beta', 2, 14)).toEqual({
        headingActive: true,
        listActive: false,
        quoteActive: false,
        centerQuoteActive: false,
      })
    })

    it('detects list prefixes across the involved lines', () => {
      expect(resolveToolbarState('- alpha\n- beta', 2, 13)).toEqual({
        headingActive: false,
        listActive: true,
        quoteActive: false,
        centerQuoteActive: false,
      })
    })

    it('detects quote prefixes across the involved lines', () => {
      expect(resolveToolbarState('> alpha\n> beta', 2, 13)).toEqual({
        headingActive: false,
        listActive: false,
        quoteActive: true,
        centerQuoteActive: false,
      })
    })

    it('detects centered quote prefixes without also selecting quote', () => {
      expect(resolveToolbarState('>= alpha\n>= beta', 3, 15)).toEqual({
        headingActive: false,
        listActive: false,
        quoteActive: false,
        centerQuoteActive: true,
      })
    })
  })

  describe('line prefix constants', () => {
    it('exports the page prefixes', () => {
      expect(HEADING_PREFIX).toBe('# ')
      expect(LIST_PREFIX).toBe('- ')
      expect(QUOTE_PREFIX).toBe('> ')
      expect(CENTER_QUOTE_PREFIX).toBe('>= ')
    })
  })

  describe('applyBlockEnterAutoFormat', () => {
    it('continues list prefix on enter at line end', () => {
      const prev = '- hello'
      const next = '- hello\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '- hello\n- ',
        selectionStart: 10,
        selectionEnd: 10,
      })
    })

    it('continues quote prefix on enter at line end', () => {
      const prev = '> hello'
      const next = '> hello\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '> hello\n> ',
        selectionStart: 10,
        selectionEnd: 10,
      })
    })

    it('continues center quote prefix on enter at line end', () => {
      const prev = '>= hello'
      const next = '>= hello\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '>= hello\n>= ',
        selectionStart: 12,
        selectionEnd: 12,
      })
    })

    it('exits list block when line has only prefix', () => {
      const prev = '- first\n- '
      const next = '- first\n- \n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '- first\n\n',
        selectionStart: 9,
        selectionEnd: 9,
      })
    })

    it('exits quote block when line has only prefix', () => {
      const prev = '> '
      const next = '> \n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '\n',
        selectionStart: 1,
        selectionEnd: 1,
      })
    })

    it('exits center quote block when line has only prefix and whitespace', () => {
      const prev = '>= '
      const next = '>= \n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: '\n',
        selectionStart: 1,
        selectionEnd: 1,
      })
    })

    it('returns null for non-line-end newline insertion', () => {
      const prev = '- hello world'
      const next = '- hel\nlo world'
      expect(applyBlockEnterAutoFormat(prev, next)).toBeNull()
    })

    it('returns null for heading prefix (does not auto-continue)', () => {
      const prev = '# title'
      const next = '# title\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toBeNull()
    })

    it('returns null for plain text without prefix', () => {
      const prev = 'hello'
      const next = 'hello\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toBeNull()
    })

    it('returns null for multi-character insertion (paste)', () => {
      const prev = '- hello'
      const next = '- hello world'
      expect(applyBlockEnterAutoFormat(prev, next)).toBeNull()
    })

    it('continues list in multi-line context', () => {
      const prev = 'intro\n- first\n- second'
      const next = 'intro\n- first\n- second\n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: 'intro\n- first\n- second\n- ',
        selectionStart: 25,
        selectionEnd: 25,
      })
    })

    it('exits list in multi-line context when body is empty', () => {
      const prev = 'intro\n- first\n- '
      const next = 'intro\n- first\n- \n'
      expect(applyBlockEnterAutoFormat(prev, next)).toEqual({
        content: 'intro\n- first\n\n',
        selectionStart: 15,
        selectionEnd: 15,
      })
    })
  })
})
