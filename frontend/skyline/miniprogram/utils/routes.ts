export const AppPagePaths = {
  home: 'pages/index/index',
  auth: 'pages/auth/index',
  memoCompose: 'pages/memo-compose/index',
  memoComposeTagPicker: 'pages/memo-compose-tag-picker/index',
  memoReferenceDetail: 'pages/memo-reference-detail/index',
  search: 'pages/search/index',
  settings: 'pages/settings/index',
  accountDetail: 'pages/settings/account-detail/index',
  accountEditSheet: 'pages/settings/account-edit-sheet/index',
  friendSearch: 'pages/friend-search/index',
  notifications: 'pages/notifications/index',
  memoShareImage: 'pages/memo-share-image/index',
} as const

export const AppRoutes = {
  home: `/${AppPagePaths.home}`,
  auth: `/${AppPagePaths.auth}`,
  memoCompose: `/${AppPagePaths.memoCompose}`,
  memoComposeTagPicker: `/${AppPagePaths.memoComposeTagPicker}`,
  memoReferenceDetail: `/${AppPagePaths.memoReferenceDetail}`,
  search: `/${AppPagePaths.search}`,
  settings: `/${AppPagePaths.settings}`,
  accountDetail: `/${AppPagePaths.accountDetail}`,
  accountEditSheet: `/${AppPagePaths.accountEditSheet}`,
  friendSearch: `/${AppPagePaths.friendSearch}`,
  notifications: `/${AppPagePaths.notifications}`,
  memoShareImage: `/${AppPagePaths.memoShareImage}`,
} as const

type ShareEntranceCard = {
  id: number
  ownerUsername: string
} | null

type ShareEntranceSession = {
  user: Pick<WeimoSessionUser, 'username'> | null
} | null | undefined

export function buildShareEntrancePath(
  card: ShareEntranceCard,
  session: ShareEntranceSession,
): string {
  if (!card || !Number.isFinite(card.id) || card.id <= 0) return AppPagePaths.home

  const owner = String(card.ownerUsername || '').trim() || String(session?.user?.username || '').trim()
  if (!owner) return AppPagePaths.home

  return `${AppPagePaths.memoReferenceDetail}?entry=share&memoId=${card.id}&ownerUsername=${encodeURIComponent(owner)}`
}
