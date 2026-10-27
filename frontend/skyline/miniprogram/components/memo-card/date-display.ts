const MEMO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/

function getLocalDateParts(date: Date): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

export function formatMemoCardDateBarText(
  createdAtText: string,
  now: Date = new Date(),
): string {
  const text = String(createdAtText || '').trim()
  if (!text) return ''

  const match = MEMO_TIMESTAMP_RE.exec(text)
  if (!match) return text

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hourText = match[4] || ''
  const minuteText = match[5] || ''
  const today = getLocalDateParts(now)

  if (
    today &&
    year === today.year &&
    month === today.month &&
    day === today.day &&
    hourText &&
    minuteText
  ) {
    return `${Number(hourText)}:${minuteText}`
  }

  if (today && year === today.year) {
    return `${month}/${day}`
  }

  return `${year}/${month}/${day}`
}
