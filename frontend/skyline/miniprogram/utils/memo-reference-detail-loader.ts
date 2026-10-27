import type { Memo, MemoRefId } from '../models/memo'
import { friendByUsername } from '../models/friend'
import { getFriendMemo, getFriendSummary } from '../services/friend'
import { workspaceStore } from '../store/store-bindings/workspace-store.instance'
import type {
  MemoCardItem,
  MemoReferencePreview,
} from './memo-list-presentation'
import {
  buildFriendMemoReferenceDetailProjection,
  buildFriendMemoReferencePreview,
  buildMemoReferenceDetailProjection,
  collectFriendReferenceReferencedByFetchIds,
  collectFriendMemoReferencedByRefs,
  collectFriendMemoReferenceRefs,
  collectMemoReferenceDetailFetchIds,
  collectMemoReferenceListPreviewFetchIds,
  collectMemoReferencePreviewFetchIds,
  type MemoReferenceDetailProjection,
} from './memo-reference-detail'
import { parseFriendMemoRef, uniqueOwnMemoIds } from './memo-ref-id'

export interface MemoReferenceDetailData extends MemoReferenceDetailProjection {
  friendReferenceOwnerLabel: string
  friendReferencedByOwnerLabel: string
  friendOwnerUsername: string
  friendOwnerLabel: string
}

interface FriendReferenceHydration {
  previews: Map<string, MemoReferencePreview>
  memos: Map<string, Memo>
  ownerLabel: string
  /** 当前绑定好友的昵称（与 refs 主人一致时），供分享图等使用 */
  friendNickname?: string
}

async function loadFriendMemoReferences(
  refs: string[],
  options?: { throwOnAllFailed?: boolean },
): Promise<FriendReferenceHydration> {
  const previews = new Map<string, MemoReferencePreview>()
  const memos = new Map<string, Memo>()
  if (refs.length === 0) return { previews, memos, ownerLabel: '', friendNickname: undefined }
  let firstError: unknown = null

  const summary = await getFriendSummary().catch(() => null)
  const firstUsername = refs
    .map((ref) => parseFriendMemoRef(ref)?.username || '')
    .find((username) => !!username) || ''
  const friends = summary?.friends ?? []
  const friend = firstUsername ? friendByUsername(friends, firstUsername) : null
  const ownerLabel = friend && (!firstUsername || friend.username === firstUsername)
    ? friend.nickname || friend.username
    : firstUsername
  const friendNickname =
    friend && (!firstUsername || friend.username === firstUsername)
      ? String(friend.nickname || '').trim() || undefined
      : undefined

  await Promise.all(refs.map(async (ref) => {
    const parsed = parseFriendMemoRef(ref)
    if (!parsed) return
    try {
      const memo = await getFriendMemo(parsed.username, parsed.memoId)
      memos.set(ref, memo)
      const previewFriend = friendByUsername(friends, parsed.username)
      const preview = buildFriendMemoReferencePreview(ref, memo, previewFriend)
      if (preview) previews.set(ref, preview)
    } catch (error) {
      if (firstError == null) firstError = error
      // Historical friend refs can become unavailable; keep fallback display text.
    }
  }))

  if (options?.throwOnAllFailed && memos.size === 0 && firstError != null) {
    throw firstError
  }

  return { previews, memos, ownerLabel, friendNickname }
}

function emptyReferenceLabels(): Pick<
  MemoReferenceDetailData,
  'friendReferenceOwnerLabel' | 'friendReferencedByOwnerLabel' | 'friendOwnerUsername' | 'friendOwnerLabel'
> {
  return {
    friendReferenceOwnerLabel: '',
    friendReferencedByOwnerLabel: '',
    friendOwnerUsername: '',
    friendOwnerLabel: '',
  }
}

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
  const allMemos = [
    root,
    ...relationMemos,
    ...previewMemos,
  ]
  const friendReferences = await loadFriendMemoReferences(
    Array.from(new Set([
      ...collectFriendMemoReferenceRefs(allMemos),
      ...collectFriendMemoReferencedByRefs(allMemos),
    ])),
  )
  const friendReferencedByIds = collectFriendReferenceReferencedByFetchIds(
    friendReferences.memos,
    allMemos,
  )
  const friendReferencedByMemos = friendReferencedByIds.length > 0
    ? await workspaceStore.ensureMemoDetails(friendReferencedByIds).catch(() => [])
    : []
  const projectionMemos = [
    ...allMemos,
    ...friendReferencedByMemos,
  ]
  const projection = buildMemoReferenceDetailProjection(root, projectionMemos, {
    resolveReferencePreview: (ref) => friendReferences.previews.get(ref),
    friendReferenceMemos: friendReferences.memos,
    referencedByOwnerLabel: '我',
    friendNickname: friendReferences.friendNickname,
  })

  return {
    ...projection,
    friendReferenceOwnerLabel:
      friendReferences.ownerLabel ||
      projection.friendReferenceCards[0]?.ownerUsername ||
      '好友',
    friendReferencedByOwnerLabel:
      friendReferences.ownerLabel ||
      projection.friendReferencedByCards[0]?.ownerUsername ||
      '好友',
    friendOwnerUsername: '',
    friendOwnerLabel: '',
  }
}

export async function loadFriendMemoReferenceDetailData(
  memoId: number,
  friendUsername: string,
): Promise<MemoReferenceDetailData> {
  const username = String(friendUsername || '').trim()
  if (!username) throw new Error('friend unavailable')
  const summary = await getFriendSummary().catch(() => null)
  const friend = friendByUsername(summary?.friends ?? [], username)
  const root = await getFriendMemo(username, memoId)
  const ownIds = collectMemoReferenceDetailFetchIds(root)
  const relationMemos = ownIds.length > 0
    ? await workspaceStore.ensureMemoDetails(ownIds)
    : []
  const previewIds = collectMemoReferencePreviewFetchIds(root, relationMemos)
  const previewMemos = previewIds.length > 0
    ? await workspaceStore.ensureMemoDetails(previewIds)
    : []
  const allMemos = [
    root,
    ...relationMemos,
    ...previewMemos,
  ]
  const friendReferences = await loadFriendMemoReferences(
    Array.from(new Set([
      ...collectFriendMemoReferenceRefs(allMemos),
      ...collectFriendMemoReferencedByRefs(allMemos),
    ])),
  )
  const projectionMemos = [
    ...relationMemos,
    ...previewMemos,
  ]
  const projection = buildFriendMemoReferenceDetailProjection(root, projectionMemos, {
    friendUsername: username,
    friendNickname: friend?.nickname,
    resolveReferencePreview: (ref) => friendReferences.previews.get(ref),
  })

  return {
    ...projection,
    friendReferenceOwnerLabel: friend?.nickname || username,
    friendReferencedByOwnerLabel: friend?.nickname || username,
    friendOwnerUsername: username,
    friendOwnerLabel: friend?.nickname || username,
  }
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
  ownReferenceCards: MemoCardItem[]
  friendReferenceCards: MemoCardItem[]
  referencedByCards: MemoCardItem[]
  ownReferencedByCards: MemoCardItem[]
  friendReferencedByCards: MemoCardItem[]
  friendReferenceOwnerLabel: string
  friendReferencedByOwnerLabel: string
}> {
  const ownMemoIds = uniqueOwnMemoIds(memoRefs)
  const directFriendRefs = memoRefs.filter((ref): ref is MemoRefId => !!parseFriendMemoRef(ref))
  const referenceMemos = ownMemoIds.length > 0
    ? await workspaceStore.ensureMemoDetails(ownMemoIds)
    : []
  const directFriendReferences = await loadFriendMemoReferences(directFriendRefs, {
    throwOnAllFailed: referenceMemos.length === 0 && directFriendRefs.length > 0,
  })
  const directFriendMemos = Array.from(directFriendReferences.memos.values())
  const initialMemos = [
    ...referenceMemos,
    ...directFriendMemos,
  ]
  const previewIds = collectMemoReferenceListPreviewFetchIds(initialMemos)
  const previewMemos = previewIds.length > 0
    ? await workspaceStore.ensureMemoDetails(previewIds)
    : []
  const hydratedFriendRefs = Array.from(new Set([
    ...directFriendRefs,
    ...collectFriendMemoReferenceRefs([...initialMemos, ...previewMemos]),
    ...collectFriendMemoReferencedByRefs([...initialMemos, ...previewMemos]),
  ]))
  const friendReferences = hydratedFriendRefs.length === directFriendRefs.length &&
    hydratedFriendRefs.every((ref) => directFriendReferences.memos.has(ref))
    ? directFriendReferences
    : await loadFriendMemoReferences(hydratedFriendRefs, {
      throwOnAllFailed: referenceMemos.length === 0 && directFriendRefs.length > 0,
    })
  const friendNestedOwnIds = collectFriendReferenceReferencedByFetchIds(
    friendReferences.memos,
    [...initialMemos, ...previewMemos],
  )
  const friendNestedOwnMemos = friendNestedOwnIds.length > 0
    ? await workspaceStore.ensureMemoDetails(friendNestedOwnIds).catch(() => [])
    : []
  const projection = buildMemoReferenceDetailProjection(
    createReferenceListRoot(memoRefs),
    [
      ...referenceMemos,
      ...previewMemos,
      ...friendNestedOwnMemos,
    ],
    {
      resolveReferencePreview: (ref) => friendReferences.previews.get(ref),
      friendReferenceMemos: friendReferences.memos,
      referencedByOwnerLabel: '我',
    },
  )

  return {
    referenceCards: projection.referenceCards,
    ownReferenceCards: projection.ownReferenceCards,
    friendReferenceCards: projection.friendReferenceCards,
    referencedByCards: projection.referencedByCards,
    ownReferencedByCards: projection.ownReferencedByCards,
    friendReferencedByCards: projection.friendReferencedByCards,
    friendReferenceOwnerLabel:
      friendReferences.ownerLabel ||
      projection.friendReferenceCards[0]?.ownerUsername ||
      '好友',
    friendReferencedByOwnerLabel:
      friendReferences.ownerLabel ||
      projection.friendReferencedByCards[0]?.ownerUsername ||
      '好友',
  }
}

export function emptyMemoReferenceDetailData(): MemoReferenceDetailData {
  return {
    rootCard: null,
    referenceCards: [],
    ownReferenceCards: [],
    friendReferenceCards: [],
    referencedByCards: [],
    ownReferencedByCards: [],
    friendReferencedByCards: [],
    ...emptyReferenceLabels(),
  }
}
