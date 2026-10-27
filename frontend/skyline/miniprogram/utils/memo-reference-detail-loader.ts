import type { Memo, MemoRefId } from '../models/memo'
import { workspaceStore } from '../store/store-bindings/workspace-store.instance'
import type { MemoCardItem } from './memo-list-presentation'
import {
  buildMemoReferenceDetailProjection,
  collectMemoReferenceDetailFetchIds,
  collectMemoReferenceListPreviewFetchIds,
  collectMemoReferencePreviewFetchIds,
  type MemoReferenceDetailProjection,
} from './memo-reference-detail'
import { uniqueOwnMemoIds } from './memo-ref-id'

export type MemoReferenceDetailData = MemoReferenceDetailProjection

export async function loadSelfMemoReferenceDetailData(memoId: number): Promise<MemoReferenceDetailData> {
  const root = await workspaceStore.ensureMemoDetail(memoId)
  const directIds = collectMemoReferenceDetailFetchIds(root)
  const relationMemos = directIds.length > 0
    ? await workspaceStore.ensureMemoDetails(directIds)
    : []
  const previewIds = collectMemoReferencePreviewFetchIds(root, relationMemos)
  const previewMemos = previewIds.length > 0
    ? await workspaceStore.ensureMemoDetails(previewIds)
    : []
  return buildMemoReferenceDetailProjection(root, [
    root,
    ...relationMemos,
    ...previewMemos,
  ])
}

function createReferenceListRoot(refs: MemoRefId[]): Memo {
  const ts = '1970-01-01T00:00:00.000Z'
  return {
    id: 0,
    createdAt: ts,
    updatedAt: ts,
    tags: [],
    content: '',
    refs: [...refs],
    referencedBy: [],
  }
}

export async function loadMemoReferenceListData(memoRefs: MemoRefId[]): Promise<{
  referenceCards: MemoCardItem[]
  referencedByCards: MemoCardItem[]
}> {
  const ownMemoIds = uniqueOwnMemoIds(memoRefs)
  const referenceMemos = ownMemoIds.length > 0
    ? await workspaceStore.ensureMemoDetails(ownMemoIds)
    : []
  const previewIds = collectMemoReferenceListPreviewFetchIds(referenceMemos)
  const previewMemos = previewIds.length > 0
    ? await workspaceStore.ensureMemoDetails(previewIds)
    : []
  return buildMemoReferenceDetailProjection(
    createReferenceListRoot(memoRefs),
    [...referenceMemos, ...previewMemos],
  )
}

export function emptyMemoReferenceDetailData(): MemoReferenceDetailData {
  return {
    rootCard: null,
    referenceCards: [],
    referencedByCards: [],
  }
}
