import assert from 'node:assert/strict'

import {
  buildSidebarStatItems,
  formatDateInt,
  formatWordMetric,
  isSidebarActionableTag,
  remapSelectedTagPath,
  toInitialCreateTags,
  toHeatmapDailyCounts,
  toSidebarTagTree,
  toTagOptions,
  toTagTreeNodes,
} from '../src/features/workspace/sidebar-data.ts'

assert.equal(formatDateInt(20260620), '2026-06-20')
assert.deepEqual(toHeatmapDailyCounts([[20260620, 3]]), [
  { date: '2026-06-20', count: 3 },
])

assert.deepEqual(
  toTagTreeNodes([
    {
      label: '文学',
      tag: '文学',
      item_count: 7,
      children: [
        {
          label: '现代',
          tag: '文学/现代',
          item_count: 2,
          children: [],
        },
      ],
    },
  ]),
  [
    {
      label: '文学',
      tag: '文学',
      itemCount: 7,
      children: [
        {
          label: '现代',
          tag: '文学/现代',
          itemCount: 2,
          children: [],
        },
      ],
    },
  ],
)

assert.deepEqual(
  toSidebarTagTree({
    label: 'root',
    tag: '',
    item_count: 9,
    untagged_count: 4,
    children: [
      {
        label: '开发',
        tag: '开发',
        item_count: 5,
        children: [],
      },
    ],
  }),
  {
    nodes: [
      {
        label: '开发',
        tag: '开发',
        itemCount: 5,
        children: [],
      },
      {
        label: '未标签',
        tag: '__untagged__',
        itemCount: 4,
        children: [],
        menuEnabled: false,
      },
    ],
    untaggedCount: 4,
  },
)

assert.deepEqual(
  toSidebarTagTree({
    label: 'root',
    tag: '',
    item_count: 0,
    untagged_count: 0,
    children: [],
  }),
  {
    nodes: [],
    untaggedCount: 0,
  },
)

assert.deepEqual(
  toTagOptions({
    label: 'root',
    tag: '',
    item_count: 15,
    untagged_count: 0,
    children: [
      {
        label: '书影音',
        tag: '书影音',
        item_count: 6,
        children: [
          {
            label: '乐评',
            tag: '书影音/乐评',
            item_count: 1,
            children: [],
          },
          {
            label: '书评',
            tag: '书影音/书评',
            item_count: 2,
            children: [],
          },
        ],
      },
      {
        label: '批注',
        tag: '批注',
        item_count: 2,
        children: [
          {
            label: '珊珊君',
            tag: '批注/珊珊君',
            item_count: 1,
            children: [],
          },
        ],
      },
    ],
  }),
  ['书影音', '书影音/乐评', '书影音/书评', '批注', '批注/珊珊君'],
)

assert.deepEqual(toTagOptions(undefined), [])

assert.equal(remapSelectedTagPath('项目', '项目', '归档'), '归档')
assert.equal(remapSelectedTagPath('项目/重构', '项目', '归档'), '归档/重构')
assert.equal(remapSelectedTagPath('生活/阅读', '项目', '归档'), '生活/阅读')
assert.equal(remapSelectedTagPath('项目集', '项目', '归档'), '项目集')
assert.equal(remapSelectedTagPath('', '项目', '归档'), '')
assert.equal(isSidebarActionableTag('开发'), true)
assert.equal(isSidebarActionableTag('开发/React'), true)
assert.equal(isSidebarActionableTag('__untagged__'), false)
assert.equal(isSidebarActionableTag(''), false)
assert.deepEqual(toInitialCreateTags('开发/React'), ['开发/React'])
assert.deepEqual(toInitialCreateTags('__untagged__'), [])
assert.deepEqual(toInitialCreateTags(''), [])

assert.deepEqual(formatWordMetric(9999), { value: '9999', unit: '字' })
assert.deepEqual(formatWordMetric(120000), { value: '12.0', unit: '万字' })

assert.deepEqual(
  buildSidebarStatItems({
    note_count: 11,
    tag_count: 3,
    word_count: 120000,
    daily_note_count: [
      [20260618, 1],
      [20260620, 3],
    ],
  }),
  [
    { key: 'notes', value: '11', label: '笔记' },
    { key: 'words', value: '12.0', label: '万字' },
    { key: 'days', value: '2', label: '天' },
  ],
)

assert.deepEqual(buildSidebarStatItems(undefined), [])
