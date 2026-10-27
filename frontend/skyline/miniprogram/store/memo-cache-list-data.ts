import { memoMatchesFilters } from './memo-cache-filters'
import type { Memo, MemoSearchPage, MemoSearchQuery } from '../models/memo'

type MemoTransform = (memo: Memo) => Memo | undefined

function adjustPageTotalCount(page: MemoSearchPage, delta: number): MemoSearchPage {
  if (delta === 0) return page
  return { ...page, totalCount: Math.max(page.totalCount + delta, 0) }
}

export function transformMemoListData(
  pages: MemoSearchPage[],
  filters: MemoSearchQuery,
  transform: MemoTransform,
): MemoSearchPage[] {
  let changed = false
  let removedCount = 0
  const nextPages = pages.map((page) => {
    let pageChanged = false
    const nextItems: Memo[] = []
    for (const m of page.items) {
      const r = transform(m)
      if (r === undefined || !memoMatchesFilters(r, filters)) {
        pageChanged = true
        removedCount += 1
        continue
      }
      if (r !== m) pageChanged = true
      nextItems.push(r)
    }
    if (!pageChanged) return page
    changed = true
    return { ...page, items: nextItems }
  })
  if (!changed) return pages
  if (removedCount === 0) return nextPages
  return nextPages.map((p) => adjustPageTotalCount(p, -removedCount))
}

export function prependMemoListData(
  pages: MemoSearchPage[],
  filters: MemoSearchQuery,
  memo: Memo,
): MemoSearchPage[] {
  if (!memoMatchesFilters(memo, filters) || pages.length === 0) return pages
  let removedExisting = false
  const cleaned = pages.map((page) => {
    const nextItems = page.items.filter((it) => it.id !== memo.id)
    if (nextItems.length === page.items.length) return page
    removedExisting = true
    return { ...page, items: nextItems }
  })
  const [first, ...rest] = cleaned
  if (!first) return pages
  const nextPages: MemoSearchPage[] = [
    { ...first, items: [memo, ...first.items] },
    ...rest,
  ]
  const totalDelta = removedExisting ? 0 : 1
  return nextPages.map((p) => adjustPageTotalCount(p, totalDelta))
}
