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
  memoShareImage: `/${AppPagePaths.memoShareImage}`,
} as const

type ShareEntranceCard = {
  id: number
} | null

export function buildShareEntrancePath(card: ShareEntranceCard): string {
  if (!card || !Number.isFinite(card.id) || card.id <= 0) return AppPagePaths.home

  return `${AppPagePaths.memoReferenceDetail}?entry=share&memoId=${card.id}`
}
