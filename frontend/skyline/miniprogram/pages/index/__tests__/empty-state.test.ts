import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriveIndexEmptyState } from '../empty-state'

const pageTs = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')

describe('deriveIndexEmptyState', () => {
  it('keeps the first self-list empty state actionable for creation', () => {
    expect(
      deriveIndexEmptyState({
        scopeKind: 'self',
        query: { keyword: '', selectedTag: '' },
        dateLabel: '',
      }),
    ).toEqual({
      emptyTitle: '还没有笔记',
      emptyDescription: '点击 + 记录你的第一个想法',
      emptyActionText: '',
    })
  })

  it('prioritizes keyword, tag, then date filters for self scope', () => {
    expect(
      deriveIndexEmptyState({
        scopeKind: 'self',
        query: { keyword: '设计', selectedTag: '灵感' },
        dateLabel: '今天',
      }),
    ).toMatchObject({
      emptyTitle: '没有找到包含「设计」的笔记',
      emptyActionText: '清除关键词',
    })

    expect(
      deriveIndexEmptyState({
        scopeKind: 'self',
        query: { keyword: '', selectedTag: '灵感' },
        dateLabel: '今天',
      }),
    ).toMatchObject({
      emptyTitle: '没有 #灵感 相关笔记',
      emptyActionText: '清除标签筛选',
    })

    expect(
      deriveIndexEmptyState({
        scopeKind: 'self',
        query: { keyword: '', selectedTag: '' },
        dateLabel: '今天',
      }),
    ).toMatchObject({
      emptyTitle: '今天还没有笔记',
      emptyActionText: '清除日期筛选',
    })
  })

  it('keeps updateEmptyState as setData glue around the pure derivation', () => {
    const start = pageTs.indexOf('\n  updateEmptyState() {')
    const end = pageTs.indexOf('\n  resetFiltersAfterLogout() {', start)
    const section = pageTs.slice(start, end)

    expect(section).toContain('deriveIndexEmptyState({')
    expect(section).toContain('this.setData(deriveIndexEmptyState')
    expect(section).not.toContain('let emptyTitle')
    expect(section).not.toContain('isTagDrillPage')
  })
})
