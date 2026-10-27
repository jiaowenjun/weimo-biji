import { friendConflictMessage, type FriendConflictBody } from '../models/friend'
import { isRecord } from './guards'
import { getApiErrorResponseData, toErrorMessage } from './request'

export type FriendResourceRecoveryActionKind = 'retry' | 'friend-search' | 'home'

export interface FriendResourceRecoveryState {
  errorMessage: string
  toastMessage: string
  actionKind: FriendResourceRecoveryActionKind
  actionLabel: string
}

function parseExplicitFriendResourceConflict(data: unknown): FriendConflictBody | null {
  if (!isRecord(data) || typeof data.code !== 'string') return null
  if (
    data.code !== 'NO_FRIENDS_YET' &&
    data.code !== 'NOT_YOUR_FRIEND' &&
    data.code !== 'FRIEND_UNAVAILABLE'
  ) {
    return null
  }
  return {
    code: data.code,
    message: typeof data.message === 'string' ? data.message : '',
  }
}

function extractFriendResourceErrorData(error: unknown): unknown {
  const data = getApiErrorResponseData(error)
  if (data != null) return data
  if (isRecord(error) && 'responseData' in error) {
    // Cross-module ApiError instances can fail `instanceof` checks after test module resets.
    return error.responseData
  }
  return null
}

export function defaultFriendResourceRecoveryState(): FriendResourceRecoveryState {
  return {
    errorMessage: '',
    toastMessage: '',
    actionKind: 'retry',
    actionLabel: '重新加载',
  }
}

export function resolveFriendResourceRecovery(
  error: unknown,
  fallback: string,
): FriendResourceRecoveryState {
  const conflict = parseExplicitFriendResourceConflict(extractFriendResourceErrorData(error))
  if (!conflict) {
    return {
      errorMessage: toErrorMessage(error, fallback),
      toastMessage: '',
      actionKind: 'retry',
      actionLabel: '重新加载',
    }
  }

  const message = conflict.message || friendConflictMessage(conflict.code)
  if (conflict.code === 'NO_FRIENDS_YET') {
    return {
      errorMessage: message,
      toastMessage: message,
      actionKind: 'friend-search',
      actionLabel: '添加朋友',
    }
  }

  return {
    errorMessage: message,
    toastMessage: message,
    actionKind: 'home',
    actionLabel: '返回首页',
  }
}
