import assert from 'node:assert/strict'

const {
  INITIAL_TAG_UI_STATE,
  remapExpandedTagPaths,
  remapSelectedTagPath,
  removeDeletedExpandedTagPaths,
  removeDeletedTagSelection,
  workspaceTagUiReducer,
} = await import('../src/tag-state.ts')

assert.deepEqual(INITIAL_TAG_UI_STATE, {
  expandedTags: [],
  renameRevision: 0,
  renamingTag: null,
})
assert.equal(
  remapSelectedTagPath('数列/单调性/证明', '数列/单调性', '数列/最值'),
  '数列/最值/证明',
)
assert.equal(removeDeletedTagSelection('数列/单调性', '数列'), '')
assert.deepEqual(
  remapExpandedTagPaths(
    ['数列', '数列/单调性', '其他'],
    '数列/单调性',
    '数列/最值',
  ),
  ['数列', '数列/最值', '其他'],
)
assert.deepEqual(
  removeDeletedExpandedTagPaths(
    ['数列', '数列/单调性', '数列/单调性/证明', '其他'],
    '数列/单调性',
  ),
  ['数列', '其他'],
)

const renamed = workspaceTagUiReducer(
  {
    expandedTags: ['数列', '数列/单调性'],
    renameRevision: 1,
    renamingTag: '数列/单调性',
  },
  {
    type: 'rename-succeeded',
    oldTag: '数列/单调性',
    newTag: '数列/最值',
    revision: 1,
  },
)
assert.deepEqual(renamed, {
  expandedTags: ['数列', '数列/最值'],
  renameRevision: 1,
  renamingTag: null,
})

const newerDialogPreserved = workspaceTagUiReducer(
  { ...renamed, renameRevision: 2, renamingTag: '其他' },
  {
    type: 'rename-succeeded',
    oldTag: '数列',
    newTag: '数学/数列',
    revision: 1,
  },
)
assert.equal(newerDialogPreserved.renamingTag, '其他')
