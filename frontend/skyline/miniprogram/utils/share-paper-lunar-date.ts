/**
 * 分享图页脚日期：公历 YYYY/MM/DD 与农历（干支年 + 农历月日）。
 * 公历日期取自 `createdAtText` 首段，与笔记列表展示语义一致。
 */

// lunar-javascript 为 CJS、无类型声明
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Solar } = require('lunar-javascript') as {
  Solar: {
    fromYmd(year: number, month: number, day: number): {
      getLunar: () => {
        getYearInGanZhi: () => string
        getMonthInChinese: () => string
        getDayInChinese: () => string
      }
    }
  }
}

/** 从 `createdAtText` 取首段日期，供页脚解析。 */
export function toShareDateText(createdAtText: string): string {
  return String(createdAtText || '')
    .trim()
    .split(/\s+/)[0] || ''
}

/** 页脚公历：`YYYY/MM/DD`；无法识别则原样返回首段。 */
export function toSharePaperDateText(createdAtText: string): string {
  const head = toShareDateText(createdAtText)
  if (!head) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head)
  if (iso) {
    return `${iso[1]}/${iso[2]}/${iso[3]}`
  }
  const slash = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(head)
  if (slash) {
    return head
  }
  return head
}

/** 解析公历年月日；支持 `YYYY-MM-DD` / `YYYY/MM/DD`（月日可 1–2 位）。 */
export function parseShareSolarYmd(createdAtText: string): {
  year: number
  month: number
  day: number
} | null {
  const head = toShareDateText(createdAtText)
  if (!head) return null
  const m =
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(head) ||
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(head)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  return { year, month, day }
}

/**
 * 农历展示：`{年干支}年{农月}月{农日}`，如 `丙午年三月廿一`。
 * 解析失败返回 `''`。
 */
export function formatSharePaperLunarText(createdAtText: string): string {
  const ymd = parseShareSolarYmd(createdAtText)
  if (!ymd) return ''
  const lunar = Solar.fromYmd(ymd.year, ymd.month, ymd.day).getLunar()
  return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
}

/** 按开关返回页脚日期文案；农历不可用时回退公历。 */
export function buildSharePaperDateText(createdAtText: string, useLunar: boolean): string {
  const solar = toSharePaperDateText(createdAtText)
  if (!useLunar) return solar
  const lunar = formatSharePaperLunarText(createdAtText)
  return lunar || solar
}
