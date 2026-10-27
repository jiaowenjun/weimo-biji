export function loadWorkspaceDemoPage() {
  return import('@/features/workspace/workspace-demo-page')
}

export function loadGuestWorkspacePage() {
  return import('@/features/workspace/guest-workspace-page')
}

export function preloadWorkspaceDemoPage() {
  void loadWorkspaceDemoPage().catch(() => undefined)
}

export function preloadGuestWorkspacePage() {
  void loadGuestWorkspacePage().catch(() => undefined)
}
