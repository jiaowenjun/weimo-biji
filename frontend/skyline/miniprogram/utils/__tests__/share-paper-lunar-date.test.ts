import { describe, expect, it } from 'vitest'
import {
  buildSharePaperDateText,
  formatSharePaperLunarText,
  parseShareSolarYmd,
  toSharePaperDateText,
} from '../share-paper-lunar-date'

describe('parseShareSolarYmd', () => {
  it('parses ISO and slash dates from first segment', () => {
    expect(parseShareSolarYmd('2026-05-07 12:00')).toEqual({ year: 2026, month: 5, day: 7 })
    expect(parseShareSolarYmd('2026/5/7')).toEqual({ year: 2026, month: 5, day: 7 })
  })

  it('returns null when not parseable', () => {
    expect(parseShareSolarYmd('')).toBeNull()
    expect(parseShareSolarYmd('invalid')).toBeNull()
  })
})

describe('formatSharePaperLunarText', () => {
  it('formats 2026-05-07 as 丙午年三月廿一', () => {
    expect(formatSharePaperLunarText('2026-05-07')).toBe('丙午年三月廿一')
  })

  it('handles leap month month name', () => {
    const s = formatSharePaperLunarText('2023-03-22')
    expect(s).toMatch(/^癸卯年闰二月/)
  })
})

describe('buildSharePaperDateText', () => {
  it('returns solar when useLunar is false', () => {
    expect(buildSharePaperDateText('2026-05-02', false)).toBe('2026/05/02')
  })

  it('returns lunar when useLunar is true', () => {
    expect(buildSharePaperDateText('2026-05-07', true)).toBe('丙午年三月廿一')
  })

  it('falls back to solar when lunar parse fails', () => {
    expect(buildSharePaperDateText('weird', true)).toBe('weird')
  })
})

describe('toSharePaperDateText', () => {
  it('normalizes ISO to slash', () => {
    expect(toSharePaperDateText('2026-05-02 18:31')).toBe('2026/05/02')
  })
})
