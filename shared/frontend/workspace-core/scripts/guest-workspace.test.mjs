import assert from 'node:assert/strict'

const {
  buildGuestWorkspaceTagTree,
  renameGuestWorkspaceTag,
} = await import('../src/guest-workspace.ts')

const rebuiltTree = buildGuestWorkspaceTagTree(
  [
    { tags: ['新增/子标签'] },
    { tags: ['保留'] },
    { tags: [] },
  ],
  ['保留', '已删除', '新增'],
)

assert.equal(rebuiltTree.item_count, 3)
assert.equal(rebuiltTree.untagged_count, 1)
assert.deepEqual(rebuiltTree.children.map((node) => node.tag), ['保留', '新增'])
assert.equal(rebuiltTree.children[0].item_count, 1)
assert.equal(rebuiltTree.children[1].item_count, 1)
assert.equal(rebuiltTree.children[1].children[0].tag, '新增/子标签')

const result = renameGuestWorkspaceTag({
  expandedTags: ['文学', '文学/古代', '开发'],
  items: [
    { id: 1, tags: ['文学/古代/诗词'] },
    { id: 2, tags: ['文学/古代/诗词'] },
    { id: 3, tags: ['开发/React'] },
    { id: 4, tags: [] },
  ],
  newTag: '文学/中国文学',
  oldTag: '文学',
  selectedTag: '文学/古代',
  tagTree: {
    label: '全部标签',
    tag: '',
    item_count: 4,
    untagged_count: 1,
    children: [
      {
        label: '文学',
        tag: '文学',
        item_count: 2,
        children: [
          {
            label: '古代',
            tag: '文学/古代',
            item_count: 2,
            children: [],
          },
        ],
      },
      {
        label: '开发',
        tag: '开发',
        item_count: 1,
        children: [],
      },
    ],
  },
})

assert.ok(result)
assert.deepEqual(
  result.items.map((item) => item.tags),
  [
    ['文学/中国文学/古代/诗词'],
    ['文学/中国文学/古代/诗词'],
    ['开发/React'],
    [],
  ],
)
assert.equal(result.selectedTag, '文学/中国文学/古代')
assert.deepEqual(
  result.expandedTags,
  ['文学/中国文学', '文学/中国文学/古代', '开发', '文学'],
)
assert.equal(result.tagTree.children[0].tag, '文学')
assert.equal(result.tagTree.children[0].children[0].tag, '文学/中国文学')
assert.equal(result.tagTree.children[0].children[0].children[0].tag, '文学/中国文学/古代')
assert.equal(result.tagTree.untagged_count, 1)
