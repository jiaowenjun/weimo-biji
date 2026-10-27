import type { MemoCreatedAtSort } from '../memo-list-sort-prefs'
import { createSelfScopeStrategy } from './self-strategy'
import type { MemoScopeStrategy } from './types'

export type {
  MemoScopeStrategy,
  HomeMemoScope,
  CardActionContext,
  ScopeRefreshResult,
  MemoListRelationOptions,
} from './types'

export { createSelfScopeStrategy } from './self-strategy'

export function createMemoScopeStrategy(
  getSort: () => MemoCreatedAtSort,
): MemoScopeStrategy {
  return createSelfScopeStrategy(getSort)
}
