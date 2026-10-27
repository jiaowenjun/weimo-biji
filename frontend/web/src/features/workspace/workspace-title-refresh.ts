type RefreshAction = () => Promise<unknown> | unknown

function invokeRefresh(action: RefreshAction): Promise<unknown> {
  return Promise.resolve().then(action)
}

export function runWorkspaceTitleRefreshActions(actions: {
  refreshMemoList: RefreshAction
  refreshStats: RefreshAction
  refreshTagTree: RefreshAction
}): Promise<void> {
  const refreshActions = [
    invokeRefresh(actions.refreshMemoList),
    invokeRefresh(actions.refreshStats),
    invokeRefresh(actions.refreshTagTree),
  ]

  return Promise.allSettled(refreshActions).then(() => {})
}
