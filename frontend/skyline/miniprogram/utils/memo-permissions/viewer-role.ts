import type { ViewerRole } from './types'

export interface ResolveViewerRoleInput {
  sessionUsername: string | undefined
  ownerUsername: string
}

export function resolveViewerRole(input: ResolveViewerRoleInput): ViewerRole {
  const owner = input.ownerUsername.trim()
  if (!owner) return 'denied'
  if (!input.sessionUsername) return 'denied'
  if (input.sessionUsername === owner) return 'self'
  return 'denied'
}
