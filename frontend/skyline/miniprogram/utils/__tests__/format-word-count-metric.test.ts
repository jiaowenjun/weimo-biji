import { describe, expect, it } from 'vitest'

import { formatWordCountMetric } from '../format-word-count-metric'

describe('formatWordCountMetric', () => {
  it('uses 字 below 1000', () => {
    expect(formatWordCountMetric(0)).toEqual({ value: '0', unit: '字' })
    expect(formatWordCountMetric(999)).toEqual({ value: '999', unit: '字' })
  })

  it('uses 千字 from 1000 up to 9999 with one decimal', () => {
    expect(formatWordCountMetric(1000)).toEqual({ value: '1.0', unit: '千字' })
    expect(formatWordCountMetric(1500)).toEqual({ value: '1.5', unit: '千字' })
    expect(formatWordCountMetric(9999)).toEqual({ value: '10.0', unit: '千字' })
  })

  it('uses 万字 from 10000 with one decimal', () => {
    expect(formatWordCountMetric(10000)).toEqual({ value: '1.0', unit: '万字' })
    expect(formatWordCountMetric(123456)).toEqual({ value: '12.3', unit: '万字' })
  })
})
