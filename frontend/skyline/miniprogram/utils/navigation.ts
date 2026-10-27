import type { UserProfile } from '../models/auth'
import type { FriendProfile } from '../models/friend'
import type { MemoQueryDraft, MemoRefId } from '../models/memo'
import { memoShareRichTextNodesContainSearchMark } from './memo-highlight'
import type { MemoCardItem } from './memo-list-presentation'
import { renderMemoMarkdownToNodes } from './memo-markdown'
import { ownMemoIdFromRef, parseFriendMemoRef } from './memo-ref-id'
import { cloneMemoQueryDraft } from './memo-query'
import { AppRoutes } from './routes'

export const RouteTypes = {
  cupertino: 'cupertino',
  cupertinoInside: 'cupertino-inside',
  bottomSheet: 'bottom-sheet',
  upwards: 'upwards',
  zoom: 'zoom',
  modal: 'modal',
  cupertinoModal: 'cupertino-modal',
} as const

export interface MemoSearchInitPayload {
  draft: MemoQueryDraft
  targetFriend?: FriendProfile
}

export type AccountEditSheetMode = 'nickname' | 'login-name' | 'password'

export interface AccountEditSheetInitPayload {
  mode: AccountEditSheetMode
  profile: UserProfile
}

/** 分享给图片页：一次性传入列表投影条目。节流场景补解析，含搜索高亮时从正文重解析，其余复用。 */
export interface MemoShareImageInitPayload {
  card: MemoCardItem
}

const AUTH_PAGE = AppRoutes.auth
const HOME_PAGE = AppRoutes.home
const MEMO_COMPOSE_PAGE = AppRoutes.memoCompose
const MEMO_COMPOSE_TAG_PICKER_PAGE = AppRoutes.memoComposeTagPicker
const MEMO_REFERENCE_DETAIL_PAGE = AppRoutes.memoReferenceDetail
const MEMO_SEARCH_PAGE = AppRoutes.search
const MEMO_SHARE_IMAGE_PAGE = AppRoutes.memoShareImage
const SETTINGS_PAGE = AppRoutes.settings
const FRIEND_SEARCH_PAGE = AppRoutes.friendSearch
const NOTIFICATIONS_PAGE = AppRoutes.notifications
const ACCOUNT_DETAIL_PAGE = AppRoutes.accountDetail
const ACCOUNT_EDIT_SHEET_PAGE = AppRoutes.accountEditSheet

function normalizeMemoRefList(memoIds: Array<MemoRefId | number>): MemoRefId[] {
  const seen = new Set<MemoRefId>()
  const result: MemoRefId[] = []
  for (const candidate of memoIds) {
    const rawRef = String(candidate ?? '').trim()
    if (!rawRef) continue

    if (parseFriendMemoRef(rawRef)) {
      if (seen.has(rawRef)) continue
      seen.add(rawRef)
      result.push(rawRef)
      continue
    }

    const ownMemoId = ownMemoIdFromRef(rawRef)
    if (ownMemoId === null) continue
    const normalizedRef = String(ownMemoId)
    if (seen.has(normalizedRef)) continue
    seen.add(normalizedRef)
    result.push(normalizedRef)
  }
  return result
}

export function reLaunchToAuth() {
  return wx.reLaunch({ url: AUTH_PAGE })
}

export function openAuthPage(options?: { allowBack?: boolean }) {
  const allowBack = options?.allowBack ? '?allowBack=1' : ''
  return wx.navigateTo({ url: `${AUTH_PAGE}${allowBack}` })
}

export function reLaunchToHome() {
  return wx.reLaunch({ url: HOME_PAGE })
}

export function openMemoCompose(
  payload: MemoComposeInitPayload,
  onSaved?: (result: MemoComposeSavedPayload) => void,
  options?: { routeType?: string },
) {
  const params = [`mode=${payload.mode}`]
  if (payload.memoId != null) params.push(`memoId=${payload.memoId}`)
  if (
    payload.mode === 'create' &&
    Array.isArray(payload.initialRefs) &&
    payload.initialRefs.length > 0
  ) {
    params.push('quote=1')
  }
  const url = `${MEMO_COMPOSE_PAGE}?${params.join('&')}`

  const navOptions: SkylineNavigateToOption = {
    url,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
    events: {
      'memo-compose-saved': (result: MemoComposeSavedPayload) => {
        onSaved?.(result)
      },
    },
    success: (res) => {
      (res as WechatMiniprogram.NavigateToSuccessCallbackResult & { eventChannel: WechatMiniprogram.EventChannel })
        .eventChannel.emit('memo-compose-init', payload)
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openMemoComposeTagPicker(
  payload: MemoComposeTagPickerInitPayload,
  onApplied: (result: MemoComposeTagPickerApplyPayload) => void,
  options?: { routeType?: string },
) {
  const url = `${MEMO_COMPOSE_TAG_PICKER_PAGE}?mode=${payload.mode}`

  const initPayload: MemoComposeTagPickerInitPayload = { ...payload }

  const navOptions: SkylineNavigateToOption = {
    url,
    routeType: options?.routeType || 'cupertino-inside',
    routeConfig: {
      popGestureDirection: 'multi',
    },
    events: {
      'memo-compose-tag-picker-apply': (result: MemoComposeTagPickerApplyPayload) => {
        onApplied(result)
      },
    },
    success: (res) => {
      (
        res as WechatMiniprogram.NavigateToSuccessCallbackResult & {
          eventChannel: WechatMiniprogram.EventChannel
        }
      ).eventChannel.emit('memo-compose-tag-picker-init', initPayload)
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openMemoReferenceDetail(memoId: number, options?: { routeType?: string }) {
  const navOptions: SkylineNavigateToOption = {
    url: `${MEMO_REFERENCE_DETAIL_PAGE}?memoId=${memoId}`,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openMemoReferences(memoId: number, options?: { routeType?: string }) {
  const navOptions: SkylineNavigateToOption = {
    url: `${MEMO_REFERENCE_DETAIL_PAGE}?memoId=${memoId}&mode=references`,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openFriendMemoReferenceDetail(
  memoId: number,
  options?: { routeType?: string; ownerUsername?: string },
) {
  const ownerUsername = String(options?.ownerUsername || '').trim()
  const ownerQuery = ownerUsername ? `&ownerUsername=${encodeURIComponent(ownerUsername)}` : ''
  const navOptions: SkylineNavigateToOption = {
    url: `${MEMO_REFERENCE_DETAIL_PAGE}?memoId=${memoId}&owner=friend${ownerQuery}`,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openMemoReferenceList(
  memoIds: Array<MemoRefId | number>,
  options?: { routeType?: string },
) {
  const refs = normalizeMemoRefList(memoIds)
  if (refs.length === 0) return
  const encodedRefs = refs.map((ref) => encodeURIComponent(ref)).join(',')

  const navOptions: SkylineNavigateToOption = {
    url: `${MEMO_REFERENCE_DETAIL_PAGE}?mode=references&memoRefs=${encodedRefs}`,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openMemoSearch(
  query: MemoQueryDraft,
  onApplied: (nextQuery: MemoQueryDraft) => void,
  options?: { targetFriend?: FriendProfile },
) {
  const initialQuery = cloneMemoQueryDraft(query)
  const payload: MemoSearchInitPayload = { draft: initialQuery }
  if (options?.targetFriend) {
    payload.targetFriend = options.targetFriend
  }

  const navOptions: SkylineNavigateToOption = {
    url: MEMO_SEARCH_PAGE,
    events: {
      'memo-search-apply': (nextQuery: MemoQueryDraft) => {
        onApplied(nextQuery)
      },
    },
    success: (res) => {
      (
        res as WechatMiniprogram.NavigateToSuccessCallbackResult & {
          eventChannel: WechatMiniprogram.EventChannel
        }
      ).eventChannel.emit('memo-search-init', payload)
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}

export function openSettings() {
  const options: SkylineNavigateToOption = {
    url: SETTINGS_PAGE,
    routeType: RouteTypes.upwards,
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(options)
}

export function openFriendSearch() {
  const options: SkylineNavigateToOption = {
    url: FRIEND_SEARCH_PAGE,
    routeType: 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(options)
}

export function openAccountDetail() {
  const options: SkylineNavigateToOption = {
    url: ACCOUNT_DETAIL_PAGE,
    routeType: 'cupertino',
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(options)
}

export function openAccountEditSheet(
  mode: AccountEditSheetMode,
  profile: UserProfile,
  onUpdated: (user: UserProfile) => void,
) {
  const options: SkylineNavigateToOption = {
    url: `${ACCOUNT_EDIT_SHEET_PAGE}?mode=${mode}`,
    routeType: RouteTypes.cupertinoInside,
    routeConfig: {
      popGestureDirection: 'multi',
    },
    events: {
      'account-profile-updated': (user: UserProfile) => {
        onUpdated(user)
      },
    },
    success: (res) => {
      (
        res as WechatMiniprogram.NavigateToSuccessCallbackResult & {
          eventChannel: WechatMiniprogram.EventChannel
        }
      ).eventChannel.emit('account-edit-sheet-init', { mode, profile })
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(options)
}

export function openNotifications() {
  const options: SkylineNavigateToOption = {
    url: NOTIFICATIONS_PAGE,
    routeType: RouteTypes.upwards,
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(options)
}

export function openMemoShareImage(payload: MemoShareImageInitPayload, options?: { routeType?: string }) {
  const { card } = payload
  let sharedCard: MemoCardItem
  if (!card.renderRichText) {
    sharedCard = {
      ...card,
      renderRichText: true,
      contentNodes: renderMemoMarkdownToNodes(card.content),
    }
  } else if (memoShareRichTextNodesContainSearchMark(card.contentNodes)) {
    sharedCard = { ...card, contentNodes: renderMemoMarkdownToNodes(card.content) }
  } else {
    sharedCard = { ...card }
  }
  const sharePayload: MemoShareImageInitPayload = { card: sharedCard }

  const navOptions: SkylineNavigateToOption = {
    url: MEMO_SHARE_IMAGE_PAGE,
    routeType: options?.routeType || 'cupertino',
    routeConfig: {
      popGestureDirection: 'multi',
    },
    success: (res) => {
      (
        res as WechatMiniprogram.NavigateToSuccessCallbackResult & {
          eventChannel: WechatMiniprogram.EventChannel
        }
      ).eventChannel.emit('memo-share-image-init', sharePayload)
    },
  }

  ;(wx.navigateTo as (opt: SkylineNavigateToOption) => void)(navOptions)
}
