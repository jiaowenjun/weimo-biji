import { describe, expect, it } from 'vitest'
import {
  filterTagPathsByQuery,
  resolveTagPickerConfirmDisabled,
  resolveTagPickerListFilterQuery,
  resolveTagPickerSearchDraft,
  tagMatchesSearchQuery,
} from '../tag-search'

describe('tagMatchesSearchQuery', () => {
  it('查询为空（或仅空白）时匹配任意标签', () => {
    expect(tagMatchesSearchQuery('文学/古代/唐诗', '')).toBe(true)
    expect(tagMatchesSearchQuery('a/b', '  \t  ')).toBe(true)
  })

  it('查询与标签路径均去掉 "/" 后做有序子序列匹配：文诗 匹配 文学/古代/唐诗、文学/诗歌', () => {
    expect(tagMatchesSearchQuery('文学/古代/唐诗', '文诗')).toBe(true)
    expect(tagMatchesSearchQuery('文学/诗歌', '文诗')).toBe(true)
  })

  it('文诗 不匹配 诗词/文选（去掉 / 后为 诗词文选，文 在 诗 之后）', () => {
    expect(tagMatchesSearchQuery('诗词/文选', '文诗')).toBe(false)
  })

  it('查询中的 "/" 不参与匹配（与标签一致先删再比）', () => {
    expect(tagMatchesSearchQuery('文学/诗歌', '文学/诗歌')).toBe(true)
  })

  it('wenxue 拼音匹配 文学（驱动实现）', () => {
    expect(tagMatchesSearchQuery('文学', 'wenxue')).toBe(true)
  })

  it('全拼 wenxue 匹配 语文/数学', () => {
    expect(tagMatchesSearchQuery('语文/数学', 'wenxue')).toBe(true)
  })

  it('首字母 wx 匹配 文学、语文/数学', () => {
    expect(tagMatchesSearchQuery('文学', 'wx')).toBe(true)
    expect(tagMatchesSearchQuery('语文/数学', 'wx')).toBe(true)
  })

  it('混合 wenx、wxue 匹配 文学、语文/数学', () => {
    expect(tagMatchesSearchQuery('文学', 'wenx')).toBe(true)
    expect(tagMatchesSearchQuery('文学', 'wxue')).toBe(true)
    expect(tagMatchesSearchQuery('语文/数学', 'wenx')).toBe(true)
    expect(tagMatchesSearchQuery('语文/数学', 'wxue')).toBe(true)
  })

  it('拼音查询不匹配无对应子序列的标签', () => {
    expect(tagMatchesSearchQuery('诗词/文选', 'wenxue')).toBe(false)
  })

  it('拼音查询忽略大小写与中间空格', () => {
    expect(tagMatchesSearchQuery('文学', 'Wen Xue')).toBe(true)
  })
})

describe('filterTagPathsByQuery', () => {
  it('空查询返回原列表顺序（浅拷贝语义：新数组）', () => {
    const tags = ['文学/古代/唐诗', '诗词/文选']
    const out = filterTagPathsByQuery(tags, '')
    expect(out).toEqual(tags)
    expect(out).not.toBe(tags)
  })

  it('按 tagMatchesSearchQuery 筛选', () => {
    const tags = ['文学/古代/唐诗', '诗词/文选', '文学/诗歌']
    expect(filterTagPathsByQuery(tags, '文诗')).toEqual([
      '文学/古代/唐诗',
      '文学/诗歌',
    ])
  })
})

describe('resolveTagPickerSearchDraft', () => {
  it('update 且输入与当前标签相同：用于搜索的串视为空（与空输入一致，匹配全部）', () => {
    expect(resolveTagPickerSearchDraft('update', '工作/项目', '工作/项目')).toBe('')
  })

  it('update 但输入与当前标签不同：原样作为搜索串', () => {
    expect(resolveTagPickerSearchDraft('update', '文', '工作/项目')).toBe('文')
  })

  it('insert 模式：不因与某串相同而清空（始终原样）', () => {
    expect(resolveTagPickerSearchDraft('insert', '工作/项目', '工作/项目')).toBe('工作/项目')
  })

  it('pick 模式：与 insert 相同，不因与 target 相同而清空', () => {
    expect(resolveTagPickerSearchDraft('pick', '工作/项目', '工作/项目')).toBe('工作/项目')
  })
})

describe('resolveTagPickerListFilterQuery', () => {
  it('draft 来自输入：与 resolveTagPickerSearchDraft 一致', () => {
    expect(
      resolveTagPickerListFilterQuery('insert', '文', '', '', 'input'),
    ).toBe('文')
    expect(
      resolveTagPickerListFilterQuery('update', '工作/项目', '工作/项目', '', 'input'),
    ).toBe('')
  })

  it('draft 来自列表点击：保持上一帧列表筛选用串不变', () => {
    expect(
      resolveTagPickerListFilterQuery('insert', '文学/诗歌', '', '文', 'list-tap'),
    ).toBe('文')
    expect(
      resolveTagPickerListFilterQuery(
        'update',
        '新标签/完整路径',
        '旧标签',
        '旧',
        'list-tap',
      ),
    ).toBe('旧')
  })

  it('sync-init + pick：非空 draft 不用于列表筛选（重选打开时展示全量）', () => {
    expect(
      resolveTagPickerListFilterQuery(
        'pick',
        '书影音/书评/红楼梦',
        '',
        '',
        'sync-init',
      ),
    ).toBe('')
  })

  it('sync-init + insert：非空 draft 仍参与列表筛选', () => {
    expect(
      resolveTagPickerListFilterQuery(
        'insert',
        '书影音/书评/红楼梦',
        '',
        '',
        'sync-init',
      ),
    ).toBe('书影音/书评/红楼梦')
  })

  it('sync-init + pick：空 draft 与全模式一致', () => {
    expect(
      resolveTagPickerListFilterQuery('pick', '', '', '', 'sync-init'),
    ).toBe('')
  })

  it('sync-init + update：不触发展示全量特例', () => {
    expect(
      resolveTagPickerListFilterQuery(
        'update',
        '文学',
        '工作/项目',
        '',
        'sync-init',
      ),
    ).toBe('文学')
  })
})

describe('resolveTagPickerConfirmDisabled', () => {
  it('pick：空输入时禁用确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'pick',
        draft: '',
        targetTag: '',
        selectedTags: [],
        rawTagOptions: ['工作/项目', '文学'],
      }),
    ).toBe(true)
  })

  it('pick：输入新标签（不在 options）时禁用确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'pick',
        draft: '全新标签',
        targetTag: '',
        selectedTags: [],
        rawTagOptions: ['工作/项目', '文学'],
      }),
    ).toBe(true)
  })

  it('pick：输入已有标签时可确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'pick',
        draft: '文学',
        targetTag: '',
        selectedTags: [],
        rawTagOptions: ['工作/项目', '文学'],
      }),
    ).toBe(false)
  })

  it('insert：非空且非重复可确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'insert',
        draft: '全新标签',
        targetTag: '',
        selectedTags: ['工作/项目'],
        rawTagOptions: ['工作/项目', '文学'],
      }),
    ).toBe(false)
  })

  it('update：输入原值仍禁用确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'update',
        draft: '工作/项目',
        targetTag: '工作/项目',
        selectedTags: ['工作/项目', '文学'],
        rawTagOptions: ['工作/项目', '文学'],
      }),
    ).toBe(true)
  })

  it('update + allowEmptyRemove=false：空输入时禁用确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'update',
        draft: '',
        targetTag: '工作/项目',
        selectedTags: ['工作/项目'],
        rawTagOptions: ['工作/项目', '归档'],
        allowEmptyRemove: false,
      }),
    ).toBe(true)
  })

  it('update + allowEmptyRemove=true：空输入时仍允许确认', () => {
    expect(
      resolveTagPickerConfirmDisabled({
        mode: 'update',
        draft: '',
        targetTag: '工作/项目',
        selectedTags: ['工作/项目'],
        rawTagOptions: ['工作/项目', '归档'],
        allowEmptyRemove: true,
      }),
    ).toBe(false)
  })
})
