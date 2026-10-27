export interface WordCountMetric {
  value: string
  unit: string
}

export function formatWordCountMetric(wordCount: number): WordCountMetric {
  if (wordCount < 1000) {
    return { value: String(wordCount), unit: '字' }
  }
  if (wordCount < 10000) {
    return { value: (wordCount / 1000).toFixed(1), unit: '千字' }
  }
  return { value: (wordCount / 10000).toFixed(1), unit: '万字' }
}
