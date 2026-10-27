import type { MemoQueryDraft } from '../../models/memo'

export interface IndexEmptyStateInput {
  scopeKind: 'self' | 'friend'
  query: Pick<MemoQueryDraft, 'keyword' | 'selectedTag'>
  dateLabel: string
}

export interface IndexEmptyState {
  emptyTitle: string
  emptyDescription: string
  emptyActionText: string
}

export function deriveIndexEmptyState(input: IndexEmptyStateInput): IndexEmptyState {
  const { query, dateLabel } = input

  if (input.scopeKind === 'friend') {
    if (query.selectedTag) {
      return {
        emptyTitle: `好友没有 #${query.selectedTag} 相关笔记`,
        emptyDescription: '',
        emptyActionText: '清除标签筛选',
      }
    }
    if (dateLabel) {
      return {
        emptyTitle: `${dateLabel}好友还没有笔记`,
        emptyDescription: '',
        emptyActionText: '清除日期筛选',
      }
    }
    return {
      emptyTitle: '好友还没有笔记',
      emptyDescription: '',
      emptyActionText: '',
    }
  }

  if (query.keyword) {
    return {
      emptyTitle: `没有找到包含「${query.keyword}」的笔记`,
      emptyDescription: '',
      emptyActionText: '清除关键词',
    }
  }
  if (query.selectedTag) {
    return {
      emptyTitle: `没有 #${query.selectedTag} 相关笔记`,
      emptyDescription: '',
      emptyActionText: '清除标签筛选',
    }
  }
  if (dateLabel) {
    return {
      emptyTitle: `${dateLabel}还没有笔记`,
      emptyDescription: '',
      emptyActionText: '清除日期筛选',
    }
  }
  return {
    emptyTitle: '还没有笔记',
    emptyDescription: '点击 + 记录你的第一个想法',
    emptyActionText: '',
  }
}
