import assert from 'node:assert/strict'

process.env.TZ = 'Asia/Shanghai'

const {
  getWorkspaceNavigationFilters,
  resetWorkspaceNavigation,
  useWorkspaceNavigationStore,
} = await import('../src/features/workspace/workspace-navigation-store.ts')

function state() {
  return useWorkspaceNavigationStore.getState()
}

resetWorkspaceNavigation()
state().showAllNotes()
assert.deepEqual(getWorkspaceNavigationFilters(), {})
assert.equal(state().memoCreatedAtSort, 'desc')
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'all')

resetWorkspaceNavigation()
state().setMemoCreatedAtSort('asc')
assert.deepEqual(getWorkspaceNavigationFilters(), { created_at_sort: 'asc' })
assert.equal(state().memoCreatedAtSort, 'asc')
assert.equal(state().selectedNav, 'all')

state().selectTag('开发')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at_sort: 'asc',
  tag: '开发',
})
assert.equal(state().memoCreatedAtSort, 'asc')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'tag')

state().setMemoCreatedAtSort('desc')
assert.deepEqual(getWorkspaceNavigationFilters(), { tag: '开发' })
assert.equal(state().memoCreatedAtSort, 'desc')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'tag')

state().setMemoCreatedAtSort('bad')
assert.deepEqual(getWorkspaceNavigationFilters(), { tag: '开发' })
assert.equal(state().memoCreatedAtSort, 'desc')

state().setMemoCreatedAtSort('asc')
state().showAllNotes()
assert.deepEqual(getWorkspaceNavigationFilters(), { created_at_sort: 'asc' })
assert.equal(state().memoCreatedAtSort, 'asc')
assert.equal(state().selectedNav, 'all')

resetWorkspaceNavigation()
state().showTodayReview(new Date('2026-06-20T10:00:00+08:00'))
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 20 },
})
assert.equal(state().activeDate, '2026-06-20')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'today')

resetWorkspaceNavigation()
state().selectTag('开发')
assert.deepEqual(getWorkspaceNavigationFilters(), { tag: '开发' })
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'tag')

resetWorkspaceNavigation()
state().selectTag('__untagged__')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_no_tag: true })
assert.equal(state().selectedTag, '__untagged__')
assert.equal(state().selectedNav, 'tag')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
})
assert.equal(state().activeDate, '2026-06-18')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'date')

state().selectDate('bad')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
})
assert.equal(state().activeDate, '2026-06-18')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().selectTag('开发')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
  tag: '开发',
})
assert.equal(state().activeDate, '2026-06-18')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'tag')

resetWorkspaceNavigation()
state().selectTag('开发')
state().selectDate('2026-06-18')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
  tag: '开发',
})
assert.equal(state().activeDate, '2026-06-18')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'date')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().selectTag('__untagged__')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
  has_no_tag: true,
})

resetWorkspaceNavigation()
state().selectFacet('annotation')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_annotation: true })
assert.equal(state().selectedFacet, 'annotation')
assert.equal(state().selectedNav, 'facet')

state().selectFacet('heading')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_heading: true })
assert.equal(state().selectedFacet, 'heading')
assert.equal(state().selectedNav, 'facet')

state().selectFacet('unordered-list')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_unordered_list: true })
assert.equal(state().selectedFacet, 'unordered-list')
assert.equal(state().selectedNav, 'facet')

state().selectFacet('markdown-quote')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_markdown_quote: true })
assert.equal(state().selectedFacet, 'markdown-quote')
assert.equal(state().selectedNav, 'facet')

state().selectFacet('bad')
assert.deepEqual(getWorkspaceNavigationFilters(), { has_markdown_quote: true })
assert.equal(state().selectedFacet, 'markdown-quote')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().selectTag('开发')
state().selectFacet('heading')
state().setMemoCreatedAtSort('asc')
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
  created_at_sort: 'asc',
  has_heading: true,
  tag: '开发',
})
assert.equal(state().activeDate, '2026-06-18')
assert.equal(state().selectedFacet, 'heading')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'facet')

state().showAllNotes()
assert.deepEqual(getWorkspaceNavigationFilters(), { created_at_sort: 'asc' })
assert.equal(state().selectedFacet, 'none')
assert.equal(state().memoCreatedAtSort, 'asc')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().setMemoCreatedAtSort('asc')
state().selectFacet('heading')
state().clearDateFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at_sort: 'asc',
  has_heading: true,
})
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'heading')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'facet')

resetWorkspaceNavigation()
state().selectTag('开发')
state().selectDate('2026-06-18')
state().clearDateFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), { tag: '开发' })
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '开发')
assert.equal(state().selectedNav, 'tag')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().selectFacet('markdown-quote')
state().clearFacetFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), {
  created_at: { kind: 'day', year: 2026, month: 6, day: 18 },
})
assert.equal(state().activeDate, '2026-06-18')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'date')

resetWorkspaceNavigation()
state().selectTag('__untagged__')
state().selectFacet('annotation')
state().clearFacetFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), { has_no_tag: true })
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '__untagged__')
assert.equal(state().selectedNav, 'tag')

resetWorkspaceNavigation()
state().selectFacet('annotation')
state().clearFacetFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), {})
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'all')

resetWorkspaceNavigation()
state().selectDate('2026-06-18')
state().clearDateFilter()
assert.deepEqual(getWorkspaceNavigationFilters(), {})
assert.equal(state().activeDate, '')
assert.equal(state().selectedFacet, 'none')
assert.equal(state().selectedTag, '')
assert.equal(state().selectedNav, 'all')
