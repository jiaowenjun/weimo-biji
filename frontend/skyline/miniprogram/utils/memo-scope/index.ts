import type { MemoCreatedAtSort } from '../memo-list-sort-prefs'
import { createFriendScopeStrategy } from './friend-strategy'
import { createSelfScopeStrategy } from './self-strategy'
import type { HomeMemoScope, MemoScopeStrategy } from './types'

export type {
  MemoScopeStrategy,
  HomeMemoScope,
  CardActionContext,
  ScopeRefreshResult,
  MemoListRelationOptions,
} from './types'

export { createSelfScopeStrategy } from './self-strategy'
export { createFriendScopeStrategy } from './friend-strategy'

export function createMemoScopeStrategy(
  scope: HomeMemoScope,
  getSort: () => MemoCreatedAtSort,
): MemoScopeStrategy {
  if (scope.kind === 'friend') {
    return createFriendScopeStrategy(scope.targetFriend, getSort)
  }
  return createSelfScopeStrategy(getSort)
}
